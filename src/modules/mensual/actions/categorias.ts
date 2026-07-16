"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAdminAction } from "../server/helpers";
import type { ActionResult } from "../types";

type EliminarResult = { ok: true; mensaje?: string } | { ok: false; error: string };

const nombreSchema = z.string().trim().min(1, "Escribe un nombre").max(60);

// Crea una categoría de gasto del módulo mensual. Reactiva si existe una inactiva con
// el mismo nombre (para no chocar con el índice único).
export async function crearCategoriaMensual(nombreRaw: string): Promise<ActionResult> {
  try {
    const user = await requireAdminAction();
    const nombre = nombreSchema.parse(nombreRaw);

    const existente = await prisma.mensualCategoriaGasto.findUnique({ where: { nombre } });
    if (existente) {
      if (existente.activa) return { ok: false, error: "Ya existe una categoría con ese nombre" };
      await prisma.mensualCategoriaGasto.update({
        where: { id: existente.id },
        data: { activa: true },
      });
    } else {
      await prisma.mensualCategoriaGasto.create({ data: { nombre } });
    }

    await prisma.auditLog.create({
      data: {
        action: "MENSUAL_CATEGORIA_ADD",
        changedById: user.id,
        fieldChanges: JSON.stringify({ categoria: { before: null, after: nombre } }),
      },
    });

    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    if (e instanceof z.ZodError) return { ok: false, error: e.issues[0]?.message ?? "Datos inválidos" };
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado" };
  }
}

// "Eliminar": si la categoría ya tiene gastos, se DESACTIVA (protege el histórico); si
// nunca se usó, se borra físicamente. Mismo patrón que CategoriaGasto del Cierre general.
export async function eliminarCategoriaMensual(id: string): Promise<EliminarResult> {
  try {
    const user = await requireAdminAction();
    const categoria = await prisma.mensualCategoriaGasto.findUnique({
      where: { id },
      include: { _count: { select: { gastos: true } } },
    });
    if (!categoria) return { ok: false, error: "Categoría no encontrada" };

    const tieneGastos = categoria._count.gastos > 0;

    if (tieneGastos) {
      await prisma.mensualCategoriaGasto.update({ where: { id }, data: { activa: false } });
    } else {
      await prisma.mensualCategoriaGasto.delete({ where: { id } });
    }

    await prisma.auditLog.create({
      data: {
        action: tieneGastos ? "MENSUAL_CATEGORIA_DESACTIVAR" : "MENSUAL_CATEGORIA_DELETE",
        changedById: user.id,
        fieldChanges: JSON.stringify({ categoria: { before: categoria.nombre, after: null } }),
      },
    });

    revalidatePath("/", "layout");
    return {
      ok: true,
      mensaje: tieneGastos
        ? "La categoría tenía gastos registrados, así que se desactivó (no se borró para conservar el histórico)."
        : undefined,
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado" };
  }
}
