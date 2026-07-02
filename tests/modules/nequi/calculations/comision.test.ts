import { describe, expect, it } from "vitest";
import { calcularComisionSugerida } from "@/modules/nequi/calculations/comision";

describe("calcularComisionSugerida", () => {
  it("monto cero o negativo no genera comisión", () => {
    expect(calcularComisionSugerida(0)).toBe(0);
    expect(calcularComisionSugerida(-5000)).toBe(0);
  });

  it("tramo 1: hasta 50.000 cobra 1.000", () => {
    expect(calcularComisionSugerida(10_000)).toBe(1_000);
    expect(calcularComisionSugerida(50_000)).toBe(1_000);
  });

  it("tramo 2: de 50.001 a 110.000 cobra 2.000", () => {
    expect(calcularComisionSugerida(50_001)).toBe(2_000);
    expect(calcularComisionSugerida(80_000)).toBe(2_000);
    expect(calcularComisionSugerida(110_000)).toBe(2_000);
  });

  it("tramo 3: de 110.001 a 300.000 cobra 3.000", () => {
    expect(calcularComisionSugerida(110_001)).toBe(3_000);
    expect(calcularComisionSugerida(200_000)).toBe(3_000);
    expect(calcularComisionSugerida(300_000)).toBe(3_000);
  });

  it("sobre 300.000: 1.000 extra por cada tramo de 100.000 iniciado", () => {
    // Caso verificado con el dueño: 320.000 → 4.000
    expect(calcularComisionSugerida(320_000)).toBe(4_000);
    expect(calcularComisionSugerida(300_001)).toBe(4_000);
    expect(calcularComisionSugerida(400_000)).toBe(4_000);
    expect(calcularComisionSugerida(400_001)).toBe(5_000);
    expect(calcularComisionSugerida(450_000)).toBe(5_000);
    expect(calcularComisionSugerida(1_000_000)).toBe(10_000);
  });
});
