import { describe, expect, it } from "vitest";
import { calcularSaldoMiniCaja } from "@/modules/nequi/calculations/miniCaja";

describe("calcularSaldoMiniCaja", () => {
  it("suma las comisiones y resta lo marcado como pagado con comisiones", () => {
    const r = calcularSaldoMiniCaja([
      { type: "COMISION", amount: 2_000, fromPettyCash: false },
      { type: "COMISION", amount: 3_000, fromPettyCash: false },
      { type: "IMPUESTO_4X1000", amount: 800, fromPettyCash: true },
      { type: "GASTO_FARMACIA", amount: 1_200, fromPettyCash: true },
    ]);
    expect(r.comisiones).toBe(5_000);
    expect(r.pagos).toBe(2_000);
    expect(r.disponible).toBe(3_000);
  });

  it("los gastos NO marcados no restan del bolsillo", () => {
    const r = calcularSaldoMiniCaja([
      { type: "COMISION", amount: 5_000, fromPettyCash: false },
      { type: "GASTO_FARMACIA", amount: 4_000, fromPettyCash: false },
    ]);
    expect(r.pagos).toBe(0);
    expect(r.disponible).toBe(5_000);
  });

  it("las ventas y otros ingresos no cuentan como comisiones", () => {
    const r = calcularSaldoMiniCaja([
      { type: "VENTA_FARMACIA", amount: 50_000, fromPettyCash: false },
      { type: "VENTA_FUXION", amount: 20_000, fromPettyCash: false },
    ]);
    expect(r.comisiones).toBe(0);
    expect(r.disponible).toBe(0);
  });

  it("el bolsillo puede quedar negativo si se paga más de lo acumulado", () => {
    const r = calcularSaldoMiniCaja([
      { type: "COMISION", amount: 1_000, fromPettyCash: false },
      { type: "GASTO_FARMACIA", amount: 5_000, fromPettyCash: true },
    ]);
    expect(r.disponible).toBe(-4_000);
  });
});
