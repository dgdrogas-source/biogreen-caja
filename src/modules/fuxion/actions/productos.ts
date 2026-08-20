"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/permissions";
import { STOCK_MINIMO_DEFECTO, type ActionResult } from "../types";

const productoSchema = z.object({
  nombre: z.string().trim().min(1, "Escribe el nombre del producto").max(60),
  precioVenta: z.number().int().nonnegative("El precio no puede ser negativo"),
  // Conteo físico con el que arranca el módulo. A diferencia de Licores (que empezó en 0),
  // aquí ya hay mercancía en la vitrina el día que esto entra en producción.
  inventarioInicial: z.number().int().nonnegative("El inventario inicial no puede ser negativo"),
  stockMinimo: z.number().int().nonnegative("El umbral no puede ser negativo"),
});

function revalidateAll() {
  revalidatePath("/", "layout");
}

export async function crearProductoFuxion(input: {
  nombre: string;
  precioVenta: number;
  inventarioInicial?: number;
  stockMinimo?: number;
}): Promise<ActionResult> {
  try {
    const user = await requireAdmin();
    const data = productoSchema.parse({
      ...input,
      inventarioInicial: input.inventarioInicial ?? 0,
      stockMinimo: input.stockMinimo ?? STOCK_MINIMO_DEFECTO,
    });

    const existente = await prisma.fuxionProducto.findUnique({ where: { nombre: data.nombre } });
    if (existente) {
      // Si estaba desactivado, reactivarlo es lo que el dueño espera (no un error).
      if (!existente.activo) {
        await prisma.$transaction([
          prisma.fuxionProducto.update({
            where: { id: existente.id },
            data: {
              activo: true,
              precioVenta: data.precioVenta,
              stockMinimo: data.stockMinimo,
            },
          }),
          prisma.auditLog.create({
            data: {
              action: "FUXION_PRODUCTO_UPDATE",
              changedById: user.id,
              fieldChanges: JSON.stringify({
                producto: { before: `${data.nombre} (inactivo)`, after: `${data.nombre} (activo)` },
              }),
            },
          }),
        ]);
        revalidateAll();
        return { ok: true };
      }
      return { ok: false, error: `Ya existe un producto llamado "${data.nombre}"` };
    }

    await prisma.$transaction([
      prisma.fuxionProducto.create({ data }),
      prisma.auditLog.create({
        data: {
          action: "FUXION_PRODUCTO_CREATE",
          changedById: user.id,
          fieldChanges: JSON.stringify({
            producto: { before: null, after: data.nombre },
            precio: { before: null, after: data.precioVenta },
            inventarioInicial: { before: null, after: data.inventarioInicial },
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

// Editar precio, inventario inicial y/o umbral. El precio nuevo solo afecta VENTAS FUTURAS:
// las ya registradas congelaron el suyo, así que aquí no se toca nada del historial.
// Cambiar el inventario inicial SÍ recalcula el stock actual — es justo para lo que existe:
// corregir el conteo con el que arrancó el módulo.
export async function actualizarProductoFuxion(input: {
  id: string;
  nombre: string;
  precioVenta: number;
  inventarioInicial: number;
  stockMinimo: number;
}): Promise<ActionResult> {
  try {
    const user = await requireAdmin();
    const data = productoSchema.parse(input);

    const actual = await prisma.fuxionProducto.findUnique({ where: { id: input.id } });
    if (!actual) return { ok: false, error: "Producto no encontrado" };

    if (data.nombre !== actual.nombre) {
      const choque = await prisma.fuxionProducto.findUnique({ where: { nombre: data.nombre } });
      if (choque) return { ok: false, error: `Ya existe un producto llamado "${data.nombre}"` };
    }

    const changes: Record<string, { before: unknown; after: unknown }> = {};
    if (actual.nombre !== data.nombre) changes.nombre = { before: actual.nombre, after: data.nombre };
    if (actual.precioVenta !== data.precioVenta)
      changes.precio = { before: actual.precioVenta, after: data.precioVenta };
    if (actual.inventarioInicial !== data.inventarioInicial)
      changes.inventarioInicial = {
        before: actual.inventarioInicial,
        after: data.inventarioInicial,
      };
    if (actual.stockMinimo !== data.stockMinimo)
      changes.stockMinimo = { before: actual.stockMinimo, after: data.stockMinimo };
    if (Object.keys(changes).length === 0) return { ok: true };

    await prisma.$transaction([
      prisma.fuxionProducto.update({ where: { id: input.id }, data }),
      prisma.auditLog.create({
        data: {
          action: "FUXION_PRODUCTO_UPDATE",
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

// "Eliminar" = desactivar si ya tiene historial (conserva compras/ventas pasadas).
// Solo se borra de verdad un producto que nunca se usó.
export async function eliminarProductoFuxion(id: string): Promise<ActionResult> {
  try {
    const user = await requireAdmin();

    const producto = await prisma.fuxionProducto.findUnique({
      where: { id },
      include: { _count: { select: { compras: true, ventas: true } } },
    });
    if (!producto) return { ok: false, error: "Producto no encontrado" };

    const tieneHistorial = producto._count.compras > 0 || producto._count.ventas > 0;

    await prisma.$transaction([
      tieneHistorial
        ? prisma.fuxionProducto.update({ where: { id }, data: { activo: false } })
        : prisma.fuxionProducto.delete({ where: { id } }),
      prisma.auditLog.create({
        data: {
          action: "FUXION_PRODUCTO_DELETE",
          changedById: user.id,
          fieldChanges: JSON.stringify({
            producto: {
              before: producto.nombre,
              after: tieneHistorial ? "desactivado (conserva historial)" : null,
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
