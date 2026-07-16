"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { ensureMensualDia, requireAdminAction } from "../server/helpers";
import type { ActionResult } from "../types";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const agregarGastoSchema = z.object({
  date: z.string().regex(DATE_RE, "Fecha inválida"),
  categoriaId: z.string().min(1, "Elige una categoría"),
  monto: z.number().int().positive("El monto debe ser mayor a cero"),
  descripcion: z.string().max(300).optional(),
});

export type AgregarGastoInput = z.infer<typeof agregarGastoSchema>;

// Agrega un gasto itemizado (categoría + monto) al día. Crea el día si no existía.
export async function agregarGastoMensual(input: AgregarGastoInput): Promise<ActionResult> {
  try {
    const user = await requireAdminAction();
    const d = agregarGastoSchema.parse(input);

    const categoria = await prisma.mensualCategoriaGasto.findUnique({ where: { id: d.categoriaId } });
    if (!categoria) return { ok: false, error: "Categoría no encontrada" };

    await prisma.$transaction(async (tx) => {
      const dia = await ensureMensualDia(tx, d.date, user.id);
      await tx.mensualGasto.create({
        data: {
          mensualDiaId: dia.id,
          categoriaId: d.categoriaId,
          monto: d.monto,
          descripcion: d.descripcion?.trim() ? d.descripcion.trim() : null,
        },
      });
      await tx.auditLog.create({
        data: {
          action: "MENSUAL_GASTO_ADD",
          changedById: user.id,
          fieldChanges: JSON.stringify({
            dia: { before: null, after: d.date },
            categoria: { before: null, after: categoria.nombre },
            monto: { before: null, after: d.monto },
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

export async function eliminarGastoMensual(gastoId: string): Promise<ActionResult> {
  try {
    const user = await requireAdminAction();
    const gasto = await prisma.mensualGasto.findUnique({
      where: { id: gastoId },
      include: { categoria: true },
    });
    if (!gasto) return { ok: false, error: "Gasto no encontrado" };

    await prisma.$transaction([
      prisma.mensualGasto.delete({ where: { id: gastoId } }),
      prisma.auditLog.create({
        data: {
          action: "MENSUAL_GASTO_DELETE",
          changedById: user.id,
          fieldChanges: JSON.stringify({
            categoria: { before: gasto.categoria.nombre, after: null },
            monto: { before: gasto.monto, after: null },
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
