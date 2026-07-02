"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export type ActionResult = { ok: true } | { ok: false; error: string };

const portionSchema = z.number().int().nonnegative("Los valores no pueden ser negativos");

// Reajuste manual del reparto de la base (solo dueño).
// Define cuánto de la base está en efectivo y cuánto en Nequi; el total es la suma.
export async function setBaseFund(
  cashPortion: number,
  nequiPortion: number
): Promise<ActionResult> {
  try {
    const session = await auth();
    if (!session?.user) return { ok: false, error: "No autorizado" };
    if (session.user.role !== "ADMIN")
      return { ok: false, error: "Solo el dueño puede ajustar la base" };

    const cash = portionSchema.parse(cashPortion);
    const nequi = portionSchema.parse(nequiPortion);

    const current = await prisma.baseFund.findUnique({ where: { id: 1 } });

    await prisma.$transaction([
      prisma.baseFund.upsert({
        where: { id: 1 },
        update: { cashPortion: cash, nequiPortion: nequi },
        create: { id: 1, cashPortion: cash, nequiPortion: nequi },
      }),
      prisma.auditLog.create({
        data: {
          action: "SET_BASE",
          changedById: session.user.id,
          fieldChanges: JSON.stringify({
            efectivo: { before: current?.cashPortion ?? null, after: cash },
            nequi: { before: current?.nequiPortion ?? null, after: nequi },
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
