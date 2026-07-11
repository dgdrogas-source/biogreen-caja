"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { calcularSaldoEsperado } from "../calculations/cuadre";
import { turnoSiguiente } from "../calculations/turnos";
import {
  POCKET_BUCKETS,
  POCKET_LABELS,
  SHIFT_LABELS,
  type Direction,
  type PaymentMethod,
  type Shift,
} from "../types";
import { getOrCreateDay } from "../server/businessDay";
import { getPockets } from "../queries";

export type ActionResult = { ok: true } | { ok: false; error: string };

async function requireAdminSession() {
  const session = await auth();
  if (!session?.user) throw new Error("No autorizado");
  if (session.user.role !== "ADMIN") throw new Error("Solo el administrador puede hacer esto");
  return session.user;
}

const balanceSchema = z.number().int().nonnegative("El saldo no puede ser negativo");
const shiftSchema = z.union([z.literal(1), z.literal(2)]);

// Definir el saldo inicial (primer uso, o corrección de un turno abierto).
export async function setOpeningBalance(
  date: string,
  shift: Shift,
  amount: number
): Promise<ActionResult> {
  try {
    const user = await requireAdminSession();
    const value = balanceSchema.parse(amount);
    const s = shiftSchema.parse(shift);
    const day = await getOrCreateDay(date, s);
    if (day.status === "CLOSED") return { ok: false, error: "El turno está cerrado, reábrelo primero" };

    await prisma.$transaction([
      prisma.businessDay.update({ where: { id: day.id }, data: { openingBalance: value } }),
      prisma.auditLog.create({
        data: {
          businessDayId: day.id,
          action: "UPDATE",
          changedById: user.id,
          fieldChanges: JSON.stringify({
            saldoInicial: { before: day.openingBalance, after: value },
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

// Cierra el turno guardando el saldo real Y un snapshot del esperado (para el
// descuadre, cambio #5). Además propaga el saldo real como saldo inicial del
// turno sucesor si este ya existe, sigue abierto y nadie le fijó un saldo
// inicial a mano (así la herencia no se congela si el sucesor se creó antes
// de tiempo, y un reset o edición manual nunca se pisa).
export async function closeDay(
  date: string,
  shift: Shift,
  realBalance: number
): Promise<ActionResult> {
  try {
    const user = await requireAdminSession();
    const value = balanceSchema.parse(realBalance);
    const s = shiftSchema.parse(shift);
    const day = await getOrCreateDay(date, s);
    if (day.status === "CLOSED") return { ok: false, error: "Este turno ya está cerrado" };
    if (day.openingBalance === null)
      return { ok: false, error: "Define primero el saldo inicial del turno" };

    const movements = await prisma.movement.findMany({
      where: { businessDayId: day.id, deletedAt: null },
      select: { amount: true, direction: true, paymentMethod: true },
    });
    const expected = calcularSaldoEsperado(
      day.openingBalance,
      movements.map((m) => ({
        amount: m.amount,
        direction: m.direction as Direction,
        paymentMethod: m.paymentMethod as PaymentMethod,
      }))
    );

    // ¿Se puede propagar el cierre real al turno sucesor?
    const next = turnoSiguiente(date, s);
    const successor = await prisma.businessDay.findUnique({
      where: { date_shift: { date: next.date, shift: next.shift } },
    });
    let propagateToId: string | null = null;
    if (successor && successor.status === "OPEN") {
      const manual = await prisma.auditLog.findFirst({
        where: {
          businessDayId: successor.id,
          OR: [
            { action: "RESET_BALANCES" },
            { action: "UPDATE", fieldChanges: { contains: "saldoInicial" } },
          ],
        },
        select: { id: true },
      });
      if (!manual) propagateToId = successor.id;
    }

    const ops: Prisma.PrismaPromise<unknown>[] = [
      prisma.businessDay.update({
        where: { id: day.id },
        data: {
          closingRealBalance: value,
          closingExpectedBalance: expected,
          status: "CLOSED",
          closedAt: new Date(),
          closedById: user.id,
        },
      }),
      prisma.auditLog.create({
        data: {
          businessDayId: day.id,
          action: "CLOSE_DAY",
          changedById: user.id,
          fieldChanges: JSON.stringify({
            saldoReal: { before: null, after: value },
            saldoEsperado: { before: null, after: expected },
            descuadre: { before: null, after: value - expected },
          }),
        },
      }),
    ];
    if (propagateToId) {
      ops.push(
        prisma.businessDay.update({
          where: { id: propagateToId },
          data: { openingBalance: value },
        })
      );
    }
    await prisma.$transaction(ops);

    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado" };
  }
}

export async function reopenDay(date: string, shift: Shift): Promise<ActionResult> {
  try {
    const user = await requireAdminSession();
    const s = shiftSchema.parse(shift);
    const day = await prisma.businessDay.findUnique({
      where: { date_shift: { date, shift: s } },
    });
    if (!day) return { ok: false, error: "Ese turno no existe" };
    if (day.status !== "CLOSED") return { ok: false, error: "Ese turno no está cerrado" };

    await prisma.$transaction([
      prisma.businessDay.update({
        where: { id: day.id },
        data: { status: "OPEN", closedAt: null, closedById: null },
      }),
      prisma.auditLog.create({
        data: {
          businessDayId: day.id,
          action: "REOPEN_DAY",
          changedById: user.id,
          fieldChanges: JSON.stringify({
            estado: { before: "CLOSED", after: "OPEN" },
            saldoRealAlCierre: { before: day.closingRealBalance, after: day.closingRealBalance },
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

const resetSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida"),
  shift: shiftSchema,
  nequiOpening: z.number().int().nonnegative("El saldo no puede ser negativo"),
  pocketTargets: z
    .array(
      z.object({
        bucket: z.enum(POCKET_BUCKETS),
        target: z.number().int().nonnegative("El saldo no puede ser negativo"),
      })
    )
    .optional(),
  // Reparto de la base para consignaciones (opcional): cuánto en Nequi y cuánto en efectivo.
  baseNequi: z.number().int().nonnegative("El saldo no puede ser negativo").optional(),
  baseEfectivo: z.number().int().nonnegative("El saldo no puede ser negativo").optional(),
  // Reparto del bolsillo Comisiones (opcional): cuánto en Nequi y cuánto en efectivo.
  comisionNequi: z.number().int().nonnegative("El saldo no puede ser negativo").optional(),
  comisionEfectivo: z.number().int().nonnegative("El saldo no puede ser negativo").optional(),
});

export type ResetBalancesInput = z.infer<typeof resetSchema>;

// Cambio #7 — "Ajustar saldos iniciales del próximo turno" (recuperación ante un
// descuadre extremo). NO borra ningún movimiento: fija el saldo Nequi inicial del
// turno SUCESOR de (date, shift) y, opcionalmente, deja cada bolsillo indicado en
// el valor pedido (ajustando su saldo inicial manual por la diferencia, igual que
// el ajuste de Comisiones). Auditado como RESET_BALANCES; ese registro además
// evita que un cierre posterior del turno actual pise estos valores.
export async function resetNextShiftBalances(input: ResetBalancesInput): Promise<ActionResult> {
  try {
    const user = await requireAdminSession();
    const data = resetSchema.parse(input);

    const next = turnoSiguiente(data.date, data.shift);
    const day = await getOrCreateDay(next.date, next.shift);
    if (day.status === "CLOSED")
      return { ok: false, error: `El ${SHIFT_LABELS[next.shift]} del ${next.date} ya está cerrado` };

    const changes: Record<string, { before: unknown; after: unknown }> = {
      turno: { before: null, after: `${next.date} · ${SHIFT_LABELS[next.shift]}` },
      saldoNequiInicial: { before: day.openingBalance, after: data.nequiOpening },
    };

    const ops: Prisma.PrismaPromise<unknown>[] = [
      prisma.businessDay.update({
        where: { id: day.id },
        data: { openingBalance: data.nequiOpening },
      }),
    ];

    const comisionSplit =
      data.comisionNequi !== undefined && data.comisionEfectivo !== undefined;
    const necesitaPockets = (data.pocketTargets && data.pocketTargets.length > 0) || comisionSplit;
    const pockets = necesitaPockets ? await getPockets() : null;

    if (pockets && data.pocketTargets && data.pocketTargets.length > 0) {
      for (const { bucket, target } of data.pocketTargets) {
        if (bucket === "COMISION") continue; // Comisiones se maneja con su reparto abajo
        const current = pockets[bucket];
        // disponible = saldoInicial + neto(movimientos + transferencias) →
        // para que quede exactamente en `target` sin tocar movimientos, el
        // nuevo saldo inicial absorbe el neto (puede quedar negativo, y está bien).
        const neto = current.disponible - current.openingBalance;
        const newBaseline = target - neto;
        if (target === current.disponible) continue; // sin cambio real
        ops.push(
          prisma.pocketBalance.upsert({
            where: { bucket },
            update: { openingBalance: newBaseline },
            create: { bucket, openingBalance: newBaseline },
          })
        );
        changes[POCKET_LABELS[bucket]] = { before: current.disponible, after: target };
      }
    }

    // Comisiones: fijar su reparto Nequi/efectivo. El saldo inicial de cada lado absorbe
    // el neto de movimientos de ese medio, para que el mostrado quede exacto sin tocar movimientos.
    if (pockets && comisionSplit) {
      const c = pockets.COMISION;
      const beforeNequi = c.nequi ?? c.disponible;
      const beforeEfectivo = c.efectivo ?? 0;
      if (data.comisionNequi !== beforeNequi || data.comisionEfectivo !== beforeEfectivo) {
        const netoNequi = beforeNequi - c.openingBalance; // Σ movimientos Nequi de comisiones
        const netoEfectivo = beforeEfectivo - c.openingEfectivo; // Σ movimientos efectivo
        ops.push(
          prisma.pocketBalance.upsert({
            where: { bucket: "COMISION" },
            update: {
              openingBalance: (data.comisionNequi as number) - netoNequi,
              openingEfectivo: (data.comisionEfectivo as number) - netoEfectivo,
            },
            create: {
              bucket: "COMISION",
              openingBalance: (data.comisionNequi as number) - netoNequi,
              openingEfectivo: (data.comisionEfectivo as number) - netoEfectivo,
            },
          })
        );
        changes["Comisiones · Nequi"] = { before: beforeNequi, after: data.comisionNequi };
        changes["Comisiones · efectivo"] = { before: beforeEfectivo, after: data.comisionEfectivo };
      }
    }

    // Base para consignaciones: fijar su reparto Nequi/efectivo (solo si cambió).
    if (data.baseNequi !== undefined && data.baseEfectivo !== undefined) {
      const base = await prisma.baseFund.findUnique({ where: { id: 1 } });
      const beforeNequi = base?.nequiPortion ?? 0;
      const beforeEfectivo = base?.cashPortion ?? 0;
      if (data.baseNequi !== beforeNequi || data.baseEfectivo !== beforeEfectivo) {
        ops.push(
          prisma.baseFund.upsert({
            where: { id: 1 },
            update: { nequiPortion: data.baseNequi, cashPortion: data.baseEfectivo },
            create: { id: 1, nequiPortion: data.baseNequi, cashPortion: data.baseEfectivo },
          })
        );
        changes["Base para consignaciones · Nequi"] = { before: beforeNequi, after: data.baseNequi };
        changes["Base para consignaciones · efectivo"] = { before: beforeEfectivo, after: data.baseEfectivo };
      }
    }

    ops.push(
      prisma.auditLog.create({
        data: {
          businessDayId: day.id,
          action: "RESET_BALANCES",
          changedById: user.id,
          fieldChanges: JSON.stringify(changes),
        },
      })
    );

    await prisma.$transaction(ops);
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    if (e instanceof z.ZodError) return { ok: false, error: e.issues[0]?.message ?? "Datos inválidos" };
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado" };
  }
}
