import { describe, expect, it } from "vitest";
import {
  calcularRentabilidadBrutaMensual,
  cumpleEquilibrio,
  semaforoRentabilidad,
} from "@/modules/nequi/calculations/resumenCierreGeneral";

describe("semaforoRentabilidad", () => {
  it("30% o más → verde", () => {
    expect(semaforoRentabilidad(0.3)).toBe("VERDE");
    expect(semaforoRentabilidad(0.34)).toBe("VERDE");
  });

  it("entre 26% y 29,99% → amarillo", () => {
    expect(semaforoRentabilidad(0.26)).toBe("AMARILLO");
    expect(semaforoRentabilidad(0.299)).toBe("AMARILLO");
  });

  it("por debajo de 26% → rojo", () => {
    expect(semaforoRentabilidad(0.2599)).toBe("ROJO");
    expect(semaforoRentabilidad(0)).toBe("ROJO");
  });

  it("null (sin venta) → null", () => {
    expect(semaforoRentabilidad(null)).toBeNull();
  });
});

describe("calcularRentabilidadBrutaMensual", () => {
  it("acumula Σ utilidad bruta ÷ Σ venta del mes", () => {
    const r = calcularRentabilidadBrutaMensual([
      { ventaTotal: 1000000, utilidadBruta: 300000 }, // 30%
      { ventaTotal: 500000, utilidadBruta: 140000 }, // 28%
    ]);
    expect(r.ventaMes).toBe(1500000);
    expect(r.utilidadBrutaMes).toBe(440000);
    expect(r.ratio).toBeCloseTo(440000 / 1500000, 6); // ≈ 0.2933 → amarillo
    expect(semaforoRentabilidad(r.ratio)).toBe("AMARILLO");
  });

  it("mezcla de % congelados que baja el acumulado a rojo", () => {
    const r = calcularRentabilidadBrutaMensual([
      { ventaTotal: 1000000, utilidadBruta: 300000 }, // 30% (día 70/30)
      { ventaTotal: 1000000, utilidadBruta: 200000 }, // 20% (día 80/20)
    ]);
    expect(r.ratio).toBeCloseTo(0.25, 6);
    expect(semaforoRentabilidad(r.ratio)).toBe("ROJO");
  });

  it("sin cierres → venta 0 y ratio null (no divide por cero)", () => {
    const r = calcularRentabilidadBrutaMensual([]);
    expect(r.ventaMes).toBe(0);
    expect(r.ratio).toBeNull();
  });
});

describe("cumpleEquilibrio", () => {
  it("cumple cuando la venta alcanza o supera el punto", () => {
    expect(cumpleEquilibrio(1100000, 1100000)).toBe(true);
    expect(cumpleEquilibrio(1250000, 1100000)).toBe(true);
  });

  it("no cumple cuando la venta queda por debajo", () => {
    expect(cumpleEquilibrio(980000, 1100000)).toBe(false);
  });
});
