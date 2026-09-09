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

// Confirmación de Cuenta Corriente más reciente antes de `date`: su fecha Y su saldo real.
// La fecha importa tanto como el monto — es el ancla de la cadena. Si la mamá lleva días sin
// confirmar (viaje, fin de semana), el esperado de hoy debe sumar los movimientos de TODO
// ese hueco, no solo los de hoy. Devuelve null si nunca se ha confirmado un saldo (no hay
// ancla → no se puede calcular un esperado; la UI pide confirmar uno para empezar).
export async function getUltimaConfirmacionCC(
  beforeDate: string
): Promise<{ date: string; saldoRealCC: number } | null> {
  const anterior = await prisma.cierreDiario.findFirst({
    where: { date: { lt: beforeDate }, saldoRealCC: { not: null } },
    orderBy: { date: "desc" },
    select: { date: true, saldoRealCC: true },
  });
  if (!anterior || anterior.saldoRealCC == null) return null;
  return { date: anterior.date, saldoRealCC: anterior.saldoRealCC };
}

// Venta por transferencia bancaria (ambos turnos, vía Parte de Turno) en el rango [desde, hasta]
// inclusive — alimenta el esperado de Cuenta Corriente. Rango, no un día, para tolerar huecos
// de días sin confirmar.
export async function getVentasTransferenciaRango(desde: string, hasta: string): Promise<number> {
  const partes = await prisma.parteTurno.findMany({
    where: { businessDay: { date: { gte: desde, lte: hasta } } },
    select: { ventaTransferencia: true },
  });
  return partes.reduce((s, p) => s + p.ventaTransferencia, 0);
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

// Tarjeta que se calzó en el rango [desde, hasta] inclusive (consignaciones confirmadas cuyo
// fechaConsignado cae ahí), sin importar de qué día venía vendida — alimenta "tarjeta llegada"
// del esperado de Cuenta Corriente. Rango para tolerar huecos de días sin confirmar.
export async function getTarjetaLlegadaRango(desde: string, hasta: string): Promise<number> {
  const filas = await prisma.cierreDiarioPendienteTarjeta.findMany({
    where: { resuelto: true, fechaConsignado: { gte: desde, lte: hasta } },
    select: { montoConsignado: true },
  });
  return filas.reduce((s, f) => s + (f.montoConsignado ?? 0), 0);
}

// Movimientos manuales en el rango [desde, hasta] inclusive. Con desde == hasta es "los de
// hoy"; con un rango más ancho, todo el hueco de días sin confirmar (lo que realmente alimenta
// el esperado de Cuenta Corriente). "Agregar" en la UI siempre apunta a hoy.
export async function getMovimientosManualesRango(desde: string, hasta: string) {
  return prisma.cierreDiarioMovimientoManual.findMany({
    where: { date: { gte: desde, lte: hasta } },
    include: { createdBy: { select: { name: true } } },
    orderBy: [{ date: "asc" }, { createdAt: "asc" }],
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
