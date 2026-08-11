// Calculadora de precio de venta — entrevista de procesos con el dueño (2026-08-11).
//
// No hay Movement, no hay BD: es una herramienta de apoyo para que la vendedora sepa qué
// precio poner cuando llega una factura con costo nuevo y el dueño no está disponible para
// calcularlo él mismo. El dueño ya tenía esta lógica en un Excel personal ("cotización de
// precios.xlsx"); aquí se reproduce con un cambio deliberado: el Excel comparaba contra el
// PROMEDIO de los competidores, pero eso podía dejarte más caro que varios de ellos si uno
// solo se disparaba de precio (un outlier). El dueño confirmó que el objetivo real es
// compararse contra el MÁS BARATO, no el promedio.

export type Descuento = "NINGUNO" | "COPI" | "MULTI";

export interface PrecioVentaInput {
  costoSinIva: number;
  tieneIva: boolean;
  // Ignorado si tieneIva=true: en la práctica del dueño, IVA y descuento de proveedor nunca
  // coinciden (confirmado en la entrevista), igual que en su Excel original.
  descuento: Descuento;
  // El dueño busca 3 o 4 precios de competidores; se exige un mínimo de 3 para calcular
  // (validado por el llamador, no aquí — ver requiereMasPrecios).
  preciosCompetencia: number[];
}

export type CasoPrecio =
  | "SOBRA_MARGEN" // el precio con margen ideal ya queda por debajo del más barato: se sube para maximizar ganancia
  | "CEDE_MARGEN" // el margen ideal no alcanza para competir: se cede a un 2° lugar
  | "TOCA_PISO"; // ni cediendo se alcanza el mercado: gana el piso de margen mínimo

export interface PrecioVentaResultado {
  costoTotal: number;
  precioFinal: number;
  /** Margen real que deja precioFinal sobre costoTotal, como fracción (0.32 = 32%). Solo para la vista admin. */
  margenResultante: number;
  caso: CasoPrecio;
}

const MARGEN_IDEAL_SIN_IVA = 0.35;
const MARGEN_IDEAL_CON_IVA = 0.2;
const MARGEN_PISO_SIN_IVA = 0.3;
const MARGEN_PISO_CON_IVA = 0.15;
const COLCHON = 0.05;

export const PRECIOS_COMPETENCIA_MINIMOS = 3;
export const PRECIOS_COMPETENCIA_MAXIMOS = 4;

export function requiereMasPrecios(preciosCompetencia: number[]): boolean {
  return preciosCompetencia.length < PRECIOS_COMPETENCIA_MINIMOS;
}

export function redondearA100(valor: number): number {
  return Math.round(valor / 100) * 100;
}

function calcularCostoTotal(costoSinIva: number, tieneIva: boolean, descuento: Descuento): number {
  if (tieneIva) return costoSinIva * 1.19;
  if (descuento === "COPI") return costoSinIva * (1 - 0.13);
  if (descuento === "MULTI") return costoSinIva * (1 - 0.1);
  return costoSinIva;
}

export function calcularPrecioVenta(input: PrecioVentaInput): PrecioVentaResultado {
  const { costoSinIva, tieneIva, descuento, preciosCompetencia } = input;

  const costoTotal = calcularCostoTotal(costoSinIva, tieneIva, descuento);
  const margenIdeal = tieneIva ? MARGEN_IDEAL_CON_IVA : MARGEN_IDEAL_SIN_IVA;
  const margenPiso = tieneIva ? MARGEN_PISO_CON_IVA : MARGEN_PISO_SIN_IVA;

  const precioObjetivo = costoTotal * (1 + margenIdeal);
  const precioPiso = costoTotal * (1 + margenPiso);
  const masBarato = Math.min(...preciosCompetencia);

  let precioCrudo: number;
  let caso: CasoPrecio;
  if (precioObjetivo <= masBarato) {
    precioCrudo = Math.max(precioObjetivo, masBarato * (1 - COLCHON));
    caso = "SOBRA_MARGEN";
  } else {
    precioCrudo = masBarato * (1 + COLCHON);
    caso = "CEDE_MARGEN";
  }

  if (precioCrudo < precioPiso) {
    precioCrudo = precioPiso;
    caso = "TOCA_PISO";
  }

  const precioFinal = redondearA100(precioCrudo);
  const margenResultante = costoTotal > 0 ? (precioFinal - costoTotal) / costoTotal : 0;

  return { costoTotal, precioFinal, margenResultante, caso };
}
