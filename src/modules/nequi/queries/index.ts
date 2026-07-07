import "server-only";
import { prisma } from "@/lib/db";
import { nowBogotaHHMM, todayBogota } from "@/lib/dates";
import { calcularSaldoEsperado } from "../calculations/cuadre";
import {
  aplicarTransferencias,
  calcularSaldoPorBolsillo,
  type PocketResumen,
} from "../calculations/pockets";
import { DEFAULT_SHIFT_CONFIGS, turnoPorHora } from "../calculations/turnos";
import {
  POCKET_BUCKETS,
  type Direction,
  type MovementType,
  type PaymentMethod,
  type PocketBucket,
  type Shift,
} from "../types";
import { getOrCreateDay } from "../server/businessDay";

export type MovementWithUser = Awaited<ReturnType<typeof getDayMovements>>[number];

// Horarios de los turnos (con respaldo a los valores por defecto si falta el seed).
export async function getShiftConfigs() {
  const rows = await prisma.shiftConfig.findMany({ orderBy: { shift: "asc" } });
  if (rows.length > 0) return rows;
  return DEFAULT_SHIFT_CONFIGS.map((c) => ({ ...c, updatedAt: new Date() }));
}

// Turno POR DEFECTO según la hora actual de Bogotá y los horarios configurados.
export async function getCurrentShift(): Promise<Shift> {
  const configs = await getShiftConfigs();
  return turnoPorHora(nowBogotaHHMM(), configs);
}

// Estado de los dos turnos de hoy + turno sugerido (para los formularios de registro).
export async function getTodayShiftInfo() {
  const date = todayBogota();
  const [defaultShift, t1, t2] = await Promise.all([
    getCurrentShift(),
    getOrCreateDay(date, 1),
    getOrCreateDay(date, 2),
  ]);
  return {
    date,
    defaultShift,
    shiftStatus: { 1: t1.status, 2: t2.status } as Record<Shift, string>,
  };
}

export async function getDayMovements(businessDayId: string) {
  return prisma.movement.findMany({
    where: { businessDayId, deletedAt: null },
    include: { registeredBy: { select: { name: true, username: true } } },
    orderBy: { registeredAt: "asc" },
  });
}

export async function getDaySummary(date?: string, shift?: Shift) {
  const day = await getOrCreateDay(date ?? todayBogota(), shift ?? (await getCurrentShift()));
  const movements = await getDayMovements(day.id);

  const totals = new Map<MovementType, { nequi: number; efectivo: number }>();
  for (const m of movements) {
    const t = (totals.get(m.type as MovementType) ?? { nequi: 0, efectivo: 0 });
    if (m.paymentMethod === "NEQUI") t.nequi += m.amount;
    else t.efectivo += m.amount;
    totals.set(m.type as MovementType, t);
  }

  const saldoEsperado =
    day.openingBalance === null
      ? null
      : calcularSaldoEsperado(
          day.openingBalance,
          movements.map((m) => ({
            amount: m.amount,
            direction: m.direction as Direction,
            paymentMethod: m.paymentMethod as PaymentMethod,
          }))
        );

  const pendingCount = movements.filter((m) => m.needsReclassification).length;

  return { day, movements, totals, saldoEsperado, pendingCount };
}

// Movimientos propios del día actual, de ambos turnos (vista de las trabajadoras).
export async function getMyTodayMovements(userId: string) {
  const movements = await prisma.movement.findMany({
    where: {
      businessDay: { date: todayBogota() },
      registeredById: userId,
      deletedAt: null,
    },
    include: { businessDay: { select: { shift: true } } },
    orderBy: { registeredAt: "desc" },
  });
  return { movements };
}

// Retiros/consignaciones propios de hoy (ambos turnos), para enlazar una comisión.
export async function getMyCommissionSources(userId: string) {
  return prisma.movement.findMany({
    where: {
      businessDay: { date: todayBogota() },
      registeredById: userId,
      deletedAt: null,
      type: { in: ["RETIRO_CLIENTE", "CONSIGNACION_CLIENTE"] },
    },
    orderBy: { registeredAt: "desc" },
  });
}

export async function getMovementsRange(from: string, to: string, shift?: Shift) {
  return prisma.movement.findMany({
    where: {
      deletedAt: null,
      businessDay: { date: { gte: from, lte: to }, ...(shift ? { shift } : {}) },
    },
    include: {
      registeredBy: { select: { name: true } },
      businessDay: { select: { date: true, shift: true } },
    },
    orderBy: [{ businessDay: { date: "desc" } }, { registeredAt: "desc" }],
  });
}

export async function getAuditLog(limit = 100) {
  return prisma.auditLog.findMany({
    include: {
      changedBy: { select: { name: true } },
      movement: { select: { type: true, amount: true, note: true } },
      businessDay: { select: { date: true, shift: true } },
    },
    orderBy: { changedAt: "desc" },
    take: limit,
  });
}

// Cambio #5 — turnos cerrados del rango, para la lista de descuadres del Cierre.
// El descuadre es DERIVADO: closingRealBalance − closingExpectedBalance (el
// snapshot del esperado se guarda al cerrar). Cierres previos a esta mejora no
// tienen snapshot (null) y se muestran sin descuadre calculable.
export async function getDiscrepancies(from: string, to: string, shift?: Shift) {
  return prisma.businessDay.findMany({
    where: {
      status: "CLOSED",
      date: { gte: from, lte: to },
      ...(shift ? { shift } : {}),
    },
    include: { closedBy: { select: { name: true } } },
    orderBy: [{ date: "desc" }, { shift: "desc" }],
  });
}

// Bolsillos organizativos ("Tus Bolsillos"): acumulado histórico por bucket (movimientos
// marcados + transferencias entre bolsillos aplicadas). NO afecta el cuadre de Nequi.
export async function getPockets(): Promise<Record<PocketBucket, PocketResumen>> {
  const [rows, transfers, balances] = await Promise.all([
    prisma.movement.findMany({
      where: { deletedAt: null, pettyCashBucket: { not: null } },
      select: { amount: true, direction: true, pettyCashBucket: true },
    }),
    prisma.pocketTransfer.findMany({ select: { fromBucket: true, toBucket: true, amount: true } }),
    prisma.pocketBalance.findMany({ select: { bucket: true, openingBalance: true } }),
  ]);
  const openingByBucket = new Map(balances.map((b) => [b.bucket, b.openingBalance]));
  const result = {} as Record<PocketBucket, PocketResumen>;
  for (const bucket of POCKET_BUCKETS) {
    result[bucket] = calcularSaldoPorBolsillo(
      bucket,
      rows.map((r) => ({
        amount: r.amount,
        direction: r.direction as Direction,
        pettyCashBucket: r.pettyCashBucket,
      })),
      openingByBucket.get(bucket) ?? 0
    );
  }
  return aplicarTransferencias(result, transfers) as Record<PocketBucket, PocketResumen>;
}

export async function getPocketTransfers(limit = 50) {
  return prisma.pocketTransfer.findMany({
    include: { createdBy: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export async function getSellers() {
  return prisma.user.findMany({
    where: { role: "WORKER" },
    select: { id: true, username: true, name: true, isActive: true },
    orderBy: { username: "asc" },
  });
}

export async function getBaseFund() {
  const fund = await prisma.baseFund.findUnique({ where: { id: 1 } });
  return fund ?? { id: 1, cashPortion: 0, nequiPortion: 1_110_000, updatedAt: new Date() };
}

export async function getDaysRange(from: string, to: string) {
  return prisma.businessDay.findMany({
    where: { date: { gte: from, lte: to } },
    orderBy: [{ date: "asc" }, { shift: "asc" }],
    include: {
      movements: {
        where: { deletedAt: null },
        include: { registeredBy: { select: { name: true } } },
        orderBy: { registeredAt: "asc" },
      },
    },
  });
}
