"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { BOLSA_GENERAL_BUCKETS, type BolsaGeneralBucket } from "../types";

export type ActionResult = { ok: true } | { ok: false; error: string };

const schema = z.object({
  bucket: z.enum(BOLSA_GENERAL_BUCKETS),
  // El saldo inicial puede ser negativo, mismo espíritu que setPocketOpeningBalance.
  amount: z.number().int("El saldo debe ser un número entero"),
});

// Ajustar el saldo inicial manual de una bolsa 70/30 (mismo mecanismo que
// setPocketOpeningBalance, en tabla aparte BolsaGeneral, aislada de pockets.ts). Auditado.
export async function ajustarBolsaGeneral(
  bucket: BolsaGeneralBucket,
  amount: number
): Promise<ActionResult> {
  try {
    const session = await auth();
    if (!session?.user) return { ok: false, error: "No autorizado" };
    if (session.user.role !== "ADMIN")
      return { ok: false, error: "Solo el administrador puede ajustar las bolsas" };

    const data = schema.parse({ bucket, amount });

    const current = await prisma.bolsaGeneral.findUnique({ where: { bucket: data.bucket } });
    if ((current?.openingBalance ?? 0) === data.amount) return { ok: true };

    await prisma.$transaction([
      prisma.bolsaGeneral.upsert({
        where: { bucket: data.bucket },
        update: { openingBalance: data.amount },
        create: { bucket: data.bucket, openingBalance: data.amount },
      }),
      prisma.auditLog.create({
        data: {
          action: "SET_BOLSA_GENERAL",
          changedById: session.user.id,
          fieldChanges: JSON.stringify({
            bolsa: { before: data.bucket, after: data.bucket },
            saldoInicial: { before: current?.openingBalance ?? 0, after: data.amount },
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
