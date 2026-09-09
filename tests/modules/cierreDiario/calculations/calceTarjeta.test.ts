import { describe, expect, it } from "vitest";
import { calcularCalceTarjeta } from "@/modules/cierreDiario/calculations/calceTarjeta";

describe("calcularCalceTarjeta", () => {
  // Casos reales de la entrevista de procesos (08/09/2026).
  it("Visa real: $13.000 vendido → $12.464,40 consignado (4.12%, dentro de rango)", () => {
    const r = calcularCalceTarjeta(13_000, 12_464.4);
    expect(r.diferencia).toBeCloseTo(535.6, 1);
    expect(r.porcentajeDescuento).toBeCloseTo(0.0412, 3);
    expect(r.dentroDeRango).toBe(true);
  });

  it("Mastercard real: $65.000 vendido → $62.424 consignado (3.96%, dentro de rango)", () => {
    const r = calcularCalceTarjeta(65_000, 62_424);
    expect(r.porcentajeDescuento).toBeCloseTo(0.0396, 3);
    expect(r.dentroDeRango).toBe(true);
  });

  it("segundo caso real: Visa $54.000 → $51.991,20 (3.72%, dentro de rango)", () => {
    const r = calcularCalceTarjeta(54_000, 51_991.2);
    expect(r.porcentajeDescuento).toBeCloseTo(0.0372, 3);
    expect(r.dentroDeRango).toBe(true);
  });

  it("un calce por el valor exacto (0% de descuento) NO está dentro de rango", () => {
    // El calce nunca es exacto en la práctica; si algún día lo fuera, igual no debe tratarse
    // como el caso normal — se marca fuera de rango para que el admin lo revise.
    const r = calcularCalceTarjeta(20_000, 20_000);
    expect(r.dentroDeRango).toBe(false);
  });

  it("una comisión absurdamente alta (ej. 50%) queda fuera de rango", () => {
    const r = calcularCalceTarjeta(20_000, 10_000);
    expect(r.dentroDeRango).toBe(false);
  });

  it("monto vendido en 0 no divide por cero", () => {
    const r = calcularCalceTarjeta(0, 0);
    expect(r.porcentajeDescuento).toBe(0);
    expect(r.dentroDeRango).toBe(false);
  });
});
