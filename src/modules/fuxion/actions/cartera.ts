"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { todayBogota } from "@/lib/dates";
import { requireAdmin, requireUser } from "@/lib/permissions";
import { FUXION_MEDIOS_ABONO, type ActionResult } from "../types";

// Cartera PROPIA de Fuxion, separada de la de la farmacia y de la de licores. Un abono NO
// crea Movement en Nequi: el corte de Fuxion ya lo cuenta, meterlo también allá duplicaría
// la plata (mismo criterio que el módulo Licores).

function revalidateAll() {
  revalidatePath("/", "layout");
}

const clienteSchema = z.object({
  nombre: z.string().trim().min(1, "Escribe el nombre del cliente").max(80),
  telefono: z.string().trim().max(30).optional(),
});

// La vendedora puede crear un cliente desde el pop-up (si no, no podría fiar).
export async function crearClienteFuxion(input: {
  nombre: string;
  telefono?: string;
}): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const data = clienteSchema.parse(input);

    const existente = await prisma.fuxionCliente.findUnique({ where: { nombre: data.nombre } });
    if (existente) {
      if (!existente.activo) {
        await prisma.$transaction([
          prisma.fuxionCliente.update({ where: { id: existente.id }, data: { activo: true } }),
          prisma.auditLog.create({
            data: {
              action: "FUXION_CLIENTE_UPDATE",
              changedById: user.id,
              fieldChanges: JSON.stringify({
                cliente: { before: `${data.nombre} (inactivo)`, after: `${data.nombre} (activo)` },
              }),
            },
          }),
        ]);
        revalidateAll();
        return { ok: true };
      }
      return { ok: false, error: `Ya existe un cliente llamado "${data.nombre}"` };
    }

    await prisma.$transaction([
      prisma.fuxionCliente.create({
        data: { nombre: data.nombre, telefono: data.telefono || null },
      }),
      prisma.auditLog.create({
        data: {
          action: "FUXION_CLIENTE_CREATE",
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
  medioPago: z.enum(FUXION_MEDIOS_ABONO),
  nota: z.string().trim().max(300).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida").optional(), // solo admin
});

// Registra un abono contra la deuda de un cliente. La vendedora también puede hacerlo.
export async function registrarAbonoFuxion(input: {
  clienteId: string;
  monto: number;
  medioPago: (typeof FUXION_MEDIOS_ABONO)[number];
  nota?: string;
  date?: string;
}): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const data = abonoSchema.parse(input);

    const hoy = todayBogota();
    const date = data.date && user.role === "ADMIN" && data.date <= hoy ? data.date : hoy;

    const cliente = await prisma.fuxionCliente.findUnique({ where: { id: data.clienteId } });
    if (!cliente) return { ok: false, error: "Cliente no encontrado" };

    await prisma.$transaction([
      prisma.fuxionAbono.create({
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
          action: "FUXION_ABONO_CREATE",
          changedById: user.id,
          fieldChanges: JSON.stringify({
            abono: {
              before: null,
              after: `${cliente.nombre} abonó $${data.monto.toLocaleString("es-CO")}`,
            },
            medioPago: { before: null, after: data.medioPago },
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

// Borra un abono. Mismos permisos que las ventas: el admin cualquiera, la vendedora solo los
// suyos y solo del día de hoy.
export async function eliminarAbonoFuxion(id: string): Promise<ActionResult> {
  try {
    const user = await requireUser();

    const abono = await prisma.fuxionAbono.findUnique({
      where: { id },
      include: { cliente: { select: { nombre: true } } },
    });
    if (!abono || abono.deletedAt) return { ok: false, error: "Abono no encontrado" };
    if (abono.fuxionCierreId)
      return {
        ok: false,
        error: "Ese abono ya entró en un cierre de Fuxion. Deshaz el cierre para poder borrarlo.",
      };

    if (user.role !== "ADMIN") {
      if (abono.createdById !== user.id)
        return { ok: false, error: "Solo puedes borrar tus propios abonos" };
      if (abono.date !== todayBogota())
        return { ok: false, error: "Solo puedes borrar abonos del día de hoy" };
    }

    await prisma.$transaction([
      prisma.fuxionAbono.update({ where: { id }, data: { deletedAt: new Date() } }),
      prisma.auditLog.create({
        data: {
          action: "FUXION_ABONO_DELETE",
          changedById: user.id,
          fieldChanges: JSON.stringify({
            abono: {
              before: `${abono.cliente.nombre} abonó $${abono.monto.toLocaleString("es-CO")}`,
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

// Desactivar un cliente es SOLO admin (conserva su historial de fiados y abonos).
export async function desactivarClienteFuxion(id: string): Promise<ActionResult> {
  try {
    const user = await requireAdmin();

    const cliente = await prisma.fuxionCliente.findUnique({ where: { id } });
    if (!cliente) return { ok: false, error: "Cliente no encontrado" };

    await prisma.$transaction([
      prisma.fuxionCliente.update({ where: { id }, data: { activo: !cliente.activo } }),
      prisma.auditLog.create({
        data: {
          action: "FUXION_CLIENTE_UPDATE",
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
