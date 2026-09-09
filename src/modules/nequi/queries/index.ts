import "server-only";
import { prisma } from "@/lib/db";
import { dayOfWeek, nowBogotaHHMM, todayBogota } from "@/lib/dates";
import { calcularSaldoEsperado } from "../calculations/cuadre";
import {
  aplicarTransferencias,
  calcularRepartoPorMedio,
  calcularSaldoPorBolsillo,
  type PocketResumen,
} from "../calculations/pockets";
import { DEFAULT_SHIFT_CONFIGS, esDiaTurnoUnico, turnoPorHora } from "../calculations/turnos";
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

// Horarios de los turnos. SIEMPRE devuelve los dos: al que le falte fila en la BD se le
// completa con su valor por defecto. Antes, si existía la fila del turno 1 pero no la del 2,
// se devolvía solo la del 1 — y como Configuración dibuja una tarjeta por fila, el turno 2
// no se podía configurar desde la web (quedaba con un horario por defecto invisible que
// nadie había elegido). turnoPorHora ya hacía este mismo respaldo por su cuenta.
export async function getShiftConfigs() {
  const rows = await prisma.shiftConfig.findMany({ orderBy: { shift: "asc" } });
  return DEFAULT_SHIFT_CONFIGS.map(
    (def) => rows.find((r) => r.shift === def.shift) ?? { ...def, updatedAt: new Date() }
  );
}

// Días de la semana marcados como "turno único" (ej. domingo): ese día el turno se queda
// fijo en 1, sin sugerir el 2 por la hora. Sin filas (BD sin sembrar) → ningún día lo es.
export async function getDiasTurnoUnico() {
  return prisma.diaTurnoUnico.findMany({ orderBy: { dayOfWeek: "asc" } });
}

// Turno POR DEFECTO según la hora actual de Bogotá y los horarios configurados — salvo que
// hoy sea un día marcado como "turno único", en cuyo caso siempre es el 1 (ver
// esDiaTurnoUnico). Sigue siendo solo una SUGERENCIA: quien registra puede cambiar a mano.
export async function getCurrentShift(): Promise<Shift> {
  const [configs, dias] = await Promise.all([getShiftConfigs(), getDiasTurnoUnico()]);
  if (esDiaTurnoUnico(dayOfWeek(todayBogota()), dias)) return 1;
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

// Saldo real del último turno CERRADO anterior en el calendario (…T2 ayer → T1 hoy → T2 hoy).
async function saldoInicialHeredado(date: string, shift: Shift): Promise<number | null> {
  const lastClosed = await prisma.businessDay.findFirst({
    where: {
      status: "CLOSED",
      OR: [{ date: { lt: date } }, { date, shift: { lt: shift } }],
    },
    orderBy: [{ date: "desc" }, { shift: "desc" }],
    select: { closingRealBalance: true },
  });
  return lastClosed?.closingRealBalance ?? null;
}

// ¿Alguien fijó/editó a mano el saldo inicial de este turno? (así la herencia
// automática no pisa una corrección manual ni un reset del próximo turno).
async function saldoInicialEsManual(businessDayId: string): Promise<boolean> {
  const manual = await prisma.auditLog.findFirst({
    where: {
      businessDayId,
      OR: [
        { action: "RESET_BALANCES" },
        { action: "UPDATE", fieldChanges: { contains: "saldoInicial" } },
      ],
    },
    select: { id: true },
  });
  return manual !== null;
}

export async function getDaySummary(date?: string, shift?: Shift) {
  const day = await getOrCreateDay(date ?? todayBogota(), shift ?? (await getCurrentShift()));

  // Herencia VIVA del saldo inicial: si el turno está abierto y nadie lo fijó a mano,
  // siempre refleja el saldo real del último turno cerrado anterior (no una foto que
  // se congeló al crear el turno). Se persiste para que el cierre y el esperado cuadren.
  if (day.status === "OPEN" && !(await saldoInicialEsManual(day.id))) {
    const heredado = await saldoInicialHeredado(day.date, day.shift as Shift);
    if (heredado !== null && heredado !== day.openingBalance) {
      await prisma.businessDay.update({
        where: { id: day.id },
        data: { openingBalance: heredado },
      });
      day.openingBalance = heredado;
    }
  }

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
      select: { amount: true, direction: true, pettyCashBucket: true, paymentMethod: true },
    }),
    prisma.pocketTransfer.findMany({ select: { fromBucket: true, toBucket: true, amount: true } }),
    prisma.pocketBalance.findMany({
      select: { bucket: true, openingBalance: true, openingEfectivo: true },
    }),
  ]);
  const openingByBucket = new Map(balances.map((b) => [b.bucket, b.openingBalance]));
  const openingEfectivoByBucket = new Map(balances.map((b) => [b.bucket, b.openingEfectivo]));
  const mapped = rows.map((r) => ({
    amount: r.amount,
    direction: r.direction as Direction,
    pettyCashBucket: r.pettyCashBucket,
    paymentMethod: r.paymentMethod as PaymentMethod,
  }));
  const result = {} as Record<PocketBucket, PocketResumen>;
  for (const bucket of POCKET_BUCKETS) {
    result[bucket] = calcularSaldoPorBolsillo(
      bucket,
      mapped,
      openingByBucket.get(bucket) ?? 0,
      openingEfectivoByBucket.get(bucket) ?? 0
    );
  }
  const afterTransfers = aplicarTransferencias(result, transfers) as Record<PocketBucket, PocketResumen>;
  // Reparto Nequi/efectivo de CADA bolsillo (antes solo Comisiones). La porción en efectivo se
  // deriva de los movimientos + saldo inicial (medio de pago real); la porción Nequi es el resto
  // del disponible ya transferido, así el invariante nequi + efectivo = disponible se mantiene.
  // Con esto calcularApartadoEnBolsillos aparta solo la porción Nequi de cada bolsillo: una venta
  // de licores en efectivo (flujo normal) ya NO baja el disponible de Nequi.
  //
  // LIMITACIÓN CONOCIDA: transferPocketFunds mueve el disponible TOTAL de un bolsillo (incluye su
  // efectivo). Si el admin transfiere a mano la parte en efectivo de un bolsillo hacia OTRO bolsillo
  // real, el destino la verá como Nequi (el reparto por medio no sigue transferencias) y volvería a
  // bajar el disponible. Es una acción manual poco común y fuera del flujo diario; el fix pendiente
  // sería que las transferencias operen/validen sobre la porción Nequi. Ver reporte /superfable 2026-08-10.
  for (const bucket of POCKET_BUCKETS) {
    const { efectivo } = calcularRepartoPorMedio(
      bucket,
      mapped,
      openingByBucket.get(bucket) ?? 0,
      openingEfectivoByBucket.get(bucket) ?? 0
    );
    afterTransfers[bucket] = {
      ...afterTransfers[bucket],
      efectivo,
      nequi: afterTransfers[bucket].disponible - efectivo,
    };
  }
  return afterTransfers;
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
