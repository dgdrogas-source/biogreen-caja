import { describe, expect, it } from "vitest";
import {
  calcularPrecioVenta,
  redondearA100,
  requiereMasPrecios,
} from "@/modules/precios/calculations/precioVenta";

describe("calcularPrecioVenta — costo total (IVA / descuento)", () => {
  it("con IVA: costo × 1.19, ignora el descuento aunque venga marcado", () => {
    const r = calcularPrecioVenta({
      costoSinIva: 10_000,
      tieneIva: true,
      descuento: "COPI",
      preciosCompetencia: [50_000, 50_000, 50_000],
    });
    expect(r.costoTotal).toBeCloseTo(11_900);
  });

  it("sin IVA con descuento Copi: costo × 0.87", () => {
    const r = calcularPrecioVenta({
      costoSinIva: 10_000,
      tieneIva: false,
      descuento: "COPI",
      preciosCompetencia: [50_000, 50_000, 50_000],
    });
    expect(r.costoTotal).toBeCloseTo(8_700);
  });

  it("sin IVA con descuento Multi: costo × 0.9", () => {
    const r = calcularPrecioVenta({
      costoSinIva: 10_000,
      tieneIva: false,
      descuento: "MULTI",
      preciosCompetencia: [50_000, 50_000, 50_000],
    });
    expect(r.costoTotal).toBeCloseTo(9_000);
  });

  it("sin IVA sin descuento: costo tal cual", () => {
    const r = calcularPrecioVenta({
      costoSinIva: 10_000,
      tieneIva: false,
      descuento: "NINGUNO",
      preciosCompetencia: [50_000, 50_000, 50_000],
    });
    expect(r.costoTotal).toBe(10_000);
  });
});

describe("calcularPrecioVenta — caso real de la entrevista (costo 12.438, sin IVA sin descuento)", () => {
  // Competidores anotados por el dueño en su Excel: 13.700 / 15.700 / 25.745 / 18.700.
  // El más barato es 13.700 → objetivo ideal (35%) = 16.791,3, por encima del más barato, así
  // que en principio toca CEDER (13.700 × 1.05 = 14.385) — pero el piso de margen (30% sobre
  // 12.438 = 16.169,4) es MÁS ALTO que ese precio cedido, así que el piso gana: el costo es
  // demasiado alto para competir con ese mercado sin perder tu margen mínimo.
  const preciosCompetencia = [13_700, 15_700, 25_745, 18_700];

  it("el piso de margen gana sobre el precio cedido", () => {
    const r = calcularPrecioVenta({
      costoSinIva: 12_438,
      tieneIva: false,
      descuento: "NINGUNO",
      preciosCompetencia,
    });
    expect(r.caso).toBe("TOCA_PISO");
    expect(r.precioFinal).toBe(16_200);
  });
});

describe("calcularPrecioVenta — margenResultante es rentabilidad sobre el PRECIO, no markup sobre costo", () => {
  it("caso real reportado por el dueño: costo 5.575 con IVA, competencia 9.500/9.600/8.700/8.900", () => {
    const r = calcularPrecioVenta({
      costoSinIva: 5_575,
      tieneIva: true,
      descuento: "NINGUNO",
      preciosCompetencia: [9_500, 9_600, 8_700, 8_900],
    });
    // costoTotal = 5.575 × 1.19 = 6.634,25; precioFinal = 8.300 (igual a la captura del dueño)
    expect(r.costoTotal).toBeCloseTo(6_634.25);
    expect(r.precioFinal).toBe(8_300);
    // (8.300 − 6.634,25) / 8.300 ≈ 20.1% — NO (8.300 − 6.634,25) / 6.634,25 ≈ 25.1% (ese era el bug)
    expect(r.margenResultante).toBeCloseTo(0.2007, 3);
  });
});

describe("calcularPrecioVenta — casos de negocio (ejemplos del dueño)", () => {
  it("sobra margen: precio ideal (50.000) por debajo del más barato (70.000) → sube a maximizar", () => {
    // costoTotal tal que ×1.35 = 50.000 → costoTotal ≈ 37.037
    const r = calcularPrecioVenta({
      costoSinIva: 37_037,
      tieneIva: false,
      descuento: "NINGUNO",
      preciosCompetencia: [70_000, 71_000, 72_000],
    });
    expect(r.caso).toBe("SOBRA_MARGEN");
    // MAX(50.000, 70.000*0.95=66.500) → 66.500 → redondeado 66.500
    expect(r.precioFinal).toBe(66_500);
  });

  it("cede margen: el más barato (42.000) obliga a bajar del precio ideal", () => {
    const r = calcularPrecioVenta({
      costoSinIva: 32_000,
      tieneIva: false,
      descuento: "NINGUNO",
      preciosCompetencia: [42_000, 43_000, 45_000],
    });
    expect(r.caso).toBe("CEDE_MARGEN");
    // 42.000 × 1.05 = 44.100 (piso 30% = 41.600, no lo alcanza a superar)
    expect(r.precioFinal).toBe(44_100);
  });

  it("toca el piso: el mercado es tan barato que ni cediendo se alcanza el margen mínimo (30%)", () => {
    const r = calcularPrecioVenta({
      costoSinIva: 40_000,
      tieneIva: false,
      descuento: "NINGUNO",
      preciosCompetencia: [10_000, 10_500, 11_000],
    });
    // precioPiso = 40.000 × 1.30 = 52.000, muy por encima de 10.000×1.05
    expect(r.caso).toBe("TOCA_PISO");
    expect(r.precioFinal).toBe(52_000);
  });
});

describe("redondearA100", () => {
  it.each([
    [66_487, 66_500],
    [44_050, 44_100],
    [44_049, 44_000],
    [100, 100],
    [149, 100],
    [151, 200],
  ])("redondea %i a %i", (input, esperado) => {
    expect(redondearA100(input)).toBe(esperado);
  });
});

describe("requiereMasPrecios", () => {
  it("true con menos de 3 precios", () => {
    expect(requiereMasPrecios([])).toBe(true);
    expect(requiereMasPrecios([1000])).toBe(true);
    expect(requiereMasPrecios([1000, 2000])).toBe(true);
  });

  it("false con 3 o 4 precios", () => {
    expect(requiereMasPrecios([1000, 2000, 3000])).toBe(false);
    expect(requiereMasPrecios([1000, 2000, 3000, 4000])).toBe(false);
  });
});
