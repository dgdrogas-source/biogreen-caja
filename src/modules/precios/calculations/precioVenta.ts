// Calculadora de precio de venta — entrevista de procesos con el dueño (2026-08-11).
//
// No hay Movement, no hay BD: es una herramienta de apoyo para que la vendedora sepa qué
// precio poner cuando llega una factura con costo nuevo y el dueño no está disponible para
// calcularlo él mismo. El dueño ya tenía esta lógica en un Excel personal ("cotización de
// precios.xlsx"); aquí se reproduce con un cambio deliberado: el Excel comparaba contra el
// PROMEDIO de los competidores, pero eso podía dejarte más caro que varios de ellos si uno
// solo se disparaba de precio (un outlier). El dueño confirmó que el objetivo real es
// compararse contra el MÁS BARATO, no el promedio.
//
// Revisión 1 (mismo día): priorizar la RENTABILIDAD sobre el precio de mercado. Los % de
// margen ya NO son markup sobre costo (costo×(1+m)) — son margen real sobre el PRECIO DE VENTA
// (precio = costo / (1 - m)). Ideal 35%/27% (sin/con IVA), piso 30%/20% al ceder frente al
// más barato.
//
// Revisión 2 (mismo día): en vez de que el sistema elija un único precio automáticamente, se
// muestran las 3 opciones y decide la persona: IDEAL (margen pleno, sin mirar mercado), BUENA
// (recomendación anclada al más barato del mercado, puede no alcanzar el piso) y LA QUE TOCA
// (el piso de margen mínimo — el precio de emergencia cuando ni la buena alcanza).

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

// Cómo salió el precio "bueno": si el margen ideal ya quedaba por debajo del más barato del
// mercado (se subió para capturar más ganancia sin dejar de ser el más barato), o si tocó
// ceder margen para acercarse al más barato (2° lugar).
export type CasoBueno = "SOBRA_MARGEN" | "CEDE_MARGEN";

export interface PrecioVentaResultado {
  costoTotal: number;

  precioIdeal: number;
  /** Margen objetivo usado para precioIdeal, como fracción (0.35 = 35%). Solo vista admin. */
  margenIdealPct: number;

  precioBueno: number;
  /** Margen real que deja precioBueno, como fracción — puede caer por debajo del piso (o incluso ser negativo) si el mercado es muy barato. Solo vista admin. */
  margenBueno: number;
  casoBueno: CasoBueno;

  precioPiso: number;
  /** Margen mínimo usado para precioPiso, como fracción (0.30 = 30%). Solo vista admin. */
  margenPisoPct: number;
}

// Margen real sobre el PRECIO DE VENTA (no markup sobre costo): margen = (precio-costo)/precio.
// "Ideal" = lo que se cobra si no hay que ceder frente al mercado. "Piso" = mínimo absoluto.
const MARGEN_IDEAL_SIN_IVA = 0.35;
const MARGEN_IDEAL_CON_IVA = 0.27;
const MARGEN_PISO_SIN_IVA = 0.3;
const MARGEN_PISO_CON_IVA = 0.2;
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
  const margenIdealPct = tieneIva ? MARGEN_IDEAL_CON_IVA : MARGEN_IDEAL_SIN_IVA;
  const margenPisoPct = tieneIva ? MARGEN_PISO_CON_IVA : MARGEN_PISO_SIN_IVA;

  const precioIdealCrudo = costoTotal / (1 - margenIdealPct);
  const precioPisoCrudo = costoTotal / (1 - margenPisoPct);
  const masBarato = Math.min(...preciosCompetencia);

  let precioBuenoCrudo: number;
  let casoBueno: CasoBueno;
  if (precioIdealCrudo <= masBarato) {
    precioBuenoCrudo = Math.max(precioIdealCrudo, masBarato * (1 - COLCHON));
    casoBueno = "SOBRA_MARGEN";
  } else {
    precioBuenoCrudo = masBarato * (1 + COLCHON);
    casoBueno = "CEDE_MARGEN";
  }

  const precioIdeal = redondearA100(precioIdealCrudo);
  const precioBueno = redondearA100(precioBuenoCrudo);
  const precioPiso = redondearA100(precioPisoCrudo);
  const margenBueno = precioBueno > 0 ? (precioBueno - costoTotal) / precioBueno : 0;

  return {
    costoTotal,
    precioIdeal,
    margenIdealPct,
    precioBueno,
    margenBueno,
    casoBueno,
    precioPiso,
    margenPisoPct,
  };
}
