"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { todayBogota } from "@/lib/dates";
import { MEDIOS_PAGO_ABONO } from "../types";

export type ActionResult = { ok: true } | { ok: false; error: string };

// Cuentas por cobrar: accesible para admin Y vendedoras (se registra en cualquier momento
// del día, en el mostrador). Editar/borrar sigue el mismo patrón que updateMovement/
// deleteMovement: admin puede cualquiera, vendedora solo sus propios registros del día actual.
async function requireSession() {
  const session = await auth();
  if (!session?.user) throw new Error("No autorizado");
  return session.user;
}

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida");
const shiftSchema = z.union([z.literal(1), z.literal(2)]);
const montoSchema = z.number().int().positive("El monto debe ser mayor a cero");

const clienteSchema = z.object({
  nombre: z.string().trim().min(1, "Escribe un nombre").max(120, "Máximo 120 caracteres"),
  telefono: z.string().trim().max(30).optional(),
});

export async function crearCliente(input: z.infer<typeof clienteSchema>): Promise<ActionResult> {
  try {
    const user = await requireSession();
    const d = clienteSchema.parse(input);

    await prisma.$transaction(async (tx) => {
      const cliente = await tx.cliente.create({
        data: { nombre: d.nombre, telefono: d.telefono || null },
      });
      await tx.auditLog.create({
        data: {
          action: "CLIENTE_CREATE",
          changedById: user.id,
          fieldChanges: JSON.stringify({ cliente: { before: null, after: cliente.nombre } }),
        },
      });
    });

    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    if (e instanceof z.ZodError) return { ok: false, error: e.issues[0]?.message ?? "Datos inválidos" };
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado" };
  }
}

const ventaSchema = z.object({
  clienteId: z.string(),
  monto: montoSchema,
  date: dateSchema,
  shift: shiftSchema,
  nota: z.string().max(300).optional(),
});

export async function registrarVentaCredito(
  input: z.infer<typeof ventaSchema>
): Promise<ActionResult> {
  try {
    const user = await requireSession();
    const d = ventaSchema.parse(input);

    const cliente = await prisma.cliente.findUnique({ where: { id: d.clienteId } });
    if (!cliente) return { ok: false, error: "Cliente no encontrado" };

    await prisma.$transaction(async (tx) => {
      const venta = await tx.ventaCredito.create({
        data: {
          clienteId: d.clienteId,
          monto: d.monto,
          date: d.date,
          shift: d.shift,
          nota: d.nota,
          createdById: user.id,
        },
      });
      await tx.auditLog.create({
        data: {
          action: "VENTA_CREDITO_CREATE",
          changedById: user.id,
          fieldChanges: JSON.stringify({
            cliente: { before: null, after: cliente.nombre },
            monto: { before: null, after: venta.monto },
          }),
        },
      });
    });

    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    if (e instanceof z.ZodError) return { ok: false, error: e.issues[0]?.message ?? "Datos inválidos" };
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado" };
  }
}

const actualizarVentaSchema = z.object({
  id: z.string(),
  monto: montoSchema,
  date: dateSchema,
  shift: shiftSchema,
  nota: z.string().max(300).optional(),
});

export async function actualizarVentaCredito(
  input: z.infer<typeof actualizarVentaSchema>
): Promise<ActionResult> {
  try {
    const user = await requireSession();
    const d = actualizarVentaSchema.parse(input);

    const venta = await prisma.ventaCredito.findUnique({
      where: { id: d.id },
      include: { cliente: true },
    });
    if (!venta || venta.deletedAt) return { ok: false, error: "Registro no encontrado" };

    if (user.role !== "ADMIN") {
      if (venta.createdById !== user.id) return { ok: false, error: "Solo puedes editar tus propios registros" };
      if (venta.date !== todayBogota()) return { ok: false, error: "Solo puedes editar registros del día actual" };
    }

    await prisma.$transaction([
      prisma.ventaCredito.update({
        where: { id: d.id },
        data: { monto: d.monto, date: d.date, shift: d.shift, nota: d.nota },
      }),
      prisma.auditLog.create({
        data: {
          action: "VENTA_CREDITO_UPDATE",
          changedById: user.id,
          fieldChanges: JSON.stringify({
            cliente: { before: venta.cliente.nombre, after: venta.cliente.nombre },
            monto: { before: venta.monto, after: d.monto },
          }),
        },
      }),
    ]);

    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    if (e instanceof z.ZodError) return { ok: false, error: e.issues[0]?.message ?? "Datos inválidos" };
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado" };
  }
}

export async function eliminarVentaCredito(id: string): Promise<ActionResult> {
  try {
    const user = await requireSession();
    const venta = await prisma.ventaCredito.findUnique({ where: { id }, include: { cliente: true } });
    if (!venta || venta.deletedAt) return { ok: false, error: "Registro no encontrado" };

    if (user.role !== "ADMIN") {
      if (venta.createdById !== user.id) return { ok: false, error: "Solo puedes borrar tus propios registros" };
      if (venta.date !== todayBogota()) return { ok: false, error: "Solo puedes borrar registros del día actual" };
    }

    await prisma.$transaction([
      prisma.ventaCredito.update({ where: { id }, data: { deletedAt: new Date() } }),
      prisma.auditLog.create({
        data: {
          action: "VENTA_CREDITO_DELETE",
          changedById: user.id,
          fieldChanges: JSON.stringify({
            cliente: { before: venta.cliente.nombre, after: null },
            monto: { before: venta.monto, after: null },
          }),
        },
      }),
    ]);

    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado" };
  }
}

const abonoSchema = z.object({
  clienteId: z.string(),
  monto: montoSchema,
  medioPago: z.enum(MEDIOS_PAGO_ABONO),
  date: dateSchema,
  shift: shiftSchema,
  nota: z.string().max(300).optional(),
});

export async function registrarAbonoCredito(
  input: z.infer<typeof abonoSchema>
): Promise<ActionResult> {
  try {
    const user = await requireSession();
    const d = abonoSchema.parse(input);

    const cliente = await prisma.cliente.findUnique({ where: { id: d.clienteId } });
    if (!cliente) return { ok: false, error: "Cliente no encontrado" };

    await prisma.$transaction(async (tx) => {
      const abono = await tx.abonoCredito.create({
        data: {
          clienteId: d.clienteId,
          monto: d.monto,
          medioPago: d.medioPago,
          date: d.date,
          shift: d.shift,
          nota: d.nota,
          createdById: user.id,
        },
      });
      await tx.auditLog.create({
        data: {
          action: "ABONO_CREDITO_CREATE",
          changedById: user.id,
          fieldChanges: JSON.stringify({
            cliente: { before: null, after: cliente.nombre },
            monto: { before: null, after: abono.monto },
          }),
        },
      });
    });

    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    if (e instanceof z.ZodError) return { ok: false, error: e.issues[0]?.message ?? "Datos inválidos" };
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado" };
  }
}

const actualizarAbonoSchema = z.object({
  id: z.string(),
  monto: montoSchema,
  medioPago: z.enum(MEDIOS_PAGO_ABONO),
  date: dateSchema,
  shift: shiftSchema,
  nota: z.string().max(300).optional(),
});

export async function actualizarAbonoCredito(
  input: z.infer<typeof actualizarAbonoSchema>
): Promise<ActionResult> {
  try {
    const user = await requireSession();
    const d = actualizarAbonoSchema.parse(input);

    const abono = await prisma.abonoCredito.findUnique({
      where: { id: d.id },
      include: { cliente: true },
    });
    if (!abono || abono.deletedAt) return { ok: false, error: "Registro no encontrado" };

    if (user.role !== "ADMIN") {
      if (abono.createdById !== user.id) return { ok: false, error: "Solo puedes editar tus propios registros" };
      if (abono.date !== todayBogota()) return { ok: false, error: "Solo puedes editar registros del día actual" };
    }

    await prisma.$transaction([
      prisma.abonoCredito.update({
        where: { id: d.id },
        data: { monto: d.monto, medioPago: d.medioPago, date: d.date, shift: d.shift, nota: d.nota },
      }),
      prisma.auditLog.create({
        data: {
          action: "ABONO_CREDITO_UPDATE",
          changedById: user.id,
          fieldChanges: JSON.stringify({
            cliente: { before: abono.cliente.nombre, after: abono.cliente.nombre },
            monto: { before: abono.monto, after: d.monto },
          }),
        },
      }),
    ]);

    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    if (e instanceof z.ZodError) return { ok: false, error: e.issues[0]?.message ?? "Datos inválidos" };
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado" };
  }
}

export async function eliminarAbonoCredito(id: string): Promise<ActionResult> {
  try {
    const user = await requireSession();
    const abono = await prisma.abonoCredito.findUnique({ where: { id }, include: { cliente: true } });
    if (!abono || abono.deletedAt) return { ok: false, error: "Registro no encontrado" };

    if (user.role !== "ADMIN") {
      if (abono.createdById !== user.id) return { ok: false, error: "Solo puedes borrar tus propios registros" };
      if (abono.date !== todayBogota()) return { ok: false, error: "Solo puedes borrar registros del día actual" };
    }

    await prisma.$transaction([
      prisma.abonoCredito.update({ where: { id }, data: { deletedAt: new Date() } }),
      prisma.auditLog.create({
        data: {
          action: "ABONO_CREDITO_DELETE",
          changedById: user.id,
          fieldChanges: JSON.stringify({
            cliente: { before: abono.cliente.nombre, after: null },
            monto: { before: abono.monto, after: null },
          }),
        },
      }),
    ]);

    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado" };
  }
}
