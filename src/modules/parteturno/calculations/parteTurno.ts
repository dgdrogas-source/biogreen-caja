// Cálculos puros del parte de turno. Sin BD, sin Prisma: todo se testea directo.
//
// Desde 2026-09-09 este archivo es autocontenido: ya no depende de las funciones de Cierre
// General (retirado — ver .claude/PLAN-CIERRE-DIARIO-IMPLEMENTACION.md). El cuadre de caja
// física (calcularCuadreCaja) vive aquí mismo, copiado sin cambios de lo que antes era
// nequi/calculations/cuadreCajaCierreGeneral.ts — es matemática genérica de caja, no política
// de reparto 70/30.

import { BASE_FIJA_EFECTIVO_CAJA } from "@/modules/nequi/types";

// Forma ESTRUCTURAL del parte (no el tipo de Prisma, para poder testear sin BD). La fila
// generada por Prisma la satisface tal cual.
export interface ParteItem {
  monto: number;
  metodoPago: string | null;
}

export interface ParteTurnoFila {
  ventaEfectivo: number;
  ventaNequi: number;
  ventaTarjeta: number; // Tarjeta Crédito
  ventaTarjetaDebito: number;
  ventaDaviplata: number;
  ventaTransferencia: number;
  ventaCredito: number; // Crédito (fiado) — no es dinero recibido
  ventaOtro: number;
  ventaSinFactura: number;
  retiroCierre: number;
  realEfectivo: number | null;
  gastoItems: ParteItem[];
  facturaItems: ParteItem[];
}

export interface TotalesParte {
  ventaTotal: number; // suma de los 8 medios de pago
  base: number; // ventaTotal + ventaSinFactura
  totalGastos: number;
  totalFacturas: number;
  gastosEfectivoCaja: number; // solo lo pagado DE la caja principal
  facturasEfectivoCaja: number;
}

function sumarEfectivoCaja(items: ParteItem[]): number {
  return items
    .filter((i) => i.metodoPago === null || i.metodoPago === "EFECTIVO_CAJA")
    .reduce((s, i) => s + i.monto, 0);
}

export function totalesParte(p: ParteTurnoFila): TotalesParte {
  const ventaTotal =
    p.ventaEfectivo +
    p.ventaNequi +
    p.ventaTarjeta +
    p.ventaTarjetaDebito +
    p.ventaDaviplata +
    p.ventaTransferencia +
    p.ventaCredito +
    p.ventaOtro;

  return {
    ventaTotal,
    base: ventaTotal + p.ventaSinFactura,
    totalGastos: p.gastoItems.reduce((s, i) => s + i.monto, 0),
    totalFacturas: p.facturaItems.reduce((s, i) => s + i.monto, 0),
    gastosEfectivoCaja: sumarEfectivoCaja(p.gastoItems),
    facturasEfectivoCaja: sumarEfectivoCaja(p.facturaItems),
  };
}

// ---------------------------------------------------------------------------
// Cuadre físico de la caja principal del turno. La caja arranca cada turno con una base fija
// (BASE_FIJA_EFECTIVO_CAJA); solo la venta en efectivo la aumenta, y solo los gastos/facturas
// pagados CON esa caja la reducen — los pagados por otro medio (sobre blanco, Nequi, etc.) no
// la tocan.
// ---------------------------------------------------------------------------

export type EstadoCuadreCaja = "PENDIENTE" | "CUADRO" | "SOBRO" | "FALTO";

export interface CuadreCajaInput {
  baseFija: number;
  ventaEfectivo: number;
  facturasEnEfectivoCaja: number;
  gastosEnEfectivoCaja: number;
  realEfectivo: number | null; // null = aún no se ha contado el efectivo físico
}

export interface CuadreCajaResumen {
  efectivoEsperado: number;
  descuadre: number | null; // real − esperado (positivo = sobró, negativo = faltó); null si aún no se contó
  estado: EstadoCuadreCaja;
}

export function calcularCuadreCaja(input: CuadreCajaInput): CuadreCajaResumen {
  const efectivoEsperado =
    input.baseFija + input.ventaEfectivo - input.facturasEnEfectivoCaja - input.gastosEnEfectivoCaja;

  if (input.realEfectivo == null) {
    return { efectivoEsperado, descuadre: null, estado: "PENDIENTE" };
  }

  const descuadre = input.realEfectivo - efectivoEsperado;
  const estado: EstadoCuadreCaja = descuadre === 0 ? "CUADRO" : descuadre > 0 ? "SOBRO" : "FALTO";
  return { efectivoEsperado, descuadre, estado };
}

export function cuadreDelParte(
  p: ParteTurnoFila,
  baseFija: number = BASE_FIJA_EFECTIVO_CAJA
): CuadreCajaResumen {
  const t = totalesParte(p);
  return calcularCuadreCaja({
    baseFija,
    ventaEfectivo: p.ventaEfectivo,
    facturasEnEfectivoCaja: t.facturasEfectivoCaja,
    gastosEnEfectivoCaja: t.gastosEfectivoCaja,
    realEfectivo: p.realEfectivo,
  });
}

// ---------------------------------------------------------------------------
// Contraste con el módulo Nequi (flujo de UNA SOLA DIRECCIÓN: Nequi alimenta al parte).
//
// El módulo Nequi guarda la venta de farmacia del turno como UN total (tipo VENTA_FARMACIA,
// separado en Nequi/efectivo). Si el recibo del POS dice otra cosa, hay un descuadre que hoy
// nadie detecta hasta días después.
// ---------------------------------------------------------------------------

export interface VentaFarmaciaNequi {
  nequi: number;
  efectivo: number;
}

export interface DiferenciaNequi {
  campo: "ventaNequi" | "ventaEfectivo";
  etiqueta: string;
  parte: number; // lo que la vendedora escribió del recibo
  nequi: number; // lo que ya está registrado en el módulo Nequi
  diferencia: number; // parte − nequi (positivo = el recibo dice más)
}

// Devuelve SOLO las diferencias reales que valga la pena mostrar.
//
// Regla deliberada: si el módulo Nequi no tiene nada registrado para ese medio (0), no se
// reporta nada. La venta de farmacia la registra el ADMIN, y normalmente aún no lo ha hecho
// cuando la vendedora cierra su turno — avisar de una diferencia contra un 0 sería una alarma
// falsa en todos los partes, y el aviso dejaría de significar algo.
export function diferenciasConNequi(
  p: Pick<ParteTurnoFila, "ventaNequi" | "ventaEfectivo">,
  nequi: VentaFarmaciaNequi
): DiferenciaNequi[] {
  const filas: DiferenciaNequi[] = [
    { campo: "ventaNequi", etiqueta: "Venta por Nequi", parte: p.ventaNequi, nequi: nequi.nequi, diferencia: 0 },
    {
      campo: "ventaEfectivo",
      etiqueta: "Venta en efectivo",
      parte: p.ventaEfectivo,
      nequi: nequi.efectivo,
      diferencia: 0,
    },
  ];

  return filas
    .map((f) => ({ ...f, diferencia: f.parte - f.nequi }))
    .filter((f) => f.nequi > 0 && f.diferencia !== 0);
}
