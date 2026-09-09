import { describe, expect, it } from "vitest";
import {
  calcularDiferenciaDaviplata,
  calcularSaldoEsperadoCC,
  rangoPeriodoCC,
} from "@/modules/cierreDiario/calculations/saldoCuentaCorriente";

describe("rangoPeriodoCC", () => {
  it("sin confirmación previa: solo hoy, sin cadena", () => {
    expect(rangoPeriodoCC(null, "2026-09-08")).toEqual({
      desde: "2026-09-08",
      diasSinConfirmar: null,
      diasHueco: 0,
    });
  });

  it("confirmó ayer (ritmo normal): el período es solo hoy, sin hueco", () => {
    expect(rangoPeriodoCC("2026-09-07", "2026-09-08")).toEqual({
      desde: "2026-09-08",
      diasSinConfirmar: 1,
      diasHueco: 0,
    });
  });

  it("confirmó el viernes, hoy es lunes: suma sáb+dom+lun, 2 días de hueco", () => {
    // El día de la confirmación (05) se excluye — ya está dentro del saldo real de ese día.
    expect(rangoPeriodoCC("2026-09-05", "2026-09-08")).toEqual({
      desde: "2026-09-06",
      diasSinConfirmar: 3,
      diasHueco: 2,
    });
  });

  it("cruza cambio de mes sin romperse", () => {
    expect(rangoPeriodoCC("2026-01-30", "2026-02-02")).toEqual({
      desde: "2026-01-31",
      diasSinConfirmar: 3,
      diasHueco: 2,
    });
  });
});

describe("calcularSaldoEsperadoCC", () => {
  it("encadena el saldo anterior con transferencias y tarjeta llegada del período", () => {
    const esperado = calcularSaldoEsperadoCC({
      saldoConfirmadoAnterior: 850_000,
      transferenciasPeriodo: 1_600,
      tarjetaLlegadaPeriodo: 0,
      ingresosManualesPeriodo: 0,
      egresosManualesPeriodo: 0,
    });
    expect(esperado).toBe(851_600);
  });

  it("resta los egresos manuales y suma los ingresos manuales", () => {
    const esperado = calcularSaldoEsperadoCC({
      saldoConfirmadoAnterior: 1_000_000,
      transferenciasPeriodo: 0,
      tarjetaLlegadaPeriodo: 0,
      ingresosManualesPeriodo: 50_000,
      egresosManualesPeriodo: 1_200_480, // arriendo + 4x1000 ya incluido
    });
    expect(esperado).toBe(1_000_000 + 50_000 - 1_200_480);
  });

  it("suma la tarjeta que por fin llegó en el período (de pendientes anteriores)", () => {
    const esperado = calcularSaldoEsperadoCC({
      saldoConfirmadoAnterior: 500_000,
      transferenciasPeriodo: 0,
      tarjetaLlegadaPeriodo: 30_048, // consignación real, ya neta de comisión
      ingresosManualesPeriodo: 0,
      egresosManualesPeriodo: 0,
    });
    expect(esperado).toBe(530_048);
  });

  it("junta los montos del período tal cual (la lógica de rango vive en las queries, no aquí)", () => {
    // Escenario: confirmó el viernes en $500.000; sáb/dom/lun sin confirmar. Las queries de
    // rango ya sumaron los 3 días — esta función solo los junta: transferencias 40k + tarjeta
    // que llegó 25k − arriendo 900k (con 4x1000).
    const esperado = calcularSaldoEsperadoCC({
      saldoConfirmadoAnterior: 500_000,
      transferenciasPeriodo: 40_000,
      tarjetaLlegadaPeriodo: 25_000,
      ingresosManualesPeriodo: 0,
      egresosManualesPeriodo: 903_600,
    });
    expect(esperado).toBe(500_000 + 40_000 + 25_000 - 903_600);
  });
});

describe("calcularDiferenciaDaviplata", () => {
  it("real menos esperado, sin cadena (comparación directa, mismo día)", () => {
    expect(calcularDiferenciaDaviplata(35_000, 35_000)).toBe(0);
    expect(calcularDiferenciaDaviplata(35_000, 30_000)).toBe(-5_000);
    expect(calcularDiferenciaDaviplata(0, 0)).toBe(0);
  });
});
