import type { Direction } from "../types";

export interface PocketRow {
  amount: number;
  direction: Direction;
  pettyCashBucket: string | null;
}

export interface PocketResumen {
  ingresos: number; // acumulado que entró a este bolsillo
  egresos: number; // acumulado pagado/extraído desde este bolsillo
  disponible: number; // ingresos − egresos
}

// Bolsillo organizativo ("Tus Bolsillos"): acumula todo lo etiquetado con ese bucket.
// INCOME suma como ingreso, EXPENSE suma como egreso. Independiente del medio de pago
// y del tipo de movimiento — el etiquetado (pettyCashBucket) es lo único que importa.
// NO afecta el cuadre de Nequi (puro organizativo).
export function calcularSaldoPorBolsillo(bucket: string, rows: PocketRow[]): PocketResumen {
  let ingresos = 0;
  let egresos = 0;
  for (const r of rows) {
    if (r.pettyCashBucket !== bucket) continue;
    if (r.direction === "INCOME") ingresos += r.amount;
    else egresos += r.amount;
  }
  return { ingresos, egresos, disponible: ingresos - egresos };
}
