import type { Direction, PaymentMethod } from "../types";

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
  // Reparto visual por medio de pago (hoy solo se calcula para Comisiones).
  // nequi + efectivo = disponible. Puramente informativo, no participa en ningún cálculo.
  nequi?: number;
  efectivo?: number;
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

export interface PocketRowConMedio extends PocketRow {
  paymentMethod: PaymentMethod;
}

// Reparto VISUAL de un bolsillo por medio de pago: cuánto de su disponible está en Nequi
// y cuánto en efectivo. Puramente informativo (control del dueño), no participa en ningún
// cálculo. El saldo inicial manual cuenta como Nequi (las comisiones se cobran sobre
// operaciones Nequi y el sistema ya las trata como plata Nequi dentro del Disponible).
// Invariante: nequi + efectivo = disponible del bolsillo.
export function calcularRepartoPorMedio(
  bucket: string,
  rows: PocketRowConMedio[],
  openingBalance: number = 0
): { nequi: number; efectivo: number } {
  let nequi = openingBalance;
  let efectivo = 0;
  for (const r of rows) {
    if (r.pettyCashBucket !== bucket) continue;
    const delta = r.direction === "INCOME" ? r.amount : -r.amount;
    if (r.paymentMethod === "NEQUI") nequi += delta;
    else efectivo += delta;
  }
  return { nequi, efectivo };
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
// en la cuenta, también la porción Nequi de la base para consignaciones). De ese total están
// comprometidos: lo apartado en bolsillos y la porción en Nequi de la base para consignaciones.
// Lo que queda es el Disponible. Así los tres valores son la misma bolsa vista distinto y siempre
// cuadran:  Saldo esperado = Disponible + Base (Nequi) + Comisiones + Bolsillos.
// Solo se resta la porción de la base que vive en Nequi (baseNequiPortion): la parte en efectivo
// no está dentro del saldo esperado, así que no se resta. Las Comisiones NO se restan: su dinero
// queda dentro del Disponible (se muestran como renglón aparte, pero suman al total disponible).
//   Disponible = Saldo Nequi − Apartado en bolsillos − Base en Nequi
export function calcularDisponible(
  saldoEsperado: number,
  totalApartado: number,
  baseNequiPortion: number = 0
): number {
  return saldoEsperado - totalApartado - baseNequiPortion;
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
