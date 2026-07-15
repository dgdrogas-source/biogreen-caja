// Comparativas de tendencia del Cierre general: turno vs turno anterior, semana vs semana
// anterior (lunes-domingo), y promedio mensual (venta del mes ÷ días transcurridos).

export interface MetricasPeriodo {
  venta: number;
  utilidadDia: number;
  descuadreTotal: number;
}

const CERO: MetricasPeriodo = { venta: 0, utilidadDia: 0, descuadreTotal: 0 };

export function sumarMetricas(items: MetricasPeriodo[]): MetricasPeriodo {
  return items.reduce(
    (acc, m) => ({
      venta: acc.venta + m.venta,
      utilidadDia: acc.utilidadDia + m.utilidadDia,
      descuadreTotal: acc.descuadreTotal + m.descuadreTotal,
    }),
    { ...CERO }
  );
}

export interface ComparacionMetricas {
  deltaVenta: number;
  deltaVentaPct: number | null; // null si el periodo anterior no tiene base (venta 0) → evita Infinity
  deltaUtilidad: number;
  deltaUtilidadPct: number | null;
  deltaDescuadre: number;
}

export function compararMetricas(actual: MetricasPeriodo, anterior: MetricasPeriodo): ComparacionMetricas {
  return {
    deltaVenta: actual.venta - anterior.venta,
    deltaVentaPct: anterior.venta !== 0 ? (actual.venta - anterior.venta) / anterior.venta : null,
    deltaUtilidad: actual.utilidadDia - anterior.utilidadDia,
    deltaUtilidadPct:
      anterior.utilidadDia !== 0
        ? (actual.utilidadDia - anterior.utilidadDia) / Math.abs(anterior.utilidadDia)
        : null,
    deltaDescuadre: actual.descuadreTotal - anterior.descuadreTotal,
  };
}

// Promedio de venta mensual: total vendido en el mes hasta la fecha ÷ días transcurridos
// del mes (incluye días sin cierres guardados, tal como se definió con el dueño).
export function promedioMensual(totalVentaMes: number, diasTranscurridos: number): number {
  return diasTranscurridos > 0 ? totalVentaMes / diasTranscurridos : 0;
}
