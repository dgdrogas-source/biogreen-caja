import type { Direction } from "../types";

export interface PocketRow {
  amount: number;
  direction: Direction;
  pettyCashBucket: string | null;
}

export interface PocketResumen {
  ingresos: number; // acumulado que entró a este bolsillo (solo movimientos)
  egresos: number; // acumulado pagado/extraído desde este bolsillo
  openingBalance: number; // saldo inicial manual (ajuste puntual, no proviene de movimientos)
  disponible: number; // openingBalance + ingresos − egresos
}

// Bolsillo organizativo ("Tus Bolsillos"): acumula todo lo etiquetado con ese bucket.
// INCOME suma como ingreso, EXPENSE suma como egreso. Independiente del medio de pago
// y del tipo de movimiento — el etiquetado (pettyCashBucket) es lo único que importa.
// NO afecta el cuadre de Nequi (puro organizativo).
// openingBalance es un ajuste manual (ver PocketBalance): se mantiene separado de
// ingresos/egresos para que el saldo inicial se distinga de la actividad real.
export function calcularSaldoPorBolsillo(
  bucket: string,
  rows: PocketRow[],
  openingBalance: number = 0
): PocketResumen {
  let ingresos = 0;
  let egresos = 0;
  for (const r of rows) {
    if (r.pettyCashBucket !== bucket) continue;
    if (r.direction === "INCOME") ingresos += r.amount;
    else egresos += r.amount;
  }
  return { ingresos, egresos, openingBalance, disponible: openingBalance + ingresos - egresos };
}

// Resumen de dinero apartado en bolsillos. Comisiones NO aporta al total apartado: su dinero
// queda dentro del Disponible (igual que la base para consignaciones), no comprometido en un
// bolsillo. Los otros cuatro bolsillos (Licores, Fuxion, Base, Pendiente/Otro) sí se apartan.
// Suma el disponible de cada bolsillo apartado (clamped a ≥0 para no inflar con saldos negativos).
// comisionesDisponible se conserva solo para mostrarlo en la tarjeta, no entra en totalApartado.
export interface ApartadoResumen {
  comisionesDisponible: number;
  licoresDisponible: number;
  fuxionDisponible: number;
  baseDisponible: number;
  pendienteOtroDisponible: number;
  totalApartado: number;
}

export function calcularApartadoEnBolsillos(pockets: Record<string, PocketResumen>): ApartadoResumen {
  const comisiones = Math.max(0, pockets.COMISION?.disponible ?? 0);
  const licores = Math.max(0, pockets.LICORES_JHOANN?.disponible ?? 0);
  const fuxion = Math.max(0, pockets.FUXION?.disponible ?? 0);
  const base = Math.max(0, pockets.BASE_FACTURAS?.disponible ?? 0);
  const pendienteOtro = Math.max(0, pockets.PENDIENTE_OTRO?.disponible ?? 0);
  return {
    comisionesDisponible: comisiones,
    licoresDisponible: licores,
    fuxionDisponible: fuxion,
    baseDisponible: base,
    pendienteOtroDisponible: pendienteOtro,
    totalApartado: licores + fuxion + base + pendienteOtro, // sin comisiones (queda en el Disponible)
  };
}

// Dinero libre y usable de la cuenta Nequi.
// El saldo esperado es el total real de Nequi (el saldo inicial debe incluir TODO lo que hay
// en la cuenta, también la porción Nequi de la base para consignaciones). De ese total, lo
// apartado en bolsillos está comprometido; el resto es disponible. La base NO se suma aparte
// (ya vive dentro del saldo) ni se resta (no está apartada): cuenta como disponible por estar
// dentro del total sin estar en ningún bolsillo. Las Comisiones reciben el mismo trato: su
// dinero queda dentro del Disponible (no se resta), aunque se muestre como bolsillo aparte.
//   Disponible = Saldo Nequi − Apartado en bolsillos
export function calcularDisponible(saldoEsperado: number, totalApartado: number): number {
  return saldoEsperado - totalApartado;
}

// Aplica el historial de transferencias entre bolsillos sobre los saldos ya calculados
// desde los movimientos. Cada transferencia resta del bolsillo origen y suma al destino
// (como egreso/ingreso, para conservar el desglose). "DISPONIBLE" es virtual — no es un
// bolsillo real, así que no se le aplica ningún ajuste (su efecto es automático: al bajar
// un bolsillo real, el Disponible sube solo, y viceversa).
export interface TransferRow {
  fromBucket: string;
  toBucket: string;
  amount: number;
}

export function aplicarTransferencias(
  pockets: Record<string, PocketResumen>,
  transfers: TransferRow[]
): Record<string, PocketResumen> {
  const result: Record<string, PocketResumen> = {};
  for (const [bucket, resumen] of Object.entries(pockets)) {
    result[bucket] = { ...resumen };
  }
  for (const t of transfers) {
    if (result[t.fromBucket]) {
      result[t.fromBucket] = {
        ...result[t.fromBucket],
        egresos: result[t.fromBucket].egresos + t.amount,
        disponible: result[t.fromBucket].disponible - t.amount,
      };
    }
    if (result[t.toBucket]) {
      result[t.toBucket] = {
        ...result[t.toBucket],
        ingresos: result[t.toBucket].ingresos + t.amount,
        disponible: result[t.toBucket].disponible + t.amount,
      };
    }
  }
  return result;
}
