"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { SALDO_REFERENCIA } from "@/lib/config";

export type ActionResult = { ok: true } | { ok: false; error: string };

const portionSchema = z.number().int().nonnegative("Los valores no pueden ser negativos");

// Reajuste manual del reparto de la base (solo administrador).
// Define cuánto de la base está en efectivo y cuánto en Nequi; el total es la suma.
export async function setBaseFund(
  cashPortion: number,
  nequiPortion: number
): Promise<ActionResult> {
  try {
    const session = await auth();
    if (!session?.user) return { ok: false, error: "No autorizado" };
    if (session.user.role !== "ADMIN")
      return { ok: false, error: "Solo el administrador puede ajustar la base" };

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

const rebalanceSchema = z.object({
  hacia: z.enum(["NEQUI", "EFECTIVO"]),
  amount: z.number().int("El monto debe ser un número entero").positive("El monto debe ser mayor a cero"),
});

// Cambio #1 — mover dinero entre la parte en EFECTIVO y la parte en NEQUI de la
// base para consignaciones. NO cambia el total de la base ni el Disponible: es
// solo el reparto interno (la base y el Disponible son independientes, decisión
// del administrador). Valida contra la porción de ORIGEN. Auditado como REBALANCE_BASE.
//
// Cuando el movimiento es Nequi → Efectivo, ese mismo monto se suma además al
// bolsillo "Base para facturas" (decisión del dueño: ese efectivo que sale de la
// base queda apartado para facturas). El sentido contrario (Efectivo → Nequi) NO
// toca ningún bolsillo. Es un ajuste silencioso del saldo inicial del bolsillo
// (mismo patrón que resetNextShiftBalances): sube el total mostrado, sin crear una
// fila nueva en Historial de movimientos; queda trazado en el mismo audit REBALANCE_BASE.
export async function rebalanceBase(
  hacia: "NEQUI" | "EFECTIVO",
  amount: number
): Promise<ActionResult> {
  try {
    const session = await auth();
    if (!session?.user) return { ok: false, error: "No autorizado" };
    if (session.user.role !== "ADMIN")
      return { ok: false, error: "Solo el administrador puede mover la base" };

    const data = rebalanceSchema.parse({ hacia, amount });

    const current = (await prisma.baseFund.findUnique({ where: { id: 1 } })) ?? {
      cashPortion: 0,
      nequiPortion: SALDO_REFERENCIA,
    };

    const origen = data.hacia === "NEQUI" ? current.cashPortion : current.nequiPortion;
    const origenLabel = data.hacia === "NEQUI" ? "efectivo" : "Nequi";
    if (data.amount > origen) {
      return {
        ok: false,
        error: `No hay suficiente en ${origenLabel} de la base (disponible: $${origen.toLocaleString("es-CO")})`,
      };
    }

    const delta = data.hacia === "NEQUI" ? data.amount : -data.amount;
    const newCash = current.cashPortion - delta;
    const newNequi = current.nequiPortion + delta;
    const aBaseFacturas = data.hacia === "EFECTIVO"; // Nequi → Efectivo

    const currentPocket = aBaseFacturas
      ? await prisma.pocketBalance.findUnique({ where: { bucket: "BASE_FACTURAS" } })
      : null;
    const pocketBefore = currentPocket?.openingBalance ?? 0;
    const pocketAfter = pocketBefore + data.amount;

    const fieldChanges: Record<string, { before: unknown; after: unknown }> = {
      efectivo: { before: current.cashPortion, after: newCash },
      nequi: { before: current.nequiPortion, after: newNequi },
    };
    if (aBaseFacturas) {
      fieldChanges["Base para facturas"] = { before: pocketBefore, after: pocketAfter };
    }

    await prisma.$transaction([
      prisma.baseFund.upsert({
        where: { id: 1 },
        update: { cashPortion: newCash, nequiPortion: newNequi },
        create: { id: 1, cashPortion: newCash, nequiPortion: newNequi },
      }),
      ...(aBaseFacturas
        ? [
            prisma.pocketBalance.upsert({
              where: { bucket: "BASE_FACTURAS" },
              update: { openingBalance: { increment: data.amount } },
              create: { bucket: "BASE_FACTURAS", openingBalance: data.amount },
            }),
          ]
        : []),
      prisma.auditLog.create({
        data: {
          action: "REBALANCE_BASE",
          changedById: session.user.id,
          fieldChanges: JSON.stringify(fieldChanges),
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
