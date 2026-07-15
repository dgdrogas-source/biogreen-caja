"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PROVEEDOR_TIPOS, type ProveedorTipo } from "../types";

export type ActionResult = { ok: true; mensaje?: string } | { ok: false; error: string };

async function requireAdmin() {
  const session = await auth();
  if (!session?.user) throw new Error("No autorizado");
  if (session.user.role !== "ADMIN") throw new Error("Solo el administrador puede hacer esto");
  return session.user;
}

const nombreSchema = z.string().trim().min(1, "Escribe un nombre").max(80, "Máximo 80 caracteres");
const tipoSchema = z.enum(PROVEEDOR_TIPOS);

// Crea un proveedor (nombre + tipo). Si existe uno desactivado con el mismo nombre+tipo, lo
// reactiva en vez de duplicar (mismo patrón que CategoriaGasto).
export async function crearProveedor(input: { nombre: string; tipo: ProveedorTipo }): Promise<ActionResult> {
  try {
    const user = await requireAdmin();
    const nombre = nombreSchema.parse(input.nombre);
    const tipo = tipoSchema.parse(input.tipo);

    const existing = await prisma.proveedor.findUnique({ where: { nombre_tipo: { nombre, tipo } } });
    if (existing?.activa) return { ok: false, error: "Ese proveedor ya existe" };

    if (existing) {
      await prisma.$transaction([
        prisma.proveedor.update({ where: { id: existing.id }, data: { activa: true } }),
        prisma.auditLog.create({
          data: {
            action: "PROVEEDOR_CREATE",
            changedById: user.id,
            fieldChanges: JSON.stringify({ proveedor: { before: null, after: `${nombre} (${tipo})` } }),
          },
        }),
      ]);
      revalidatePath("/", "layout");
      return { ok: true };
    }

    await prisma.$transaction([
      prisma.proveedor.create({ data: { nombre, tipo } }),
      prisma.auditLog.create({
        data: {
          action: "PROVEEDOR_CREATE",
          changedById: user.id,
          fieldChanges: JSON.stringify({ proveedor: { before: null, after: `${nombre} (${tipo})` } }),
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

// Renombra un proveedor existente (mismo tipo). Rechaza si el nuevo nombre ya está en uso
// por otro proveedor activo del mismo tipo.
export async function renombrarProveedor(id: string, nombre: string): Promise<ActionResult> {
  try {
    const user = await requireAdmin();
    const nuevoNombre = nombreSchema.parse(nombre);

    const proveedor = await prisma.proveedor.findUnique({ where: { id } });
    if (!proveedor) return { ok: false, error: "Proveedor no encontrado" };

    const duplicado = await prisma.proveedor.findUnique({
      where: { nombre_tipo: { nombre: nuevoNombre, tipo: proveedor.tipo } },
    });
    if (duplicado && duplicado.id !== id && duplicado.activa) {
      return { ok: false, error: "Ya existe un proveedor con ese nombre" };
    }

    await prisma.$transaction([
      prisma.proveedor.update({ where: { id }, data: { nombre: nuevoNombre } }),
      prisma.auditLog.create({
        data: {
          action: "PROVEEDOR_RENAME",
          changedById: user.id,
          fieldChanges: JSON.stringify({ nombre: { before: proveedor.nombre, after: nuevoNombre } }),
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

// "Eliminar" desactiva si el proveedor ya tiene facturas/gastos asociados (protege el
// histórico); se borra físicamente solo si nunca se usó.
export async function eliminarProveedor(id: string): Promise<ActionResult> {
  try {
    const user = await requireAdmin();

    const proveedor = await prisma.proveedor.findUnique({ where: { id } });
    if (!proveedor) return { ok: false, error: "Proveedor no encontrado" };

    const [enFacturas, enGastos] = await Promise.all([
      prisma.cierreGeneralFactura.count({ where: { proveedorId: id } }),
      prisma.cierreGeneralGasto.count({ where: { proveedorId: id } }),
    ]);
    const enUso = enFacturas + enGastos;

    if (enUso > 0) {
      await prisma.$transaction([
        prisma.proveedor.update({ where: { id }, data: { activa: false } }),
        prisma.auditLog.create({
          data: {
            action: "PROVEEDOR_DEACTIVATE",
            changedById: user.id,
            fieldChanges: JSON.stringify({ proveedor: { before: proveedor.nombre, after: null } }),
          },
        }),
      ]);
      revalidatePath("/", "layout");
      return { ok: true, mensaje: "Tiene facturas o gastos registrados: se desactivó en vez de borrarse" };
    }

    await prisma.$transaction([
      prisma.proveedor.delete({ where: { id } }),
      prisma.auditLog.create({
        data: {
          action: "PROVEEDOR_DELETE",
          changedById: user.id,
          fieldChanges: JSON.stringify({ proveedor: { before: proveedor.nombre, after: null } }),
        },
      }),
    ]);

    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado" };
  }
}
