import { describe, expect, it } from "vitest";
import {
  calcularDiferencia,
  calcularSaldoEsperado,
  type MovementForCuadre,
} from "@/modules/nequi/calculations/cuadre";

describe("calcularSaldoEsperado", () => {
  it("suma ingresos y resta egresos solo de movimientos Nequi", () => {
    // Réplica del día de ejemplo validado con el dueño en la entrevista.
    const movimientos: MovementForCuadre[] = [
      { amount: 45_000, direction: "INCOME", paymentMethod: "NEQUI" }, // venta farmacia
      { amount: 80_000, direction: "INCOME", paymentMethod: "NEQUI" }, // retiro
      { amount: 2_000, direction: "INCOME", paymentMethod: "EFECTIVO" }, // comisión en efectivo
      { amount: 200_000, direction: "EXPENSE", paymentMethod: "NEQUI" }, // consignación
      { amount: 3_000, direction: "INCOME", paymentMethod: "NEQUI" }, // comisión en Nequi
      { amount: 800, direction: "EXPENSE", paymentMethod: "NEQUI" }, // 4x1000 consignación
      { amount: 30_000, direction: "INCOME", paymentMethod: "NEQUI" }, // abono
      { amount: 60_000, direction: "INCOME", paymentMethod: "NEQUI" }, // Fuxion
      { amount: 25_000, direction: "INCOME", paymentMethod: "NEQUI" }, // Licores
      { amount: 150_000, direction: "EXPENSE", paymentMethod: "NEQUI" }, // factura luz
      { amount: 600, direction: "EXPENSE", paymentMethod: "NEQUI" }, // 4x1000 factura
      { amount: 40_000, direction: "EXPENSE", paymentMethod: "EFECTIVO" }, // gasto en efectivo
    ];
    // 1.500.000 + 45.000+80.000+3.000+30.000+60.000+25.000 − 200.000−800−150.000−600
    expect(calcularSaldoEsperado(1_500_000, movimientos)).toBe(1_391_600);
  });

  it("sin movimientos devuelve el saldo inicial", () => {
    expect(calcularSaldoEsperado(500_000, [])).toBe(500_000);
  });

  it("el efectivo nunca afecta el saldo Nequi", () => {
    const soloEfectivo: MovementForCuadre[] = [
      { amount: 99_000, direction: "INCOME", paymentMethod: "EFECTIVO" },
      { amount: 50_000, direction: "EXPENSE", paymentMethod: "EFECTIVO" },
    ];
    expect(calcularSaldoEsperado(100_000, soloEfectivo)).toBe(100_000);
  });
});

describe("calcularDiferencia", () => {
  it("cero cuando cuadra", () => {
    expect(calcularDiferencia(1_391_600, 1_391_600)).toBe(0);
  });

  it("negativa cuando falta plata, positiva cuando sobra", () => {
    expect(calcularDiferencia(1_390_000, 1_391_600)).toBe(-1_600);
    expect(calcularDiferencia(1_400_000, 1_391_600)).toBe(8_400);
  });
});
