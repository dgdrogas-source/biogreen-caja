"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { POCKET_BUCKETS, type PocketBucket } from "../types";

export type ActionResult = { ok: true } | { ok: false; error: string };

const schema = z.object({
  bucket: z.enum(POCKET_BUCKETS),
  // El saldo inicial puede ser negativo: sirve para absorber un bolsillo
  // sobre-contado sin tocar sus movimientos (mismo espíritu del reset).
  amount: z.number().int("El saldo debe ser un número entero"),
});

// Cambio #2 — ajustar el saldo inicial manual de un bolsillo desde /configuracion.
// Es el mismo mecanismo del ajuste histórico de Comisiones ($42.960): un baseline
// que se suma a los movimientos, sin crear movimientos falsos. Auditado.
export async function setPocketOpeningBalance(
  bucket: PocketBucket,
  amount: number
): Promise<ActionResult> {
  try {
    const session = await auth();
    if (!session?.user) return { ok: false, error: "No autorizado" };
    if (session.user.role !== "ADMIN")
      return { ok: false, error: "Solo el administrador puede ajustar los bolsillos" };

    const data = schema.parse({ bucket, amount });

    const current = await prisma.pocketBalance.findUnique({ where: { bucket: data.bucket } });
    if ((current?.openingBalance ?? 0) === data.amount) return { ok: true };

    await prisma.$transaction([
      prisma.pocketBalance.upsert({
        where: { bucket: data.bucket },
        update: { openingBalance: data.amount },
        create: { bucket: data.bucket, openingBalance: data.amount },
      }),
      prisma.auditLog.create({
        data: {
          action: "SET_POCKET_BALANCE",
          changedById: session.user.id,
          fieldChanges: JSON.stringify({
            bolsillo: { before: data.bucket, after: data.bucket },
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
