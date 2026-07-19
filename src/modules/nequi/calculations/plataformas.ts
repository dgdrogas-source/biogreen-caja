// Saldos por plataforma del Cierre general (2026-07-17). Ver el diseño en CLAUDE.md.
//
// La dueña ya tiene las bolsas 70/30 como MONTO; esto le dice EN QUÉ CUENTA está esa plata.
// Se calcula en caliente (como las bolsas): saldo corrido acumulado sobre TODO el histórico.
//
// Plataformas seguidas: SOBRE_BLANCO, NEQUI, BANCO, DAVIPLATA. La caja principal NO entra
// (es operativa, se cuadra por turno). La tarjeta tampoco es plataforma: es un "pendiente de
// abono" (el banco paga la venta en neto, venta − 4%, al día siguiente).
//
// Reglas confirmadas por la dueña:
//   - Sobre blanco = inicial + Σ retiroCierre − Σ pagos EFECTIVO_SOBRE.
//   - Nequi/Banco/Daviplata = inicial + ventas de ese medio − pagos por ese método
//     − transferencias salientes (monto + su 4x1000) + transferencias entrantes.
//   - Banco recibe además los abonos de tarjeta confirmados (en neto).
//   - Tarjeta pendiente = Σ(venta tarjeta × (1 − comisión)) − Σ abonos.
//   - Solo cuenta lo que ya tiene en la mano: la tarjeta NO abonada no suma a ninguna cuenta.

import { COMISION_TARJETA, PLATAFORMAS, type Plataforma } from "../types";

// Un cierre, reducido a lo que necesita el cálculo por plataforma.
export interface CierrePlataformaInput {
  ventaNequi: number;
  ventaTarjeta: number;
  ventaDaviplata: number;
  ventaTransferencia: number;
  retiroCierre: number; // efectivo retirado al cierre = lo que va al sobre blanco
  // Pagos (gastos + facturas) de ESE cierre, con su método. metodoPago null = EFECTIVO_CAJA.
  pagos: { monto: number; metodoPago: string | null }[];
}

export interface TransferenciaInput {
  fromPlataforma: string;
  toPlataforma: string;
  monto: number;
  impuesto4x1000: number;
}

export interface PlataformasInput {
  cierres: CierrePlataformaInput[];
  transferencias: TransferenciaInput[];
  abonosTarjeta: number[]; // montos netos confirmados
  saldosIniciales: Partial<Record<Plataforma, number>>;
  // Corrige lo que se MUESTRA como "pendiente" el día que se activa esta función (Fase 2,
  // 2026-07-17): sin esto, el pendiente sumaría TODA la venta histórica con tarjeta como si
  // nunca se hubiera abonado. Se resta del pendiente calculado; NO toca ninguna plataforma.
  ajustePendienteInicial?: number;
}

export interface SaldoPlataforma {
  plataforma: Plataforma;
  saldo: number;
}

export interface PlataformasResumen {
  saldos: SaldoPlataforma[];
  tarjetaPendiente: number; // neto que el banco aún no ha abonado (no disponible todavía)
  totalDisponible: number; // suma de las 4 plataformas (lo que sí tiene en la mano)
}

// A qué plataforma seguida afecta un pago según su método. Los métodos que no tocan una
// plataforma seguida devuelven null:
//   EFECTIVO_CAJA → caja principal (no seguida aquí);
//   DESCONTADO_ORIGEN → nada (el 4% de tarjeta ya lo descontó el banco);
//   DATAFONO / OTRO → sin plataforma definida (poco usados; se ignoran a propósito).
function plataformaDePago(metodoPago: string | null): Plataforma | null {
  switch (metodoPago) {
    case "EFECTIVO_SOBRE":
      return "SOBRE_BLANCO";
    case "NEQUI":
      return "NEQUI";
    case "DAVIPLATA":
      return "DAVIPLATA";
    case "TRANSFERENCIA":
      return "BANCO";
    default:
      return null; // EFECTIVO_CAJA (null incluido), DESCONTADO_ORIGEN, DATAFONO, OTRO
  }
}

export function calcularSaldosPlataforma(input: PlataformasInput): PlataformasResumen {
  const saldo: Record<Plataforma, number> = {
    SOBRE_BLANCO: input.saldosIniciales.SOBRE_BLANCO ?? 0,
    NEQUI: input.saldosIniciales.NEQUI ?? 0,
    BANCO: input.saldosIniciales.BANCO ?? 0,
    DAVIPLATA: input.saldosIniciales.DAVIPLATA ?? 0,
  };

  let ventaTarjetaNetaTotal = 0;

  for (const c of input.cierres) {
    // Entradas por venta (la tarjeta NO entra aquí: va a "pendiente" hasta que la abonen).
    saldo.NEQUI += c.ventaNequi;
    saldo.DAVIPLATA += c.ventaDaviplata;
    saldo.BANCO += c.ventaTransferencia;
    saldo.SOBRE_BLANCO += c.retiroCierre;
    ventaTarjetaNetaTotal += Math.round(c.ventaTarjeta * (1 - COMISION_TARJETA));

    // Salidas por pagos, según el método de cada gasto/factura.
    for (const p of c.pagos) {
      const plat = plataformaDePago(p.metodoPago);
      if (plat) saldo[plat] -= p.monto;
    }
  }

  // Abonos de tarjeta confirmados → entran al banco (en neto).
  const abonosTotal = input.abonosTarjeta.reduce((s, m) => s + m, 0);
  saldo.BANCO += abonosTotal;

  // Movimientos entre plataformas: el origen pierde monto + su 4x1000; el destino gana monto.
  for (const t of input.transferencias) {
    if (isPlataforma(t.fromPlataforma)) saldo[t.fromPlataforma] -= t.monto + t.impuesto4x1000;
    if (isPlataforma(t.toPlataforma)) saldo[t.toPlataforma] += t.monto;
  }

  const tarjetaPendiente = Math.max(
    0,
    ventaTarjetaNetaTotal - abonosTotal - (input.ajustePendienteInicial ?? 0)
  );
  const saldos = PLATAFORMAS.map((p) => ({ plataforma: p, saldo: saldo[p] }));
  const totalDisponible = saldos.reduce((s, x) => s + x.saldo, 0);

  return { saldos, tarjetaPendiente, totalDisponible };
}

function isPlataforma(x: string): x is Plataforma {
  return (PLATAFORMAS as readonly string[]).includes(x);
}
