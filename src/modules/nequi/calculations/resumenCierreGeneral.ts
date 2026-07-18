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
