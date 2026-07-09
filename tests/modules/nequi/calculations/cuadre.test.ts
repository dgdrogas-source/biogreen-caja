import { describe, expect, it } from "vitest";
import {
  calcularDiferencia,
  calcularSaldoEsperado,
  desglosarCuadre,
  type MovementForCuadre,
  type MovementForDesglose,
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

describe("desglosarCuadre", () => {
  it("agrupa por tipo, separa ingresos/egresos y cuadra con el saldo esperado", () => {
    const movs: MovementForDesglose[] = [
      { type: "RETIRO_CLIENTE", amount: 200_000, direction: "INCOME", paymentMethod: "NEQUI" },
      { type: "VENTA_FARMACIA", amount: 150_000, direction: "INCOME", paymentMethod: "NEQUI" },
      { type: "ABONO_CREDITO", amount: 150_000, direction: "INCOME", paymentMethod: "NEQUI" },
      { type: "CONSIGNACION_CLIENTE", amount: 100_000, direction: "EXPENSE", paymentMethod: "NEQUI" },
      { type: "IMPUESTO_4X1000", amount: 400, direction: "EXPENSE", paymentMethod: "NEQUI" },
      { type: "GASTO_FARMACIA", amount: 199_600, direction: "EXPENSE", paymentMethod: "NEQUI" },
      { type: "COMISION", amount: 5_000, direction: "INCOME", paymentMethod: "EFECTIVO" }, // efectivo: se ignora
    ];
    const d = desglosarCuadre(1_000_000, movs);
    expect(d.totalIngresos).toBe(500_000);
    expect(d.totalEgresos).toBe(300_000);
    expect(d.saldoEsperado).toBe(1_200_000); // 1.000.000 + 500.000 − 300.000
    // ordenados de mayor a menor
    expect(d.ingresos.map((l) => l.type)).toEqual(["RETIRO_CLIENTE", "VENTA_FARMACIA", "ABONO_CREDITO"]);
    expect(d.egresos[0]).toEqual({ type: "GASTO_FARMACIA", amount: 199_600 });
    // el efectivo no aparece en ningún lado
    expect(d.ingresos.some((l) => l.type === "COMISION")).toBe(false);
  });

  it("suma varios movimientos del mismo tipo en un solo renglón", () => {
    const movs: MovementForDesglose[] = [
      { type: "RETIRO_CLIENTE", amount: 30_000, direction: "INCOME", paymentMethod: "NEQUI" },
      { type: "RETIRO_CLIENTE", amount: 20_000, direction: "INCOME", paymentMethod: "NEQUI" },
    ];
    const d = desglosarCuadre(0, movs);
    expect(d.ingresos).toEqual([{ type: "RETIRO_CLIENTE", amount: 50_000 }]);
    expect(d.saldoEsperado).toBe(50_000);
  });

  it("el saldo esperado del desglose coincide con calcularSaldoEsperado", () => {
    const movs: MovementForDesglose[] = [
      { type: "RETIRO_CLIENTE", amount: 80_000, direction: "INCOME", paymentMethod: "NEQUI" },
      { type: "CONSIGNACION_CLIENTE", amount: 25_000, direction: "EXPENSE", paymentMethod: "NEQUI" },
      { type: "COMISION", amount: 2_000, direction: "INCOME", paymentMethod: "EFECTIVO" },
    ];
    const d = desglosarCuadre(500_000, movs);
    expect(d.saldoEsperado).toBe(calcularSaldoEsperado(500_000, movs));
  });
});
