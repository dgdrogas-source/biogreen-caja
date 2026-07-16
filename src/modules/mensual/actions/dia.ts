"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAdminAction } from "../server/helpers";
import type { ActionResult } from "../types";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const nonNeg = z.number().int().nonnegative("No puede ser negativo");

const diaSchema = z.object({
  date: z.string().regex(DATE_RE, "Fecha inválida"),
  ventaDia: nonNeg,
  comisionTarjeta: nonNeg,
  impuesto4x1000: nonNeg,
  carteraTotal: nonNeg,
  nota: z.string().max(300).optional(),
});

export type GuardarDiaInput = z.infer<typeof diaSchema>;

// Guarda (crea o actualiza) los totales del día: venta, comisión 4%, 4x1000 y el snapshot
// de cartera. Los gastos y diferencias del día se manejan aparte (sus propias acciones).
export async function guardarDiaMensual(input: GuardarDiaInput): Promise<ActionResult> {
  try {
    const user = await requireAdminAction();
    const d = diaSchema.parse(input);

    const data = {
      ventaDia: d.ventaDia,
      comisionTarjeta: d.comisionTarjeta,
      impuesto4x1000: d.impuesto4x1000,
      carteraTotal: d.carteraTotal,
      nota: d.nota?.trim() ? d.nota.trim() : null,
    };

    await prisma.$transaction([
      prisma.mensualDia.upsert({
        where: { date: d.date },
        update: data,
        create: { date: d.date, createdById: user.id, ...data },
      }),
      prisma.auditLog.create({
        data: {
          action: "MENSUAL_DIA_GUARDAR",
          changedById: user.id,
          fieldChanges: JSON.stringify({
            dia: { before: null, after: d.date },
            ventaDia: { before: null, after: d.ventaDia },
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

// Botón de emergencia / modo prueba: borra TODOS los días del módulo mensual (con sus
// gastos y diferencias por cascade). NO toca las categorías, ni el Cierre general, ni el
// módulo Nequi (son tablas separadas). Red de seguridad para lanzar y probar sin miedo.
export async function reiniciarModuloMensual(): Promise<ActionResult> {
  try {
    const user = await requireAdminAction();
    const { count } = await prisma.mensualDia.deleteMany({});
    await prisma.auditLog.create({
      data: {
        action: "MENSUAL_RESET",
        changedById: user.id,
        fieldChanges: JSON.stringify({ diasBorrados: { before: count, after: 0 } }),
      },
    });
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado" };
  }
}

// Borra un día completo (con sus gastos y diferencias por cascade). Solo admin, auditado.
export async function eliminarDiaMensual(date: string): Promise<ActionResult> {
  try {
    const user = await requireAdminAction();
    if (!DATE_RE.test(date)) return { ok: false, error: "Fecha inválida" };

    const dia = await prisma.mensualDia.findUnique({ where: { date } });
    if (!dia) return { ok: false, error: "Ese día no existe" };

    await prisma.$transaction([
      prisma.mensualDia.delete({ where: { date } }),
      prisma.auditLog.create({
        data: {
          action: "MENSUAL_DIA_DELETE",
          changedById: user.id,
          fieldChanges: JSON.stringify({ dia: { before: date, after: null } }),
        },
      }),
    ]);

    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado" };
  }
}
