import { describe, expect, it } from "vitest";
import { calcularSaldoPorBolsillo } from "@/modules/nequi/calculations/pockets";

describe("calcularSaldoPorBolsillo", () => {
  it("suma ingresos y egresos solo del bolsillo indicado", () => {
    const r = calcularSaldoPorBolsillo("COMISION", [
      { amount: 2_000, direction: "INCOME", pettyCashBucket: "COMISION" },
      { amount: 3_000, direction: "INCOME", pettyCashBucket: "COMISION" },
      { amount: 800, direction: "EXPENSE", pettyCashBucket: "COMISION" },
      { amount: 1_200, direction: "EXPENSE", pettyCashBucket: "COMISION" },
    ]);
    expect(r.ingresos).toBe(5_000);
    expect(r.egresos).toBe(2_000);
    expect(r.disponible).toBe(3_000);
  });

  it("ignora filas de otros bolsillos o sin bolsillo", () => {
    const r = calcularSaldoPorBolsillo("LICORES_JHOANN", [
      { amount: 5_000, direction: "INCOME", pettyCashBucket: "FUXION" },
      { amount: 4_000, direction: "EXPENSE", pettyCashBucket: null },
    ]);
    expect(r.ingresos).toBe(0);
    expect(r.egresos).toBe(0);
    expect(r.disponible).toBe(0);
  });

  it("los bolsillos son independientes entre sí", () => {
    const rows = [
      { amount: 10_000, direction: "INCOME" as const, pettyCashBucket: "FUXION" },
      { amount: 3_000, direction: "EXPENSE" as const, pettyCashBucket: "FUXION" },
      { amount: 8_000, direction: "INCOME" as const, pettyCashBucket: "LICORES_JHOANN" },
    ];
    const fuxion = calcularSaldoPorBolsillo("FUXION", rows);
    const licores = calcularSaldoPorBolsillo("LICORES_JHOANN", rows);
    expect(fuxion.disponible).toBe(7_000);
    expect(licores.disponible).toBe(8_000);
  });

  it("el bolsillo puede quedar negativo si se paga más de lo acumulado", () => {
    const r = calcularSaldoPorBolsillo("BASE_FACTURAS", [
      { amount: 1_000, direction: "INCOME", pettyCashBucket: "BASE_FACTURAS" },
      { amount: 5_000, direction: "EXPENSE", pettyCashBucket: "BASE_FACTURAS" },
    ]);
    expect(r.disponible).toBe(-4_000);
  });
});
