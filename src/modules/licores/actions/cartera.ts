"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { todayBogota } from "@/lib/dates";
import { requireAdmin, requireUser } from "@/lib/permissions";
import { LICOR_MEDIOS_ABONO, type ActionResult } from "../types";

function revalidateAll() {
  revalidatePath("/", "layout");
}

const clienteSchema = z.object({
  nombre: z.string().trim().min(1, "Escribe el nombre del cliente").max(80),
  telefono: z.string().trim().max(30).optional(),
});

// Crear cliente de la cartera de LICORES (lista propia, aparte de la de la farmacia).
// Lo puede hacer la vendedora: si va a fiar una cerveza, necesita registrar al cliente ahí
// mismo sin esperar al administrador.
export async function crearClienteLicor(input: {
  nombre: string;
  telefono?: string;
}): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const data = clienteSchema.parse(input);

    const existente = await prisma.licorCliente.findUnique({ where: { nombre: data.nombre } });
    if (existente) {
      if (existente.activo) return { ok: false, error: `Ya existe un cliente "${data.nombre}"` };
      await prisma.licorCliente.update({ where: { id: existente.id }, data: { activo: true } });
      revalidateAll();
      return { ok: true };
    }

    await prisma.$transaction([
      prisma.licorCliente.create({
        data: { nombre: data.nombre, telefono: data.telefono || null },
      }),
      prisma.auditLog.create({
        data: {
          action: "LICOR_CLIENTE_CREATE",
          changedById: user.id,
          fieldChanges: JSON.stringify({ cliente: { before: null, after: data.nombre } }),
        },
      }),
    ]);

    revalidateAll();
    return { ok: true };
  } catch (e) {
    if (e instanceof z.ZodError) return { ok: false, error: e.issues[0]?.message ?? "Datos inválidos" };
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado" };
  }
}

const abonoSchema = z.object({
  clienteId: z.string().min(1, "Elige el cliente"),
  monto: z.number().int().positive("El abono debe ser mayor a cero"),
  medioPago: z.enum(LICOR_MEDIOS_ABONO),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida").optional(),
  nota: z.string().trim().max(300).optional(),
});

// Registrar un abono a la deuda de cerveza. Solo mueve la cartera de licores: NO crea un
// Movement en el cuadre de Nequi (el corte de licores lo cuenta por su cuenta, y meterlo
// también allá contaría la misma plata dos veces).
export async function registrarAbonoLicor(input: {
  clienteId: string;
  monto: number;
  medioPago: string;
  date?: string;
  nota?: string;
}): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const data = abonoSchema.parse(input);
    const hoy = todayBogota();
    const date = data.date && user.role === "ADMIN" && data.date <= hoy ? data.date : hoy;

    const cliente = await prisma.licorCliente.findUnique({ where: { id: data.clienteId } });
    if (!cliente) return { ok: false, error: "Cliente no encontrado" };

    await prisma.$transaction([
      prisma.licorAbono.create({
        data: {
          clienteId: data.clienteId,
          date,
          monto: data.monto,
          medioPago: data.medioPago,
          nota: data.nota || null,
          createdById: user.id,
        },
      }),
      prisma.auditLog.create({
        data: {
          action: "LICOR_ABONO_CREATE",
          changedById: user.id,
          fieldChanges: JSON.stringify({
            abono: {
              before: null,
              after: `${cliente.nombre}: $${data.monto.toLocaleString("es-CO")} (${data.medioPago})`,
            },
          }),
        },
      }),
    ]);

    revalidateAll();
    return { ok: true };
  } catch (e) {
    if (e instanceof z.ZodError) return { ok: false, error: e.issues[0]?.message ?? "Datos inválidos" };
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado" };
  }
}

// Borrar un abono. Mismos permisos que el resto del módulo: el admin cualquiera y cualquier
// día; la vendedora solo el suyo y solo de hoy.
export async function eliminarAbonoLicor(id: string): Promise<ActionResult> {
  try {
    const user = await requireUser();

    const abono = await prisma.licorAbono.findUnique({
      where: { id },
      include: { cliente: { select: { nombre: true } } },
    });
    if (!abono || abono.deletedAt) return { ok: false, error: "Abono no encontrado" };
    if (abono.licorCierreId)
      return { ok: false, error: "Ese abono ya entró en un cierre de licores; no se puede borrar." };

    if (user.role !== "ADMIN") {
      if (abono.createdById !== user.id)
        return { ok: false, error: "Solo puedes borrar tus propios abonos" };
      if (abono.date !== todayBogota())
        return { ok: false, error: "Solo puedes borrar abonos del día de hoy" };
    }

    await prisma.$transaction([
      prisma.licorAbono.update({ where: { id }, data: { deletedAt: new Date() } }),
      prisma.auditLog.create({
        data: {
          action: "LICOR_ABONO_DELETE",
          changedById: user.id,
          fieldChanges: JSON.stringify({
            abono: {
              before: `${abono.cliente.nombre}: $${abono.monto.toLocaleString("es-CO")}`,
              after: null,
            },
          }),
        },
      }),
    ]);

    revalidateAll();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado" };
  }
}

// Desactivar un cliente (no se borra: conserva su historial de fiados y abonos).
export async function desactivarClienteLicor(id: string): Promise<ActionResult> {
  try {
    const user = await requireAdmin();
    const cliente = await prisma.licorCliente.findUnique({ where: { id } });
    if (!cliente) return { ok: false, error: "Cliente no encontrado" };

    await prisma.$transaction([
      prisma.licorCliente.update({ where: { id }, data: { activo: !cliente.activo } }),
      prisma.auditLog.create({
        data: {
          action: "LICOR_CLIENTE_UPDATE",
          changedById: user.id,
          fieldChanges: JSON.stringify({
            cliente: {
              before: `${cliente.nombre} (${cliente.activo ? "activo" : "inactivo"})`,
              after: `${cliente.nombre} (${cliente.activo ? "inactivo" : "activo"})`,
            },
          }),
        },
      }),
    ]);

    revalidateAll();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado" };
  }
}
