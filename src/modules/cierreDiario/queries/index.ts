import "server-only";
import { prisma } from "@/lib/db";
import { addDays } from "@/lib/dates";
import type { ProveedorTipo } from "@/modules/nequi/types";

// Catálogos (movidos aquí desde nequi/queries — Cierre General ya no existe, pero
// Parte de Turno sigue necesitando categorías y proveedores para registrar gastos/facturas).

export async function getCategoriasGasto(soloActivas = true) {
  return prisma.categoriaGasto.findMany({
    where: soloActivas ? { activa: true } : undefined,
    orderBy: { nombre: "asc" },
  });
}

export async function getProveedores(tipo: ProveedorTipo, soloActivas = true) {
  return prisma.proveedor.findMany({
    where: { tipo, ...(soloActivas ? { activa: true } : {}) },
    orderBy: { nombre: "asc" },
  });
}

// Cierre Diario propiamente dicho (comparación banco vs. Dominium).

export async function getCierreDiario(date: string) {
  return prisma.cierreDiario.findUnique({ where: { date } });
}

// Saldo confirmado más reciente antes de `date` (para encadenar "saldo confirmado ayer").
export async function getUltimoSaldoConfirmadoCC(beforeDate: string): Promise<number | null> {
  const anterior = await prisma.cierreDiario.findFirst({
    where: { date: { lt: beforeDate }, saldoRealCC: { not: null } },
    orderBy: { date: "desc" },
    select: { saldoRealCC: true },
  });
  return anterior?.saldoRealCC ?? null;
}

export async function getDatafono(date: string) {
  return prisma.cierreDiarioDatafono.findUnique({
    where: { date },
    include: { franquicias: true },
  });
}

// Pendientes de tarjeta sin resolver, más antiguos primero.
export async function getPendientesTarjeta() {
  return prisma.cierreDiarioPendienteTarjeta.findMany({
    where: { resuelto: false },
    orderBy: { dateOrigen: "asc" },
  });
}

// Pendientes cuya fecha estimada de llegada (día hábil siguiente, o +1 si hay festivo/fin de
// semana de por medio) ya debería haber pasado — se usa para la clasificación automática de
// diferencias. Estimación simple: 3 días de calendario desde el origen es margen suficiente
// para cubrir "viernes → lunes" sin tener que modelar festivos.
export async function getPendientesVencidos(date: string) {
  const limite = addDays(date, -3);
  return prisma.cierreDiarioPendienteTarjeta.findMany({
    where: { resuelto: false, dateOrigen: { lte: limite } },
    orderBy: { dateOrigen: "asc" },
  });
}

// Tarjeta que se calzó HOY (consignaciones confirmadas con fechaConsignado = date), sin
// importar de qué día venía vendida — es lo que alimenta "tarjeta llegada hoy" en el saldo
// en cadena de Cuenta Corriente.
export async function getTarjetaLlegadaHoy(date: string): Promise<number> {
  const filas = await prisma.cierreDiarioPendienteTarjeta.findMany({
    where: { resuelto: true, fechaConsignado: date },
    select: { montoConsignado: true },
  });
  return filas.reduce((s, f) => s + (f.montoConsignado ?? 0), 0);
}

export async function getMovimientosManuales(date: string) {
  return prisma.cierreDiarioMovimientoManual.findMany({
    where: { date },
    include: { createdBy: { select: { name: true } } },
    orderBy: { createdAt: "asc" },
  });
}

// Venta por medio de pago del día (ambos turnos, vía Parte de Turno) que alimenta a Cierre
// Diario: Tarjeta Crédito/Débito y Transferencia → Cuenta Corriente; Daviplata → Daviplata.
// Crédito(fiado) y Nequi también se traen para mostrarlos como registro, pero no participan
// en ningún cálculo de saldo (ver PROCESO-CIERRE-DIARIO.md).
export async function getVentasDelDia(date: string) {
  const partes = await prisma.parteTurno.findMany({
    where: { businessDay: { date } },
    select: {
      businessDay: { select: { shift: true } },
      ventaTarjeta: true,
      ventaTarjetaDebito: true,
      ventaTransferencia: true,
      ventaDaviplata: true,
      ventaCredito: true,
      ventaNequi: true,
    },
  });

  const totales = partes.reduce(
    (acc, p) => ({
      tarjetaCredito: acc.tarjetaCredito + p.ventaTarjeta,
      tarjetaDebito: acc.tarjetaDebito + p.ventaTarjetaDebito,
      transferencia: acc.transferencia + p.ventaTransferencia,
      daviplata: acc.daviplata + p.ventaDaviplata,
      credito: acc.credito + p.ventaCredito,
      nequi: acc.nequi + p.ventaNequi,
    }),
    { tarjetaCredito: 0, tarjetaDebito: 0, transferencia: 0, daviplata: 0, credito: 0, nequi: 0 }
  );

  return {
    ...totales,
    tarjetaTotal: totales.tarjetaCredito + totales.tarjetaDebito,
    turnosRegistrados: partes.map((p) => p.businessDay.shift),
  };
}
