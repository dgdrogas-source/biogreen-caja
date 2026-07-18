import type { EstadoCuadreCaja } from "./cuadreCajaCierreGeneral";

// Indicadores del "Resumen" del Cierre general (solo lectura, sobre datos ya calculados).
// Reglas confirmadas con el dueño (2026-07-17):
//   - Rentabilidad bruta = utilidad bruta ÷ venta (utilidad bruta = margen bruto, el 30%).
//   - Acumulada del mes = Σ utilidad bruta ÷ Σ venta de los cierres del mes (cada cierre con
//     su % congelado), como % con semáforo: ≥30 verde, 26–<30 amarillo, <26 rojo.
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
  utilidadBruta: number; // margen bruto del cierre (base × % de gastos/utilidad, ya congelado)
}

export interface RentabilidadMensual {
  ventaMes: number;
  utilidadBrutaMes: number;
  ratio: number | null; // utilidadBrutaMes ÷ ventaMes; null si ventaMes = 0 (evita /0)
}

// Rentabilidad bruta acumulada del mes: Σ utilidad bruta ÷ Σ venta de los cierres del mes.
export function calcularRentabilidadBrutaMensual(cierres: CierreMensualMetrica[]): RentabilidadMensual {
  const ventaMes = cierres.reduce((s, c) => s + c.ventaTotal, 0);
  const utilidadBrutaMes = cierres.reduce((s, c) => s + c.utilidadBruta, 0);
  return {
    ventaMes,
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
  reposicionBruta: number; // apartado del 70%
  reposicionNeta: number; // 70% − facturas pagadas
  margenBruto: number; // apartado del 30%
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
    apartado30: sumar(cierres, (c) => c.margenBruto),
    facturasPagadas: sumar(cierres, (c) => c.facturasPagadas),
    gastosVarios: sumar(cierres, (c) => c.gastosVarios),
    consignado: cierres.length > 0 && cierres.every((c) => c.consignado),
    cuadre: { descuadre, estado, turnosPendientes: cierres.length - contados.length },
  };
}
