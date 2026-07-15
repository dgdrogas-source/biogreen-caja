"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export type ActionResult = { ok: true; mensaje?: string } | { ok: false; error: string };

async function requireAdmin() {
  const session = await auth();
  if (!session?.user) throw new Error("No autorizado");
  if (session.user.role !== "ADMIN") throw new Error("Solo el administrador puede hacer esto");
  return session.user;
}

const nombreSchema = z.string().trim().min(1, "Escribe un nombre").max(60, "Máximo 60 caracteres");

export async function crearCategoriaGasto(nombre: string): Promise<ActionResult> {
  try {
    const user = await requireAdmin();
    const data = nombreSchema.parse(nombre);

    const existing = await prisma.categoriaGasto.findUnique({ where: { nombre: data } });
    if (existing?.activa) return { ok: false, error: "Esa categoría ya existe" };

    if (existing) {
      // Reactivar una categoría desactivada con el mismo nombre en vez de duplicar.
      await prisma.$transaction([
        prisma.categoriaGasto.update({ where: { id: existing.id }, data: { activa: true } }),
        prisma.auditLog.create({
          data: {
            action: "CATEGORIA_GASTO_CREATE",
            changedById: user.id,
            fieldChanges: JSON.stringify({ categoria: { before: null, after: data } }),
          },
        }),
      ]);
      revalidatePath("/", "layout");
      return { ok: true };
    }

    await prisma.$transaction([
      prisma.categoriaGasto.create({ data: { nombre: data } }),
      prisma.auditLog.create({
        data: {
          action: "CATEGORIA_GASTO_CREATE",
          changedById: user.id,
          fieldChanges: JSON.stringify({ categoria: { before: null, after: data } }),
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

// "Eliminar" desactiva si la categoría ya tiene gastos asociados (protege el histórico
// itemizado); se borra físicamente solo si nunca se usó.
export async function eliminarCategoriaGasto(id: string): Promise<ActionResult> {
  try {
    const user = await requireAdmin();

    const categoria = await prisma.categoriaGasto.findUnique({ where: { id } });
    if (!categoria) return { ok: false, error: "Categoría no encontrada" };

    const enUso = await prisma.cierreGeneralGasto.count({ where: { categoriaId: id } });

    if (enUso > 0) {
      await prisma.$transaction([
        prisma.categoriaGasto.update({ where: { id }, data: { activa: false } }),
        prisma.auditLog.create({
          data: {
            action: "CATEGORIA_GASTO_DEACTIVATE",
            changedById: user.id,
            fieldChanges: JSON.stringify({ categoria: { before: categoria.nombre, after: null } }),
          },
        }),
      ]);
      revalidatePath("/", "layout");
      return { ok: true, mensaje: "Tiene gastos registrados: se desactivó en vez de borrarse" };
    }

    await prisma.$transaction([
      prisma.categoriaGasto.delete({ where: { id } }),
      prisma.auditLog.create({
        data: {
          action: "CATEGORIA_GASTO_DELETE",
          changedById: user.id,
          fieldChanges: JSON.stringify({ categoria: { before: categoria.nombre, after: null } }),
        },
      }),
    ]);

    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado" };
  }
}
