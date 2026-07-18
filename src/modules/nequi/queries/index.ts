import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { addDays, diffDays, nowBogotaHHMM, startOfIsoWeek, startOfMonth, todayBogota } from "@/lib/dates";
import { calcularBolsasAcumuladas, type BolsaCierreInput } from "../calculations/bolsas";
import { calcularSaldoCliente, calcularSaldosPorCliente } from "../calculations/clientes";
import { calcularCierreGeneral } from "../calculations/cierreGeneral";
import { sumarConFallback, sumarEfectivoCaja } from "../calculations/cierreGeneralItems";
import { calcularCuadreCaja } from "../calculations/cuadreCajaCierreGeneral";
import { calcularSaldoEsperado } from "../calculations/cuadre";
import {
  agregarCierresDelDia,
  calcularRentabilidadBrutaMensual,
  type CierreDelDia,
} from "../calculations/resumenCierreGeneral";
import {
  aplicarTransferencias,
  calcularRepartoPorMedio,
  calcularSaldoPorBolsillo,
  type PocketResumen,
} from "../calculations/pockets";
import { compararMetricas, promedioMensual, sumarMetricas, type MetricasPeriodo } from "../calculations/tendencias";
import { DEFAULT_SHIFT_CONFIGS, turnoPorHora } from "../calculations/turnos";
import {
  BASE_FIJA_EFECTIVO_CAJA,
  POCKET_BUCKETS,
  type Direction,
  type MovementType,
  type PaymentMethod,
  type PocketBucket,
  type ProveedorTipo,
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
  // Reparto visual Nequi/efectivo solo para Comisiones (no participa en transferencias,
  // así que se calcula antes de aplicarlas sin riesgo de desfase).
  result.COMISION = {
    ...result.COMISION,
    ...calcularRepartoPorMedio(
      "COMISION",
      mapped,
      openingByBucket.get("COMISION") ?? 0,
      openingEfectivoByBucket.get("COMISION") ?? 0
    ),
  };
  return aplicarTransferencias(result, transfers) as Record<PocketBucket, PocketResumen>;
}

const cierreGeneralItemsInclude = {
  gastoItems: {
    include: { categoria: true, proveedorRef: true },
    orderBy: { createdAt: "asc" as const },
  },
  facturaItems: { include: { proveedorRef: true }, orderBy: { createdAt: "asc" as const } },
} satisfies Prisma.CierreGeneralInclude;

type CierreGeneralConItems = Prisma.CierreGeneralGetPayload<{ include: typeof cierreGeneralItemsInclude }>;

// Adapta un registro de CierreGeneral (con sus items) al input de la función pura
// calcularCierreGeneral — usado por getBolsasGenerales y getTendenciasCierreGeneral para no
// repetir la construcción de ventasPorMedio en cada query. facturasPagadas/gastosVarios
// siempre quedan resueltos (números, nunca undefined), por eso también sirve como
// BolsaCierreInput sin conversión adicional.
function cierreInputFromRow(c: CierreGeneralConItems) {
  return {
    ventasPorMedio: {
      EFECTIVO: c.ventaEfectivo,
      NEQUI: c.ventaNequi,
      TARJETA: c.ventaTarjeta,
      DAVIPLATA: c.ventaDaviplata,
      TRANSFERENCIA: c.ventaTransferencia,
      CREDITO: c.ventaCredito,
      OTRO: c.ventaOtro,
    },
    ventaSinFactura: c.ventaSinFactura,
    facturasPagadas: sumarConFallback(c.facturasPagadas, c.facturaItems),
    gastosVarios: sumarConFallback(c.gastosVarios, c.gastoItems),
    realPorMedio: c.realEfectivo != null ? { EFECTIVO: c.realEfectivo } : undefined,
    porcentajeReposicion: (c.porcentajeReposicion ?? 70) / 100, // % congelado del cierre → fracción
  };
}

// Cierre general del turno (date, shift): el registro guardado (con sus gastos/facturas
// itemizados) o null + el saldo Nequi esperado del turno, para la columna Nequi conectada
// al Cierre Nequi.
export async function getCierreGeneral(date: string, shift: Shift) {
  const day = await getOrCreateDay(date, shift);
  const [cierre, { saldoEsperado }] = await Promise.all([
    prisma.cierreGeneral.findUnique({
      where: { businessDayId: day.id },
      include: cierreGeneralItemsInclude,
    }),
    getDaySummary(date, shift),
  ]);
  return { day, cierre, saldoNequiEsperado: saldoEsperado };
}

// Config global del Cierre general (% de reposición y punto de equilibrio). Una sola fila
// (id=1); si aún no existe, devuelve los valores por defecto.
export async function getCierreGeneralConfig() {
  const cfg = await prisma.cierreGeneralConfig.findUnique({ where: { id: 1 } });
  return {
    porcentajeReposicion: cfg?.porcentajeReposicion ?? 70,
    puntoEquilibrio: cfg?.puntoEquilibrio ?? 1_100_000,
  };
}

// Resumen (solo lectura) del Cierre general para el turno (date, shift): la foto del turno
// (venta, retiro, retiro para facturas/gastos, utilidad, cuadre), el punto de equilibrio
// (venta del día = ambos turnos, y promedio del mes), y la rentabilidad bruta acumulada del
// mes con su semáforo. No escribe nada; reutiliza las funciones puras ya testeadas.
export async function getResumenCierreGeneral(date: string) {
  const monthStart = startOfMonth(date);

  const [config, diaDays, mesDays] = await Promise.all([
    getCierreGeneralConfig(),
    getCierreGeneralRange(date, date), // ambos turnos del día → la "foto" es del día
    getCierreGeneralRange(monthStart, date), // cierres del mes hasta la fecha
  ]);

  // --- Bloque DÍA (la cajita) ---
  // Se calcula cada turno por separado y se suman los RESULTADOS (no las ventas): el % de
  // reposición está congelado por cierre, así que dos turnos pueden llevar % distinto.
  const cierresDelDia: CierreDelDia[] = diaDays
    .map((d) => d.cierreGeneral)
    .filter((c): c is CierreGeneralConItems => c !== null)
    .map((c) => {
      const r = calcularCierreGeneral(cierreInputFromRow(c));
      const cuadre = calcularCuadreCaja({
        baseFija: BASE_FIJA_EFECTIVO_CAJA,
        ventaEfectivo: c.ventaEfectivo,
        facturasEnEfectivoCaja: sumarEfectivoCaja(c.facturaItems),
        gastosEnEfectivoCaja: sumarEfectivoCaja(c.gastoItems),
        realEfectivo: c.realEfectivo,
      });
      return {
        ventaTotal: r.ventaTotal,
        retiroCierre: r.retiroCierre,
        reposicionBruta: r.reposicionBruta,
        reposicionNeta: r.reposicionNeta, // 70% − facturas ya pagadas
        margenBruto: r.margenBruto,
        facturasPagadas: r.facturasPagadas,
        gastosVarios: r.gastosVarios,
        consignado: c.consignado,
        descuadre: cuadre.descuadre,
      };
    });

  const dia = agregarCierresDelDia(cierresDelDia);

  // --- Bloque EQUILIBRIO + RENTABILIDAD (mes) ---
  const ventaDia = dia.ventaTotal;
  const diasTranscurridos = Number(date.split("-")[2]);
  const metricasMes = mesDays
    .map((d) => (d.cierreGeneral ? calcularCierreGeneral(cierreInputFromRow(d.cierreGeneral)) : null))
    .filter((r): r is NonNullable<typeof r> => r !== null);
  const ventaMes = metricasMes.reduce((s, r) => s + r.ventaTotal, 0);
  const promedioMes = diasTranscurridos > 0 ? ventaMes / diasTranscurridos : 0;
  const rentabilidad = calcularRentabilidadBrutaMensual(
    metricasMes.map((r) => ({ ventaTotal: r.ventaTotal, utilidadBruta: r.margenBruto }))
  );

  return {
    date,
    hayCierre: dia.turnosConCierre > 0,
    dia,
    equilibrio: { puntoEquilibrio: config.puntoEquilibrio, ventaDia, promedioMes, diasTranscurridos },
    rentabilidad,
    config,
  };
}

// Categorías de gasto (editables por el admin). Por defecto solo las activas.
export async function getCategoriasGasto(soloActivas = true) {
  return prisma.categoriaGasto.findMany({
    where: soloActivas ? { activa: true } : undefined,
    orderBy: { nombre: "asc" },
  });
}

// Proveedores del Cierre general, por tipo (COSTO para facturas, GASTO para gastos).
export async function getProveedores(tipo: ProveedorTipo, soloActivas = true) {
  return prisma.proveedor.findMany({
    where: { tipo, ...(soloActivas ? { activa: true } : {}) },
    orderBy: { nombre: "asc" },
  });
}

// Bolsas acumuladas 70/30: suma reposicionNeta/utilidadDia de TODOS los CierreGeneral
// guardados + el saldo inicial manual de cada bolsa. No toca Movement/pockets.
export async function getBolsasGenerales() {
  const [cierres, bolsas] = await Promise.all([
    prisma.cierreGeneral.findMany({ include: cierreGeneralItemsInclude }),
    prisma.bolsaGeneral.findMany(),
  ]);
  const openingByBucket = new Map(bolsas.map((b) => [b.bucket, b.openingBalance]));
  const cierresInput: BolsaCierreInput[] = cierres.map((c) => cierreInputFromRow(c));
  const { reposicion, gastosUtilidad } = calcularBolsasAcumuladas(
    cierresInput,
    openingByBucket.get("REPOSICION") ?? 0,
    openingByBucket.get("GASTOS_UTILIDAD") ?? 0
  );
  return {
    reposicion,
    gastosUtilidad,
    openingReposicion: openingByBucket.get("REPOSICION") ?? 0,
    openingGastos: openingByBucket.get("GASTOS_UTILIDAD") ?? 0,
  };
}

// Clientes con su saldo pendiente (Σ ventas a crédito − Σ abonos, excluye borrados).
export async function getClientesConSaldo() {
  const [clientes, ventas, abonos] = await Promise.all([
    prisma.cliente.findMany({ orderBy: { nombre: "asc" } }),
    prisma.ventaCredito.findMany({
      where: { deletedAt: null },
      select: { clienteId: true, monto: true },
    }),
    prisma.abonoCredito.findMany({
      where: { deletedAt: null },
      select: { clienteId: true, monto: true },
    }),
  ]);
  const saldos = calcularSaldosPorCliente(ventas, abonos);
  return clientes
    .map((c) => ({ ...c, saldo: saldos.get(c.id) ?? 0 }))
    .sort((a, b) => b.saldo - a.saldo);
}

// Historial de un cliente (ventas a crédito + abonos, más recientes primero) y su saldo.
export async function getClienteDetalle(clienteId: string) {
  const [cliente, ventas, abonos] = await Promise.all([
    prisma.cliente.findUnique({ where: { id: clienteId } }),
    prisma.ventaCredito.findMany({
      where: { clienteId, deletedAt: null },
      include: { createdBy: { select: { name: true } } },
      orderBy: { date: "desc" },
    }),
    prisma.abonoCredito.findMany({
      where: { clienteId, deletedAt: null },
      include: { createdBy: { select: { name: true } } },
      orderBy: { date: "desc" },
    }),
  ]);
  const saldo = calcularSaldoCliente(ventas, abonos);
  return { cliente, ventas, abonos, saldo };
}

// Turnos con Cierre general guardado en un rango de fechas (mismo patrón que
// getDiscrepancies/getDaysRange), para tendencias.
export async function getCierreGeneralRange(from: string, to: string, shift?: Shift) {
  return prisma.businessDay.findMany({
    where: {
      date: { gte: from, lte: to },
      ...(shift ? { shift } : {}),
      cierreGeneral: { isNot: null },
    },
    include: { cierreGeneral: { include: cierreGeneralItemsInclude } },
    orderBy: [{ date: "asc" }, { shift: "asc" }],
  });
}

function metricasDeDay(day: { cierreGeneral: CierreGeneralConItems | null }): MetricasPeriodo {
  if (!day.cierreGeneral) return { venta: 0, utilidadDia: 0, descuadreTotal: 0 };
  const c = day.cierreGeneral;
  const r = calcularCierreGeneral(cierreInputFromRow(c));
  const descuadreTotal = c.realEfectivo != null ? c.realEfectivo - c.ventaEfectivo : 0;
  return { venta: r.base, utilidadDia: r.utilidadDia, descuadreTotal };
}

// Comparativas de tendencia para el turno (date, shift): turno actual vs mismo turno
// anterior (el más reciente con cierre guardado antes de esta fecha), semana actual
// (lunes → date) vs semana anterior comparada a la misma altura (mismo número de días),
// y el promedio mensual de venta (venta del mes ÷ días transcurridos).
export async function getTendenciasCierreGeneral(date: string, shift: Shift) {
  const [turnoActualDay, turnoAnteriorDay] = await Promise.all([
    prisma.businessDay.findUnique({
      where: { date_shift: { date, shift } },
      include: { cierreGeneral: { include: cierreGeneralItemsInclude } },
    }),
    prisma.businessDay.findFirst({
      where: { shift, date: { lt: date }, cierreGeneral: { isNot: null } },
      include: { cierreGeneral: { include: cierreGeneralItemsInclude } },
      orderBy: { date: "desc" },
    }),
  ]);
  const turnoActual = turnoActualDay ? metricasDeDay(turnoActualDay) : { venta: 0, utilidadDia: 0, descuadreTotal: 0 };
  const turnoAnterior = turnoAnteriorDay ? metricasDeDay(turnoAnteriorDay) : { venta: 0, utilidadDia: 0, descuadreTotal: 0 };

  // Semana actual (lunes de esta semana → date) vs. la semana anterior, comparada a la
  // misma altura (mismo número de días transcurridos), no la semana anterior completa.
  const weekStart = startOfIsoWeek(date);
  const diasIntoWeek = diffDays(weekStart, date) + 1;
  const prevWeekStart = addDays(weekStart, -7);
  const prevWeekEnd = addDays(prevWeekStart, diasIntoWeek - 1);

  const [semanaActualDays, semanaAnteriorDays] = await Promise.all([
    getCierreGeneralRange(weekStart, date, shift),
    getCierreGeneralRange(prevWeekStart, prevWeekEnd, shift),
  ]);
  const semanaActual = sumarMetricas(semanaActualDays.map((d) => metricasDeDay(d)));
  const semanaAnterior = sumarMetricas(semanaAnteriorDays.map((d) => metricasDeDay(d)));

  // Promedio mensual: venta del mes hasta la fecha ÷ días transcurridos del mes.
  const monthStart = startOfMonth(date);
  const diasTranscurridos = Number(date.split("-")[2]);
  const mesDays = await getCierreGeneralRange(monthStart, date);
  const ventaMes = mesDays.reduce((sum, d) => sum + metricasDeDay(d).venta, 0);
  const promedioMes = promedioMensual(ventaMes, diasTranscurridos);

  return {
    turno: { actual: turnoActual, anterior: turnoAnterior, comparacion: compararMetricas(turnoActual, turnoAnterior) },
    semana: { actual: semanaActual, anterior: semanaAnterior, comparacion: compararMetricas(semanaActual, semanaAnterior) },
    promedioMes,
    ventaMes,
    diasTranscurridos,
  };
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
