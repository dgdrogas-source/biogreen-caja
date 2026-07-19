import type { EstadoCuadreCaja } from "./cuadreCajaCierreGeneral";

// Indicadores del "Resumen" del Cierre general (solo lectura, sobre datos ya calculados).
// Reglas confirmadas con el dueño:
//   - Rentabilidad REAL (2026-07-19, reemplaza la de 2026-07-17): utilidad bruta = ventas −
//     costos (facturas pagadas a proveedores), NO el margen del 30% de política. La versión
//     anterior era casi tautológica: margenBruto siempre es exactamente base×%, así que ese
//     "ratio" solo medía si se seguía la política, nunca el resultado real del negocio.
//   - Acumulada del mes = Σ(ventas − costos) ÷ Σ ventas de los cierres del mes, como % con
//     semáforo: ≥30 verde, 26–<30 amarillo, <26 rojo (mismos umbrales, ella no pidió cambiarlos).
//   - Punto de equilibrio = venta diaria mínima de referencia; el día "cumple" si la vende.

export type Semaforo = "VERDE" | "AMARILLO" | "ROJO";

// Umbrales del semáforo de rentabilidad bruta (en fracción: 0.30 = 30%).
export const RENTABILIDAD_VERDE = 0.3; // ≥ 30% → verde
export const RENTABILIDAD_AMARILLO = 0.26; // 26%–<30% → amarillo; < 26% → rojo

// Clasifica una rentabilidad (fracción 0..1) en el semáforo. null si no hay base (venta 0).
export function semaforoRentabilidad(ratio: number | null): Semaforo | null {
  if (ratio === null) return null;
  if (ratio >= RENTABILIDAD_VERDE) return "VERDE";
  if (ratio >= RENTABILIDAD_AMARILLO) return "AMARILLO";
  return "ROJO";
}

export interface CierreMensualMetrica {
  ventaTotal: number; // venta del cierre (suma por medio de pago)
  costos: number; // facturas pagadas a proveedores ese cierre (costo de mercancía, no gastos operativos)
}

export interface RentabilidadMensual {
  ventaMes: number;
  costosMes: number;
  utilidadBrutaMes: number; // ventaMes − costosMes
  ratio: number | null; // utilidadBrutaMes ÷ ventaMes; null si ventaMes = 0 (evita /0)
}

// Rentabilidad bruta REAL acumulada del mes: (Σ venta − Σ costos) ÷ Σ venta. "Costos" = lo
// pagado a proveedores por mercancía (facturas), no gastos operativos ni la política 70/30 —
// por eso sí mide resultado real y no solo si se siguió la política.
export function calcularRentabilidadBrutaMensual(cierres: CierreMensualMetrica[]): RentabilidadMensual {
  const ventaMes = cierres.reduce((s, c) => s + c.ventaTotal, 0);
  const costosMes = cierres.reduce((s, c) => s + c.costos, 0);
  const utilidadBrutaMes = ventaMes - costosMes;
  return {
    ventaMes,
    costosMes,
    utilidadBrutaMes,
    ratio: ventaMes > 0 ? utilidadBrutaMes / ventaMes : null,
  };
}

// ¿La venta alcanzó el punto de equilibrio? (true si venta ≥ punto).
export function cumpleEquilibrio(venta: number, puntoEquilibrio: number): boolean {
  return venta >= puntoEquilibrio;
}

// ---------------------------------------------------------------------------
// Agregación del DÍA (2026-07-16, pedido del dueño): la "foto" del Resumen es del día
// completo, no de un turno. Se suman los RESULTADOS ya calculados de cada turno, nunca
// las ventas en crudo: el % de reposición está congelado por cierre, así que dos turnos
// pueden tener % distinto y aplicar un único 70/30 sobre la venta sumada daría mal.
//
// "Retiro para gastos" = Σ (30% del turno − gastos del turno). Antes era
// `retiro − retiro para facturas`, que no correspondía a lo que el dueño usa.
// ---------------------------------------------------------------------------

export interface CierreDelDia {
  ventaTotal: number;
  retiroCierre: number;
  reposicionBruta: number; // apartado de reposición
  reposicionNeta: number; // reposición − facturas pagadas
  terceroBruto: number; // apartado de Tercero (0 si no está activado)
  margenBruto: number; // apartado de gastos/utilidad (ya descontado Tercero)
  facturasPagadas: number;
  gastosVarios: number;
  consignado: boolean;
  descuadre: number | null; // null = ese turno aún no cuenta el efectivo físico
}

export interface ResumenDiaCierreGeneral {
  turnosConCierre: number;
  ventaTotal: number;
  retiroCierre: number;
  retiroParaFacturas: number; // Σ reposiciónNeta
  retiroParaGastos: number; // Σ (margenBruto − gastos)
  apartado70: number;
  apartadoTercero: number; // Σ terceroBruto
  apartado30: number;
  facturasPagadas: number;
  gastosVarios: number;
  consignado: boolean; // true solo si TODOS los turnos con cierre están consignados
  cuadre: {
    descuadre: number | null; // Σ de los turnos ya contados; null si ninguno se contó
    estado: EstadoCuadreCaja;
    turnosPendientes: number; // turnos con cierre a los que aún les falta contar el efectivo
  };
}

const sumar = <T>(xs: T[], pick: (x: T) => number) => xs.reduce((s, x) => s + pick(x), 0);

export function agregarCierresDelDia(cierres: CierreDelDia[]): ResumenDiaCierreGeneral {
  const contados = cierres.filter((c) => c.descuadre !== null);
  const descuadre = contados.length === 0 ? null : sumar(contados, (c) => c.descuadre ?? 0);

  let estado: EstadoCuadreCaja = "PENDIENTE";
  if (descuadre !== null) estado = descuadre === 0 ? "CUADRO" : descuadre > 0 ? "SOBRO" : "FALTO";

  return {
    turnosConCierre: cierres.length,
    ventaTotal: sumar(cierres, (c) => c.ventaTotal),
    retiroCierre: sumar(cierres, (c) => c.retiroCierre),
    retiroParaFacturas: sumar(cierres, (c) => c.reposicionNeta),
    retiroParaGastos: sumar(cierres, (c) => c.margenBruto - c.gastosVarios),
    apartado70: sumar(cierres, (c) => c.reposicionBruta),
    apartadoTercero: sumar(cierres, (c) => c.terceroBruto),
    apartado30: sumar(cierres, (c) => c.margenBruto),
    facturasPagadas: sumar(cierres, (c) => c.facturasPagadas),
    gastosVarios: sumar(cierres, (c) => c.gastosVarios),
    consignado: cierres.length > 0 && cierres.every((c) => c.consignado),
    cuadre: { descuadre, estado, turnosPendientes: cierres.length - contados.length },
  };
}
