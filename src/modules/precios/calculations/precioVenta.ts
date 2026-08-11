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
// muestran las 3 opciones y decide la persona: IDEAL, BUENA (recomendación de mercado) y LA
// QUE TOCA (piso de margen mínimo).
//
// Revisión 3 (mismo día): dos bugs de la revisión 2. (a) IDEAL ignoraba el mercado del todo,
// así que BUENA podía salir MÁS ALTA que IDEAL cuando el mercado daba margen de sobra — quedaba
// desordenado y "ideal" dejaba plata sobre la mesa. Ahora IDEAL = el mejor precio defendible:
// si el mercado permite más que el margen objetivo, lo captura (igual que hacía BUENA); si no,
// se queda en el margen objetivo. (b) BUENA no tenía piso propio: con un dato de competencia
// absurdamente bajo (o un error de tipeo) podía sugerir un precio en PÉRDIDA. Ahora BUENA nunca
// baja del piso — si el mercado forzaría menos que el piso, BUENA queda clavada en el piso
// (mismo valor que "la que toca", caso TOCA_PISO). Con esto, precioIdeal >= precioBueno >=
// precioPiso queda garantizado por construcción (útil: la UI ya no necesita reordenar nada,
// el orden descendente sale solo).

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
// mercado (se subió para capturar más ganancia sin dejar de ser el más barato), si tocó ceder
// margen para acercarse al más barato (2° lugar), o si ni cediendo se alcanzaba el piso y este
// tuvo que tomar el control (mercado imposible o dato de competencia absurdo).
export type CasoBueno = "SOBRA_MARGEN" | "CEDE_MARGEN" | "TOCA_PISO";

export interface PrecioVentaResultado {
  costoTotal: number;

  precioIdeal: number;
  /** Margen real que deja precioIdeal, como fracción (0.35 = 35%) — igual al margen objetivo salvo que el mercado haya permitido capturar más. Solo vista admin. */
  margenIdeal: number;

  precioBueno: number;
  /** Margen real que deja precioBueno, como fracción. Nunca por debajo de margenPisoPct (ver casoBueno=TOCA_PISO). Solo vista admin. */
  margenBueno: number;
  casoBueno: CasoBueno;

  precioPiso: number;
  /** Margen mínimo usado para precioPiso, como fracción (0.30 = 30%). Solo vista admin. */
  margenPisoPct: number;
}

// Margen real sobre el PRECIO DE VENTA (no markup sobre costo): margen = (precio-costo)/precio.
// "Ideal" = el mejor precio defendible. "Piso" = mínimo absoluto, nunca se cruza.
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

function margenDe(precio: number, costoTotal: number): number {
  return precio > 0 ? (precio - costoTotal) / precio : 0;
}

export function calcularPrecioVenta(input: PrecioVentaInput): PrecioVentaResultado {
  const { costoSinIva, tieneIva, descuento, preciosCompetencia } = input;

  const costoTotal = calcularCostoTotal(costoSinIva, tieneIva, descuento);
  const margenIdealObjetivo = tieneIva ? MARGEN_IDEAL_CON_IVA : MARGEN_IDEAL_SIN_IVA;
  const margenPisoPct = tieneIva ? MARGEN_PISO_CON_IVA : MARGEN_PISO_SIN_IVA;

  const precioIdealBase = costoTotal / (1 - margenIdealObjetivo);
  const precioPisoCrudo = costoTotal / (1 - margenPisoPct);
  const masBarato = Math.min(...preciosCompetencia);

  // Recomendación de mercado, sin piso todavía: sube a capturar margen extra si el mercado da
  // espacio (SOBRA_MARGEN), o cede hacia el más barato si el margen objetivo no es competitivo
  // (CEDE_MARGEN).
  let recomendacionCruda: number;
  let casoMercado: "SOBRA_MARGEN" | "CEDE_MARGEN";
  if (precioIdealBase <= masBarato) {
    recomendacionCruda = Math.max(precioIdealBase, masBarato * (1 - COLCHON));
    casoMercado = "SOBRA_MARGEN";
  } else {
    recomendacionCruda = masBarato * (1 + COLCHON);
    casoMercado = "CEDE_MARGEN";
  }

  // BUENA nunca baja del piso — si la recomendación de mercado cae por debajo (mercado
  // imposible o dato de competencia absurdo), el piso toma el control.
  const tocoPiso = recomendacionCruda < precioPisoCrudo;
  const precioBuenoCrudo = Math.max(recomendacionCruda, precioPisoCrudo);
  const casoBueno: CasoBueno = tocoPiso ? "TOCA_PISO" : casoMercado;

  // IDEAL captura el mismo upside que BUENA cuando el mercado lo permite; nunca queda por
  // debajo de BUENA (así el orden Ideal ≥ Buena ≥ Piso queda garantizado, también tras redondear
  // — redondearA100 es monótona).
  const precioIdealCrudo = Math.max(precioIdealBase, precioBuenoCrudo);

  const precioIdeal = redondearA100(precioIdealCrudo);
  const precioBueno = redondearA100(precioBuenoCrudo);
  const precioPiso = redondearA100(precioPisoCrudo);

  return {
    costoTotal,
    precioIdeal,
    margenIdeal: margenDe(precioIdeal, costoTotal),
    precioBueno,
    margenBueno: margenDe(precioBueno, costoTotal),
    casoBueno,
    precioPiso,
    margenPisoPct,
  };
}
