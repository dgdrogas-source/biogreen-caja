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

describe("calcularPrecioVenta — margenIdealPct / margenPisoPct según IVA", () => {
  it("sin IVA: ideal 35%, piso 30%", () => {
    const r = calcularPrecioVenta({
      costoSinIva: 10_000,
      tieneIva: false,
      descuento: "NINGUNO",
      preciosCompetencia: [50_000, 50_000, 50_000],
    });
    expect(r.margenIdealPct).toBe(0.35);
    expect(r.margenPisoPct).toBe(0.3);
  });

  it("con IVA: ideal 27%, piso 20%", () => {
    const r = calcularPrecioVenta({
      costoSinIva: 10_000,
      tieneIva: true,
      descuento: "NINGUNO",
      preciosCompetencia: [50_000, 50_000, 50_000],
    });
    expect(r.margenIdealPct).toBe(0.27);
    expect(r.margenPisoPct).toBe(0.2);
  });
});

describe("calcularPrecioVenta — caso real de la entrevista (costo 12.438, sin IVA sin descuento)", () => {
  // Competidores anotados por el dueño en su Excel: 13.700 / 15.700 / 25.745 / 18.700.
  // El más barato es 13.700. Ideal (35%) = 12.438/0.65 = 19.135,4 → muy por encima del más
  // barato, así que la "buena" cede: 13.700×1.05 = 14.385 → redondeada 14.400. El piso (30%)
  // = 12.438/0.70 = 17.768,6 → redondeado 17.800, MÁS ALTO que la "buena": ni cediendo frente
  // al mercado se alcanza el margen mínimo real, por eso ahora se muestran las dos por
  // separado en vez de que el sistema fuerce el piso automáticamente.
  const preciosCompetencia = [13_700, 15_700, 25_745, 18_700];

  it("la buena no alcanza el piso — se muestran ambas para que decida la persona", () => {
    const r = calcularPrecioVenta({
      costoSinIva: 12_438,
      tieneIva: false,
      descuento: "NINGUNO",
      preciosCompetencia,
    });
    expect(r.precioIdeal).toBe(19_100);
    expect(r.casoBueno).toBe("CEDE_MARGEN");
    expect(r.precioBueno).toBe(14_400);
    expect(r.precioPiso).toBe(17_800);
    expect(r.precioBueno).toBeLessThan(r.precioPiso);
  });
});

describe("calcularPrecioVenta — mismo insumo reportado por el dueño (costo 5.575 con IVA)", () => {
  it("costo 5.575 con IVA, competencia 9.500/9.600/8.700/8.900", () => {
    const r = calcularPrecioVenta({
      costoSinIva: 5_575,
      tieneIva: true,
      descuento: "NINGUNO",
      preciosCompetencia: [9_500, 9_600, 8_700, 8_900],
    });
    // costoTotal = 5.575 × 1.19 = 6.634,25.
    // ideal (27%) = 6.634,25/0.73 = 9.088,0 → redondeado 9.100
    // más barato = 8.700; ideal > más barato → cede: 8.700×1.05 = 9.135 → redondeado 9.100
    // piso (20%) = 6.634,25/0.80 = 8.292,8 → redondeado 8.300
    expect(r.costoTotal).toBeCloseTo(6_634.25);
    expect(r.precioIdeal).toBe(9_100);
    expect(r.casoBueno).toBe("CEDE_MARGEN");
    expect(r.precioBueno).toBe(9_100);
    expect(r.precioPiso).toBe(8_300);
    // (9.100 − 6.634,25) / 9.100 ≈ 27.1%
    expect(r.margenBueno).toBeCloseTo(0.271, 3);
  });
});

describe("calcularPrecioVenta — casos de negocio (ejemplos del dueño, margen prioritario)", () => {
  it("sobra margen: el ideal ya queda por debajo del más barato (70.000) → la buena sube a maximizar", () => {
    // costoTotal tal que /0.65 ≈ 56.980 (ideal 35%), aún por debajo del más barato (70.000)
    const r = calcularPrecioVenta({
      costoSinIva: 37_037,
      tieneIva: false,
      descuento: "NINGUNO",
      preciosCompetencia: [70_000, 71_000, 72_000],
    });
    expect(r.casoBueno).toBe("SOBRA_MARGEN");
    // MAX(56.980, 70.000*0.95=66.500) → 66.500
    expect(r.precioBueno).toBe(66_500);
    expect(r.precioIdeal).toBe(57_000);
    expect(r.precioPiso).toBe(52_900);
  });

  it("cede margen: el más barato (42.000) obliga a bajar del ideal, pero la buena sigue por encima del piso", () => {
    const r = calcularPrecioVenta({
      costoSinIva: 29_000,
      tieneIva: false,
      descuento: "NINGUNO",
      preciosCompetencia: [42_000, 43_000, 45_000],
    });
    // ideal (35%) = 29.000/0.65 = 44.615,4 > 42.000 → cede: 42.000×1.05 = 44.100
    // piso (30%) = 29.000/0.70 = 41.428,6 → redondeado 41.400, la buena no lo cruza
    expect(r.casoBueno).toBe("CEDE_MARGEN");
    expect(r.precioBueno).toBe(44_100);
    expect(r.precioPiso).toBe(41_400);
    expect(r.precioBueno).toBeGreaterThan(r.precioPiso);
  });

  it("mercado imposible: el más barato (10.000) deja la buena en pérdida — el piso es la única opción sana", () => {
    const r = calcularPrecioVenta({
      costoSinIva: 40_000,
      tieneIva: false,
      descuento: "NINGUNO",
      preciosCompetencia: [10_000, 10_500, 11_000],
    });
    expect(r.casoBueno).toBe("CEDE_MARGEN");
    expect(r.precioBueno).toBe(10_500); // 10.000 × 1.05 — por debajo del costo, margen negativo
    expect(r.margenBueno).toBeLessThan(0);
    expect(r.precioPiso).toBe(57_100); // 40.000/0.70, redondeado
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
