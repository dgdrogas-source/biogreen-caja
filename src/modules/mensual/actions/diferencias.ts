"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { CIERRES_MENSUAL } from "../calculations/cierreMensual";
import { ensureMensualDia, requireAdminAction } from "../server/helpers";
import type { ActionResult } from "../types";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DISPOSICIONES = ["CUBRE_EMPLEADA", "DESCUENTA_DISPONIBLE"] as const;

const agregarSchema = z
  .object({
    date: z.string().regex(DATE_RE, "Fecha inválida"),
    cierre: z.enum(CIERRES_MENSUAL),
    tipo: z.enum(["SOBRANTE", "FALTANTE"]),
    monto: z.number().int().positive("El monto debe ser mayor a cero"),
    disposicion: z.enum(DISPOSICIONES).optional(),
    nota: z.string().max(300).optional(),
  })
  // La disposición solo tiene sentido en un FALTANTE; en un SOBRANTE se ignora.
  .transform((d) => (d.tipo === "SOBRANTE" ? { ...d, disposicion: undefined } : d));

export type AgregarDiferenciaInput = z.input<typeof agregarSchema>;

// Registra un sobrante/faltante de un cierre (Nequi/Efectivo/Banco) en un día.
export async function agregarDiferenciaMensual(
  input: AgregarDiferenciaInput
): Promise<ActionResult> {
  try {
    const user = await requireAdminAction();
    const d = agregarSchema.parse(input);

    await prisma.$transaction(async (tx) => {
      const dia = await ensureMensualDia(tx, d.date, user.id);
      await tx.mensualDiferencia.create({
        data: {
          mensualDiaId: dia.id,
          cierre: d.cierre,
          tipo: d.tipo,
          monto: d.monto,
          disposicion: d.disposicion ?? null,
          nota: d.nota?.trim() ? d.nota.trim() : null,
        },
      });
      await tx.auditLog.create({
        data: {
          action: "MENSUAL_DIFERENCIA_ADD",
          changedById: user.id,
          fieldChanges: JSON.stringify({
            dia: { before: null, after: d.date },
            cierre: { before: null, after: d.cierre },
            tipo: { before: null, after: d.tipo },
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

const disposicionSchema = z.object({
  diferenciaId: z.string().min(1),
  // null = volver a "pendiente"
  disposicion: z.enum(DISPOSICIONES).nullable(),
});

// Cambia cómo se trata un FALTANTE: lo cubre la empleada, se descuenta, o queda pendiente.
export async function actualizarDisposicionDiferencia(
  input: z.infer<typeof disposicionSchema>
): Promise<ActionResult> {
  try {
    const user = await requireAdminAction();
    const d = disposicionSchema.parse(input);

    const dif = await prisma.mensualDiferencia.findUnique({ where: { id: d.diferenciaId } });
    if (!dif) return { ok: false, error: "Diferencia no encontrada" };
    if (dif.tipo !== "FALTANTE") return { ok: false, error: "Solo los faltantes tienen disposición" };

    await prisma.$transaction([
      prisma.mensualDiferencia.update({
        where: { id: d.diferenciaId },
        data: { disposicion: d.disposicion },
      }),
      prisma.auditLog.create({
        data: {
          action: "MENSUAL_DIFERENCIA_DISPOSICION",
          changedById: user.id,
          fieldChanges: JSON.stringify({
            disposicion: { before: dif.disposicion, after: d.disposicion },
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

export async function eliminarDiferenciaMensual(diferenciaId: string): Promise<ActionResult> {
  try {
    const user = await requireAdminAction();
    const dif = await prisma.mensualDiferencia.findUnique({ where: { id: diferenciaId } });
    if (!dif) return { ok: false, error: "Diferencia no encontrada" };

    await prisma.$transaction([
      prisma.mensualDiferencia.delete({ where: { id: diferenciaId } }),
      prisma.auditLog.create({
        data: {
          action: "MENSUAL_DIFERENCIA_DELETE",
          changedById: user.id,
          fieldChanges: JSON.stringify({
            cierre: { before: dif.cierre, after: null },
            tipo: { before: dif.tipo, after: null },
            monto: { before: dif.monto, after: null },
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
