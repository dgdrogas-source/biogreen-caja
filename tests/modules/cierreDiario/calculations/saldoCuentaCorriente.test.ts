import { describe, expect, it } from "vitest";
import {
  calcularDiferenciaDaviplata,
  calcularSaldoEsperadoCC,
} from "@/modules/cierreDiario/calculations/saldoCuentaCorriente";

describe("calcularSaldoEsperadoCC", () => {
  it("encadena el saldo de ayer con transferencias y tarjeta llegada hoy", () => {
    const esperado = calcularSaldoEsperadoCC({
      saldoConfirmadoAyer: 850_000,
      transferenciasHoy: 1_600,
      tarjetaLlegadaHoy: 0,
      ingresosManualesHoy: 0,
      egresosManualesHoy: 0,
    });
    expect(esperado).toBe(851_600);
  });

  it("resta los egresos manuales y suma los ingresos manuales", () => {
    const esperado = calcularSaldoEsperadoCC({
      saldoConfirmadoAyer: 1_000_000,
      transferenciasHoy: 0,
      tarjetaLlegadaHoy: 0,
      ingresosManualesHoy: 50_000,
      egresosManualesHoy: 1_200_480, // arriendo + 4x1000 ya incluido
    });
    expect(esperado).toBe(1_000_000 + 50_000 - 1_200_480);
  });

  it("suma la tarjeta que por fin llegó hoy (de pendientes anteriores)", () => {
    const esperado = calcularSaldoEsperadoCC({
      saldoConfirmadoAyer: 500_000,
      transferenciasHoy: 0,
      tarjetaLlegadaHoy: 30_048, // consignación real, ya neta de comisión
      ingresosManualesHoy: 0,
      egresosManualesHoy: 0,
    });
    expect(esperado).toBe(530_048);
  });
});

describe("calcularDiferenciaDaviplata", () => {
  it("real menos esperado, sin cadena (comparación directa, mismo día)", () => {
    expect(calcularDiferenciaDaviplata(35_000, 35_000)).toBe(0);
    expect(calcularDiferenciaDaviplata(35_000, 30_000)).toBe(-5_000);
    expect(calcularDiferenciaDaviplata(0, 0)).toBe(0);
  });
});
