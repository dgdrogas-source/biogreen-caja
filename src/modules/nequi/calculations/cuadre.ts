import type { Direction, MovementType, PaymentMethod } from "../types";

export interface MovementForCuadre {
  amount: number;
  direction: Direction;
  paymentMethod: PaymentMethod;
}

// Saldo esperado = saldo inicial + ingresos Nequi − egresos Nequi.
// Los movimientos en EFECTIVO nunca afectan el saldo de Nequi.
export function calcularSaldoEsperado(
  openingBalance: number,
  movements: MovementForCuadre[]
): number {
  return movements
    .filter((m) => m.paymentMethod === "NEQUI")
    .reduce(
      (acc, m) => acc + (m.direction === "INCOME" ? m.amount : -m.amount),
      openingBalance
    );
}

// Diferencia = saldo real (app Nequi) − saldo esperado. 0 → cuadra.
export function calcularDiferencia(saldoReal: number, saldoEsperado: number): number {
  return saldoReal - saldoEsperado;
}

export interface MovementForDesglose {
  type: MovementType;
  amount: number;
  direction: Direction;
  paymentMethod: PaymentMethod;
}

export interface DesgloseLinea {
  type: MovementType;
  amount: number;
}

export interface DesgloseCuadre {
  saldoInicial: number;
  ingresos: DesgloseLinea[]; // ingresos Nequi por tipo, de mayor a menor
  egresos: DesgloseLinea[]; // egresos Nequi por tipo (incluye el 4x1000), de mayor a menor
  totalIngresos: number;
  totalEgresos: number;
  saldoEsperado: number; // saldoInicial + totalIngresos − totalEgresos
}

// Desglosa el cuadre: agrupa SOLO los movimientos en Nequi por tipo (el efectivo no
// afecta el saldo de Nequi), separando ingresos de egresos según la dirección real de
// cada movimiento (así PENDIENTE_OTRO/OTRO caen en el lado correcto). Es la explicación
// renglón por renglón de calcularSaldoEsperado.
export function desglosarCuadre(
  saldoInicial: number,
  movements: MovementForDesglose[]
): DesgloseCuadre {
  const ingresos = new Map<MovementType, number>();
  const egresos = new Map<MovementType, number>();
  for (const m of movements) {
    if (m.paymentMethod !== "NEQUI") continue;
    const bucket = m.direction === "INCOME" ? ingresos : egresos;
    bucket.set(m.type, (bucket.get(m.type) ?? 0) + m.amount);
  }
  const aLista = (map: Map<MovementType, number>): DesgloseLinea[] =>
    [...map.entries()]
      .map(([type, amount]) => ({ type, amount }))
      .sort((a, b) => b.amount - a.amount);
  const totalIngresos = [...ingresos.values()].reduce((a, b) => a + b, 0);
  const totalEgresos = [...egresos.values()].reduce((a, b) => a + b, 0);
  return {
    saldoInicial,
    ingresos: aLista(ingresos),
    egresos: aLista(egresos),
    totalIngresos,
    totalEgresos,
    saldoEsperado: saldoInicial + totalIngresos - totalEgresos,
  };
}
