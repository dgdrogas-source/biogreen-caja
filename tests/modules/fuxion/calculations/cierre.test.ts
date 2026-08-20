import { describe, expect, it } from "vitest";
import {
  calcularDiferencia,
  calcularTotalesCierre,
  modalidadDe,
} from "@/modules/fuxion/calculations/cierre";

describe("modalidadDe", () => {
  it("efectivo y crédito son los únicos que no son plataforma", () => {
    expect(modalidadDe("EFECTIVO")).toBe("EFECTIVO");
    expect(modalidadDe("CREDITO")).toBe("CREDITO");
  });

  it("todo lo digital cae en PLATAFORMA", () => {
    for (const m of ["NEQUI", "TARJETA", "DAVIPLATA", "TRANSFERENCIA"]) {
      expect(modalidadDe(m)).toBe("PLATAFORMA");
    }
  });
});

describe("calcularTotalesCierre", () => {
  const ventas = [
    { precioUnitario: 5_500, cantidad: 4, metodoPago: "EFECTIVO" }, // 22.000
    { precioUnitario: 5_500, cantidad: 2, metodoPago: "NEQUI" }, // 11.000
    { precioUnitario: 5_500, cantidad: 1, metodoPago: "CREDITO" }, // 5.500
  ];

  it("separa las tres modalidades", () => {
    const t = calcularTotalesCierre(ventas, [], []);
    expect(t.ventasEfectivo).toBe(22_000);
    expect(t.ventasPlataforma).toBe(11_000);
    expect(t.ventasCredito).toBe(5_500);
  });

  it("el crédito NO entra al efectivo esperado: esa plata no entró", () => {
    expect(calcularTotalesCierre(ventas, [], []).efectivoEsperado).toBe(22_000);
  });

  it("los abonos en efectivo sí suman al efectivo esperado", () => {
    const t = calcularTotalesCierre(ventas, [], [{ monto: 5_500, medioPago: "EFECTIVO" }]);
    expect(t.efectivoEsperado).toBe(27_500);
  });

  it("una compra en efectivo resta del efectivo esperado", () => {
    const t = calcularTotalesCierre(ventas, [{ valorTotal: 10_000, metodoPago: "EFECTIVO" }], []);
    expect(t.comprasEfectivo).toBe(10_000);
    expect(t.efectivoEsperado).toBe(12_000);
  });

  it("una compra a CRÉDITO no saca plata todavía", () => {
    const t = calcularTotalesCierre(ventas, [{ valorTotal: 117_385, metodoPago: "CREDITO" }], []);
    expect(t.comprasEfectivo).toBe(0);
    expect(t.comprasPlataforma).toBe(0);
    expect(t.efectivoEsperado).toBe(22_000);
  });

  it("el PAGO al proveedor sí resta cuando llega (diferencia con el cierre de Licores)", () => {
    const t = calcularTotalesCierre(
      ventas,
      [{ valorTotal: 117_385, metodoPago: "CREDITO" }],
      [],
      [{ valorTotal: 117_385, metodoPago: "EFECTIVO" }]
    );
    expect(t.pagosEfectivo).toBe(117_385);
    expect(t.efectivoEsperado).toBe(22_000 - 117_385);
  });

  it("un pago por Nequi resta de la plataforma, no del efectivo", () => {
    const t = calcularTotalesCierre(ventas, [], [], [{ valorTotal: 117_385, metodoPago: "NEQUI" }]);
    expect(t.pagosPlataforma).toBe(117_385);
    expect(t.efectivoEsperado).toBe(22_000);
    expect(t.plataformaNeta).toBe(11_000 - 117_385);
  });

  it("sin pagos se comporta igual que antes (parámetro opcional)", () => {
    expect(calcularTotalesCierre(ventas, [], []).pagosEfectivo).toBe(0);
  });
});

describe("calcularDiferencia", () => {
  it("cuadró exacto", () => {
    expect(calcularDiferencia(22_000, 22_000)).toEqual({ diferencia: 0, estado: "CUADRO" });
  });

  it("sobró", () => {
    expect(calcularDiferencia(22_000, 25_000)).toEqual({ diferencia: 3_000, estado: "SOBRO" });
  });

  it("faltó", () => {
    expect(calcularDiferencia(22_000, 20_000)).toEqual({ diferencia: -2_000, estado: "FALTO" });
  });
});
