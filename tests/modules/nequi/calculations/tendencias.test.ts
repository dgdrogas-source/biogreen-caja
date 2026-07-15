import { describe, expect, it } from "vitest";
import {
  compararMetricas,
  promedioMensual,
  sumarMetricas,
} from "@/modules/nequi/calculations/tendencias";

describe("sumarMetricas", () => {
  it("array vacío → ceros (no rompe)", () => {
    expect(sumarMetricas([])).toEqual({ venta: 0, utilidadDia: 0, descuadreTotal: 0 });
  });

  it("suma varios periodos", () => {
    const r = sumarMetricas([
      { venta: 100000, utilidadDia: 20000, descuadreTotal: -500 },
      { venta: 200000, utilidadDia: 50000, descuadreTotal: 500 },
    ]);
    expect(r).toEqual({ venta: 300000, utilidadDia: 70000, descuadreTotal: 0 });
  });
});

describe("compararMetricas", () => {
  it("periodo actual mejor que el anterior → deltas positivos", () => {
    const r = compararMetricas(
      { venta: 150000, utilidadDia: 30000, descuadreTotal: 0 },
      { venta: 100000, utilidadDia: 20000, descuadreTotal: 0 }
    );
    expect(r.deltaVenta).toBe(50000);
    expect(r.deltaVentaPct).toBeCloseTo(0.5, 5);
    expect(r.deltaUtilidad).toBe(10000);
  });

  it("periodo actual peor → deltas negativos", () => {
    const r = compararMetricas(
      { venta: 80000, utilidadDia: 10000, descuadreTotal: -1000 },
      { venta: 100000, utilidadDia: 20000, descuadreTotal: 0 }
    );
    expect(r.deltaVenta).toBe(-20000);
    expect(r.deltaVentaPct).toBeCloseTo(-0.2, 5);
    expect(r.deltaDescuadre).toBe(-1000);
  });

  it("anterior.venta === 0 → deltaVentaPct es null (evita Infinity)", () => {
    const r = compararMetricas(
      { venta: 50000, utilidadDia: 0, descuadreTotal: 0 },
      { venta: 0, utilidadDia: 0, descuadreTotal: 0 }
    );
    expect(r.deltaVentaPct).toBeNull();
    expect(r.deltaVenta).toBe(50000);
  });

  it("anterior.utilidadDia === 0 → deltaUtilidadPct es null", () => {
    const r = compararMetricas(
      { venta: 0, utilidadDia: 5000, descuadreTotal: 0 },
      { venta: 0, utilidadDia: 0, descuadreTotal: 0 }
    );
    expect(r.deltaUtilidadPct).toBeNull();
  });
});

describe("promedioMensual", () => {
  it("divide venta total entre días transcurridos", () => {
    expect(promedioMensual(1000000, 10)).toBe(100000);
  });

  it("0 días transcurridos → 0 (evita división por cero)", () => {
    expect(promedioMensual(500000, 0)).toBe(0);
  });
});
