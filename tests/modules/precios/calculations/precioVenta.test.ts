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

describe("calcularPrecioVenta — invariante: Ideal ≥ Buena ≥ Piso, siempre", () => {
  // Bug de la revisión 2: IDEAL ignoraba el mercado, así que BUENA podía salir más alta que
  // IDEAL. Y BUENA no tenía piso propio, así que un dato de competencia absurdo podía sugerir
  // un precio en pérdida. Ambos casos, con muchas combinaciones distintas de costo/IVA/mercado,
  // no deben poder romper el orden ni dejar a BUENA por debajo del piso.
  const casos: Array<{ costoSinIva: number; tieneIva: boolean; preciosCompetencia: number[] }> = [
    { costoSinIva: 5_575, tieneIva: false, preciosCompetencia: [10_000, 11_000, 10_000] },
    { costoSinIva: 5_575, tieneIva: false, preciosCompetencia: [10_000, 11_000, 1_000] }, // dato absurdo
    { costoSinIva: 5_575, tieneIva: true, preciosCompetencia: [9_500, 9_600, 8_700, 8_900] },
    { costoSinIva: 12_438, tieneIva: false, preciosCompetencia: [13_700, 15_700, 25_745, 18_700] },
    { costoSinIva: 37_037, tieneIva: false, preciosCompetencia: [70_000, 71_000, 72_000] },
    { costoSinIva: 29_000, tieneIva: false, preciosCompetencia: [42_000, 43_000, 45_000] },
    { costoSinIva: 40_000, tieneIva: false, preciosCompetencia: [10_000, 10_500, 11_000] },
    { costoSinIva: 100_000, tieneIva: true, preciosCompetencia: [1, 1, 1] }, // extremo: competencia casi regalada
  ];

  it.each(casos)(
    "costo $costoSinIva, IVA=$tieneIva, competencia $preciosCompetencia",
    ({ costoSinIva, tieneIva, preciosCompetencia }) => {
      const r = calcularPrecioVenta({ costoSinIva, tieneIva, descuento: "NINGUNO", preciosCompetencia });
      expect(r.precioIdeal).toBeGreaterThanOrEqual(r.precioBueno);
      expect(r.precioBueno).toBeGreaterThanOrEqual(r.precioPiso);
      // Buena nunca puede sugerir vender en pérdida.
      expect(r.margenBueno).toBeGreaterThanOrEqual(0);
    }
  );
});

describe("calcularPrecioVenta — regresión: captura de pantalla 1 (competencia 10.000/11.000/10.000)", () => {
  it("el mercado da margen de sobra → Ideal y Buena capturan el mismo máximo ($9.500)", () => {
    const r = calcularPrecioVenta({
      costoSinIva: 5_575,
      tieneIva: false,
      descuento: "NINGUNO",
      preciosCompetencia: [10_000, 11_000, 10_000],
    });
    // más barato = 10.000; ideal base (35%) = 5.575/0.65 = 8.576,9 ≤ 10.000 → sobra margen:
    // recomendación = max(8.576,9, 10.000×0.95=9.500) = 9.500 → Ideal también sube a 9.500.
    expect(r.precioIdeal).toBe(9_500);
    expect(r.precioBueno).toBe(9_500);
    expect(r.casoBueno).toBe("SOBRA_MARGEN");
    expect(r.precioPiso).toBe(8_000);
    expect(r.margenIdeal).toBeCloseTo(0.4132, 3);
  });
});

describe("calcularPrecioVenta — regresión: captura de pantalla 2 (BUG, competencia con dato absurdo de 1.000)", () => {
  it("Buena ya NO sugiere un precio en pérdida — queda clavada en el piso", () => {
    const r = calcularPrecioVenta({
      costoSinIva: 5_575,
      tieneIva: false,
      descuento: "NINGUNO",
      preciosCompetencia: [10_000, 11_000, 1_000],
    });
    // más barato = 1.000 (dato absurdo/typo). Antes del fix: Buena = 1.000×1.05 = 1.050,
    // margen -406.8% (vender muy por debajo del costo). Ahora: el piso (30% = 5.575/0.70 =
    // 7.964,3) manda porque 1.050 < 7.964,3.
    expect(r.casoBueno).toBe("TOCA_PISO");
    expect(r.precioBueno).toBe(8_000);
    expect(r.precioBueno).toBe(r.precioPiso);
    expect(r.margenBueno).toBeGreaterThan(0);
    expect(r.margenBueno).toBeCloseTo(0.303, 2);
    // Ideal no se contagia del dato absurdo: sigue en el margen objetivo normal.
    expect(r.precioIdeal).toBe(8_600);
  });
});

describe("calcularPrecioVenta — caso real de la entrevista (costo 12.438, sin IVA sin descuento)", () => {
  // Competidores anotados por el dueño en su Excel: 13.700 / 15.700 / 25.745 / 18.700.
  // El más barato es 13.700. Ideal base (35%) = 12.438/0.65 = 19.135,4, muy por encima del más
  // barato → cede: 13.700×1.05 = 14.385, pero el piso (30% = 12.438/0.70 = 17.768,6) es más
  // alto → Buena queda clavada en el piso (TOCA_PISO), e Ideal se queda en su margen base
  // (19.135,4 sigue siendo mayor que el piso, así que no cambia).
  const preciosCompetencia = [13_700, 15_700, 25_745, 18_700];

  it("Buena queda en el piso; Ideal se queda en su margen base", () => {
    const r = calcularPrecioVenta({
      costoSinIva: 12_438,
      tieneIva: false,
      descuento: "NINGUNO",
      preciosCompetencia,
    });
    expect(r.casoBueno).toBe("TOCA_PISO");
    expect(r.precioIdeal).toBe(19_100);
    expect(r.precioBueno).toBe(17_800);
    expect(r.precioPiso).toBe(17_800);
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
    // ideal base (27%) = 6.634,25/0.73 = 9.088,0; más barato = 8.700 → cede: 8.700×1.05 = 9.135
    // (más alto que el ideal base) → Ideal también sube a 9.135. Piso (20%) = 8.292,8.
    expect(r.costoTotal).toBeCloseTo(6_634.25);
    expect(r.casoBueno).toBe("CEDE_MARGEN");
    expect(r.precioIdeal).toBe(9_100);
    expect(r.precioBueno).toBe(9_100);
    expect(r.precioPiso).toBe(8_300);
    expect(r.margenBueno).toBeCloseTo(0.271, 3);
  });
});

describe("calcularPrecioVenta — casos de negocio (ejemplos del dueño, margen prioritario)", () => {
  it("sobra margen: el ideal ya queda por debajo del más barato (70.000) → Ideal y Buena suben juntos", () => {
    const r = calcularPrecioVenta({
      costoSinIva: 37_037,
      tieneIva: false,
      descuento: "NINGUNO",
      preciosCompetencia: [70_000, 71_000, 72_000],
    });
    expect(r.casoBueno).toBe("SOBRA_MARGEN");
    // MAX(56.980, 70.000*0.95=66.500) → 66.500, e Ideal captura lo mismo.
    expect(r.precioBueno).toBe(66_500);
    expect(r.precioIdeal).toBe(66_500);
    expect(r.precioPiso).toBe(52_900);
  });

  it("cede margen: el más barato (42.000) obliga a bajar del ideal, sin tocar el piso", () => {
    const r = calcularPrecioVenta({
      costoSinIva: 29_000,
      tieneIva: false,
      descuento: "NINGUNO",
      preciosCompetencia: [42_000, 43_000, 45_000],
    });
    // ideal base (35%) = 44.615,4 > 42.000 → cede: 42.000×1.05 = 44.100 (menor que el ideal
    // base, así que Ideal se queda en 44.615,4 → 44.600).
    expect(r.casoBueno).toBe("CEDE_MARGEN");
    expect(r.precioBueno).toBe(44_100);
    expect(r.precioIdeal).toBe(44_600);
    expect(r.precioPiso).toBe(41_400);
  });

  it("mercado imposible: el más barato (10.000) deja la recomendación por debajo del piso — Buena se protege, ya no queda en pérdida", () => {
    const r = calcularPrecioVenta({
      costoSinIva: 40_000,
      tieneIva: false,
      descuento: "NINGUNO",
      preciosCompetencia: [10_000, 10_500, 11_000],
    });
    expect(r.casoBueno).toBe("TOCA_PISO");
    expect(r.precioBueno).toBe(57_100); // = precioPiso, ya NO es 10.500 en pérdida
    expect(r.precioPiso).toBe(57_100);
    expect(r.precioIdeal).toBe(61_500);
    expect(r.margenBueno).toBeGreaterThan(0);
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
