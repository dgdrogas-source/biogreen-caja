// Cálculos puros del parte de turno. Sin BD, sin Prisma: todo se testea directo.
//
// La pieza crítica es `parteComoFilaCierre`: adapta el parte a la forma que consume
// `cierreInputDesdeFila` del Cierre general, para que la VISTA PREVIA que ve el admin antes
// de aprobar y el RESULTADO real después de aprobar salgan del mismo cálculo. Reconstruir el
// input a mano ya costó dos bugs silenciosos en este proyecto (los % congelados y
// retiroCierre) — ver la advertencia en calculations/cierreGeneralItems.ts.

import {
  sumarEfectivoCaja,
  type CierreGeneralFila,
} from "@/modules/nequi/calculations/cierreGeneralItems";
import {
  calcularCuadreCaja,
  type CuadreCajaResumen,
} from "@/modules/nequi/calculations/cuadreCajaCierreGeneral";
import { BASE_FIJA_EFECTIVO_CAJA, COMISION_TARJETA } from "@/modules/nequi/types";

// Forma ESTRUCTURAL del parte (no el tipo de Prisma, para poder testear sin BD). La fila
// generada por Prisma la satisface tal cual.
export interface ParteItem {
  monto: number;
  metodoPago: string | null;
}

export interface ParteTurnoFila {
  ventaEfectivo: number;
  ventaNequi: number;
  ventaTarjeta: number;
  ventaDaviplata: number;
  ventaTransferencia: number;
  ventaCredito: number;
  ventaOtro: number;
  ventaSinFactura: number;
  retiroCierre: number;
  realEfectivo: number | null;
  gastoItems: ParteItem[];
  facturaItems: ParteItem[];
}

export interface TotalesParte {
  ventaTotal: number; // suma de los 7 medios de pago
  base: number; // ventaTotal + ventaSinFactura (es la base del reparto)
  totalGastos: number;
  totalFacturas: number;
  gastosEfectivoCaja: number; // solo lo pagado DE la caja principal
  facturasEfectivoCaja: number;
}

export function totalesParte(p: ParteTurnoFila): TotalesParte {
  const ventaTotal =
    p.ventaEfectivo +
    p.ventaNequi +
    p.ventaTarjeta +
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

// Comisión del 4% que el banco cobra sobre la venta con tarjeta. Al aprobar, el cierre la
// registra como gasto automático (método DESCONTADO_ORIGEN), así que el cálculo del parte
// también tiene que contarla o la utilidad de la vista previa saldría más alta que la real.
export function comisionTarjetaDelParte(ventaTarjeta: number): number {
  return Math.round(ventaTarjeta * COMISION_TARJETA);
}

// ---------------------------------------------------------------------------
// EL ADAPTADOR (parte → fila del Cierre general).
//
// ⚠️ Al añadir un campo al parte que el cálculo use, hay que pasarlo AQUÍ y cubrirlo con un
// test. Es exactamente el agujero por el que se colaron los dos bugs del Cierre general.
// ---------------------------------------------------------------------------
export function parteComoFilaCierre(
  p: ParteTurnoFila,
  porcentajeReposicion: number, // entero 0..100, como está en la BD
  porcentajeTercero: number
): CierreGeneralFila {
  const comision = comisionTarjetaDelParte(p.ventaTarjeta);

  return {
    ventaEfectivo: p.ventaEfectivo,
    ventaNequi: p.ventaNequi,
    ventaTarjeta: p.ventaTarjeta,
    ventaDaviplata: p.ventaDaviplata,
    ventaTransferencia: p.ventaTransferencia,
    ventaCredito: p.ventaCredito,
    ventaOtro: p.ventaOtro,
    ventaSinFactura: p.ventaSinFactura,
    // Campos legados de Fase 1: un parte SIEMPRE trae items, nunca un total agregado.
    // Con items presentes, sumarConFallback ignora estos valores.
    facturasPagadas: 0,
    gastosVarios: 0,
    retiroCierre: p.retiroCierre,
    realEfectivo: p.realEfectivo,
    porcentajeReposicion,
    porcentajeTercero,
    facturaItems: p.facturaItems,
    // El gasto automático del 4% aún no existe como fila (lo crea la aprobación), pero ya
    // cuenta para la utilidad: se inyecta para que previa y resultado coincidan.
    gastoItems: comision > 0 ? [...p.gastoItems, { monto: comision }] : p.gastoItems,
  };
}

// Cuadre físico de la caja principal del turno, con la misma fórmula que el Cierre general.
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
