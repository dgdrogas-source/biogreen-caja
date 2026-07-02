import type { Direction, PaymentMethod } from "../types";

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
