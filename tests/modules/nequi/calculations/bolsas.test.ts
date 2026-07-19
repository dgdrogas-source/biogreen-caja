import { describe, expect, it } from "vitest";
import { calcularBolsasAcumuladas } from "@/modules/nequi/calculations/bolsas";

describe("calcularBolsasAcumuladas", () => {
  it("array vacío devuelve solo los openings", () => {
    const r = calcularBolsasAcumuladas([], 1_000_000, 500_000);
    expect(r.reposicion).toBe(1_000_000);
    expect(r.gastosUtilidad).toBe(500_000);
  });

  it("sin openings ni cierres, todo en cero", () => {
    const r = calcularBolsasAcumuladas([]);
    expect(r.reposicion).toBe(0);
    expect(r.gastosUtilidad).toBe(0);
  });

  it("suma correctamente 2 cierres reales (fórmula verificada contra el Excel)", () => {
    // Fila 1: venta 534.175, sin facturas/gastos → reposicionNeta 373.922,5; utilidadDia 160.252,5
    // Fila 2: venta 736.600, facturas 28.000, gastos 10.000
    //   reposicionNeta = 736.600×0.7 − 28.000 = 487.620
    //   utilidadDia = 736.600×0.3 − 10.000 = 210.980
    const r = calcularBolsasAcumuladas([
      { ventasPorMedio: { EFECTIVO: 534175 }, facturasPagadas: 0, gastosVarios: 0 },
      { ventasPorMedio: { EFECTIVO: 736600 }, facturasPagadas: 28000, gastosVarios: 10000 },
    ]);
    expect(r.reposicion).toBeCloseTo(373922.5 + 487620, 2);
    expect(r.gastosUtilidad).toBeCloseTo(160252.5 + 210980, 2);
  });

  it("una utilidadDia negativa (gastos superan el sobre) reduce la bolsa de gastos", () => {
    const r = calcularBolsasAcumuladas(
      [{ ventasPorMedio: { EFECTIVO: 100000 }, facturasPagadas: 0, gastosVarios: 50000 }],
      0,
      100000
    );
    // margenBruto = 30.000, utilidadDia = 30.000 − 50.000 = −20.000
    expect(r.gastosUtilidad).toBe(100000 - 20000);
  });

  it("respeta el % congelado de CADA cierre (2026-07-19: antes siempre usaba 70/0 sin importar el real)", () => {
    const r = calcularBolsasAcumuladas([
      // Este turno se guardó con 80/0: reposiciónNeta = 80.000, utilidadDia = 20.000
      { ventasPorMedio: { EFECTIVO: 100000 }, facturasPagadas: 0, gastosVarios: 0, porcentajeReposicion: 0.8 },
      // Este con 70/10 (Tercero activo): reposiciónNeta = 70.000, terceroBruto = 10.000,
      // margenBruto = 20.000, utilidadDia = 20.000
      {
        ventasPorMedio: { EFECTIVO: 100000 },
        facturasPagadas: 0,
        gastosVarios: 0,
        porcentajeReposicion: 0.7,
        porcentajeTercero: 0.1,
      },
    ]);
    // Con el bug viejo (siempre 70/0) habría dado 70.000+70.000=140.000 y 30.000+30.000=60.000.
    expect(r.reposicion).toBe(80000 + 70000);
    expect(r.gastosUtilidad).toBe(20000 + 20000);
  });
});
