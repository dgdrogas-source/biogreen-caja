"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/permissions";
import { STOCK_MINIMO_DEFECTO, type ActionResult } from "../types";

const productoSchema = z.object({
  nombre: z.string().trim().min(1, "Escribe el nombre de la cerveza").max(60),
  precioVenta: z.number().int().nonnegative("El precio no puede ser negativo"),
  stockMinimo: z.number().int().nonnegative("El umbral no puede ser negativo"),
});

function revalidateAll() {
  revalidatePath("/", "layout");
}

export async function crearProductoLicor(input: {
  nombre: string;
  precioVenta: number;
  stockMinimo?: number;
}): Promise<ActionResult> {
  try {
    const user = await requireAdmin();
    const data = productoSchema.parse({
      ...input,
      stockMinimo: input.stockMinimo ?? STOCK_MINIMO_DEFECTO,
    });

    const existente = await prisma.licorProducto.findUnique({ where: { nombre: data.nombre } });
    if (existente) {
      // Si estaba desactivada, reactivarla es lo que el dueño espera (no un error).
      if (!existente.activo) {
        await prisma.$transaction([
          prisma.licorProducto.update({
            where: { id: existente.id },
            data: { activo: true, precioVenta: data.precioVenta, stockMinimo: data.stockMinimo },
          }),
          prisma.auditLog.create({
            data: {
              action: "LICOR_PRODUCTO_UPDATE",
              changedById: user.id,
              fieldChanges: JSON.stringify({
                producto: { before: `${data.nombre} (inactiva)`, after: `${data.nombre} (activa)` },
              }),
            },
          }),
        ]);
        revalidateAll();
        return { ok: true };
      }
      return { ok: false, error: `Ya existe una cerveza llamada "${data.nombre}"` };
    }

    await prisma.$transaction([
      prisma.licorProducto.create({ data }),
      prisma.auditLog.create({
        data: {
          action: "LICOR_PRODUCTO_CREATE",
          changedById: user.id,
          fieldChanges: JSON.stringify({
            producto: { before: null, after: data.nombre },
            precio: { before: null, after: data.precioVenta },
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

// Editar precio y/o umbral. El precio nuevo solo afecta VENTAS FUTURAS: las ya registradas
// congelaron el suyo (regla confirmada 2026-07-19), así que aquí no se toca nada del historial.
export async function actualizarProductoLicor(input: {
  id: string;
  nombre: string;
  precioVenta: number;
  stockMinimo: number;
}): Promise<ActionResult> {
  try {
    const user = await requireAdmin();
    const data = productoSchema.parse(input);

    const actual = await prisma.licorProducto.findUnique({ where: { id: input.id } });
    if (!actual) return { ok: false, error: "Cerveza no encontrada" };

    if (data.nombre !== actual.nombre) {
      const choque = await prisma.licorProducto.findUnique({ where: { nombre: data.nombre } });
      if (choque) return { ok: false, error: `Ya existe una cerveza llamada "${data.nombre}"` };
    }

    const changes: Record<string, { before: unknown; after: unknown }> = {};
    if (actual.nombre !== data.nombre) changes.nombre = { before: actual.nombre, after: data.nombre };
    if (actual.precioVenta !== data.precioVenta)
      changes.precio = { before: actual.precioVenta, after: data.precioVenta };
    if (actual.stockMinimo !== data.stockMinimo)
      changes.stockMinimo = { before: actual.stockMinimo, after: data.stockMinimo };
    if (Object.keys(changes).length === 0) return { ok: true };

    await prisma.$transaction([
      prisma.licorProducto.update({ where: { id: input.id }, data }),
      prisma.auditLog.create({
        data: {
          action: "LICOR_PRODUCTO_UPDATE",
          changedById: user.id,
          fieldChanges: JSON.stringify(changes),
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

// "Eliminar" = desactivar si ya tiene historial (conserva compras/ventas pasadas, regla
// confirmada). Solo se borra de verdad una cerveza que nunca se usó.
export async function eliminarProductoLicor(id: string): Promise<ActionResult> {
  try {
    const user = await requireAdmin();

    const producto = await prisma.licorProducto.findUnique({
      where: { id },
      include: { _count: { select: { compras: true, ventas: true } } },
    });
    if (!producto) return { ok: false, error: "Cerveza no encontrada" };

    const tieneHistorial = producto._count.compras > 0 || producto._count.ventas > 0;

    await prisma.$transaction([
      tieneHistorial
        ? prisma.licorProducto.update({ where: { id }, data: { activo: false } })
        : prisma.licorProducto.delete({ where: { id } }),
      prisma.auditLog.create({
        data: {
          action: "LICOR_PRODUCTO_DELETE",
          changedById: user.id,
          fieldChanges: JSON.stringify({
            producto: {
              before: producto.nombre,
              after: tieneHistorial ? "desactivada (conserva historial)" : null,
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
