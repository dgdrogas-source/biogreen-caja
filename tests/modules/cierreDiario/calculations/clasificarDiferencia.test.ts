import { describe, expect, it } from "vitest";
import { clasificarDiferencia } from "@/modules/cierreDiario/calculations/clasificarDiferencia";

describe("clasificarDiferencia", () => {
  it("diferencia 0 siempre cuadra, sin importar los pendientes", () => {
    expect(clasificarDiferencia(0, [])).toBe("CUADRA");
    expect(clasificarDiferencia(0, [{ montoVendido: 100_000 }])).toBe("CUADRA");
  });

  it("sin pendientes vencidos, cualquier diferencia distinta de 0 es real", () => {
    expect(clasificarDiferencia(5_000, [])).toBe("REAL");
    expect(clasificarDiferencia(-5_000, [])).toBe("REAL");
  });

  it("diferencia que coincide con lo que llegaría de un pendiente vencido (comisión ~4%) se explica", () => {
    // $20.000 vendido pendiente: con ~4% de comisión llegarían ~$19.200 → esa es la diferencia
    // que se vería en el banco si nadie ha confirmado el calce todavía.
    expect(clasificarDiferencia(19_200, [{ montoVendido: 20_000 }])).toBe("EXPLICADA");
  });

  it("diferencia demasiado chica para ser ese pendiente completo llegando, es real", () => {
    // Si solo llegó una fracción mínima o la diferencia es minúscula frente al pendiente,
    // no encaja con "todo el pendiente llegó sin confirmar" — se marca real.
    expect(clasificarDiferencia(800, [{ montoVendido: 20_000 }])).toBe("REAL");
  });

  it("suma varios pendientes vencidos antes de comparar", () => {
    const pendientes = [{ montoVendido: 20_000 }, { montoVendido: 31_300 }];
    // Total 51.300, con ~4% de comisión llegarían ~$49.248 — dentro del rango 94%-98%.
    expect(clasificarDiferencia(49_200, pendientes)).toBe("EXPLICADA");
    expect(clasificarDiferencia(5_000, pendientes)).toBe("REAL"); // muy por debajo del rango
  });
});
