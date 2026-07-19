import { describe, expect, it } from "vitest";
import {
  calcularDiferencia,
  calcularTotalesCierre,
  modalidadDe,
} from "@/modules/licores/calculations/cierre";

describe("modalidadDe", () => {
  it("efectivo es su propia modalidad", () => {
    expect(modalidadDe("EFECTIVO")).toBe("EFECTIVO");
  });

  it("todo lo digital cae en plataforma (las 2 modalidades del dueño)", () => {
    for (const m of ["NEQUI", "TARJETA", "DAVIPLATA", "TRANSFERENCIA"]) {
      expect(modalidadDe(m)).toBe("PLATAFORMA");
    }
  });

  it("el crédito no es efectivo ni plataforma: esa plata aún no entró", () => {
    expect(modalidadDe("CREDITO")).toBe("CREDITO");
  });
});

describe("calcularTotalesCierre", () => {
  it("separa las ventas en las 3 canastas", () => {
    const t = calcularTotalesCierre(
      [
        { precioUnitario: 5_000, cantidad: 3, metodoPago: "EFECTIVO" }, // 15.000
        { precioUnitario: 5_000, cantidad: 2, metodoPago: "NEQUI" }, // 10.000
        { precioUnitario: 5_000, cantidad: 1, metodoPago: "TARJETA" }, // 5.000
        { precioUnitario: 5_000, cantidad: 4, metodoPago: "CREDITO" }, // 20.000
      ],
      [],
      []
    );
    expect(t.ventasEfectivo).toBe(15_000);
    expect(t.ventasPlataforma).toBe(15_000); // Nequi + tarjeta juntos
    expect(t.ventasCredito).toBe(20_000);
  });

  it("el efectivo esperado suma abonos en efectivo y resta compras en efectivo", () => {
    const t = calcularTotalesCierre(
      [{ precioUnitario: 5_000, cantidad: 10, metodoPago: "EFECTIVO" }], // +50.000
      [{ valorTotal: 120_000, metodoPago: "EFECTIVO" }], // −120.000
      [{ monto: 30_000, medioPago: "EFECTIVO" }] // +30.000
    );
    expect(t.efectivoEsperado).toBe(-40_000); // 50.000 + 30.000 − 120.000
  });

  it("una compra a crédito no saca plata todavía", () => {
    const t = calcularTotalesCierre(
      [{ precioUnitario: 5_000, cantidad: 10, metodoPago: "EFECTIVO" }],
      [{ valorTotal: 120_000, metodoPago: "CREDITO" }],
      []
    );
    expect(t.comprasEfectivo).toBe(0);
    expect(t.comprasPlataforma).toBe(0);
    expect(t.efectivoEsperado).toBe(50_000); // intacto
  });

  it("el crédito NO entra en el efectivo esperado (no es plata en mano)", () => {
    const t = calcularTotalesCierre(
      [
        { precioUnitario: 5_000, cantidad: 2, metodoPago: "EFECTIVO" },
        { precioUnitario: 5_000, cantidad: 10, metodoPago: "CREDITO" },
      ],
      [],
      []
    );
    expect(t.efectivoEsperado).toBe(10_000);
    expect(t.ventasCredito).toBe(50_000);
  });

  it("la plataforma neta también descuenta lo pagado por digital", () => {
    const t = calcularTotalesCierre(
      [{ precioUnitario: 10_000, cantidad: 5, metodoPago: "NEQUI" }], // +50.000
      [{ valorTotal: 20_000, metodoPago: "TRANSFERENCIA" }], // −20.000
      [{ monto: 5_000, medioPago: "PLATAFORMA" }] // +5.000
    );
    expect(t.plataformaNeta).toBe(35_000);
  });

  it("periodo sin nada → todo en cero", () => {
    const t = calcularTotalesCierre([], [], []);
    expect(t.efectivoEsperado).toBe(0);
    expect(t.plataformaNeta).toBe(0);
    expect(t.ventasCredito).toBe(0);
  });
});

describe("calcularDiferencia", () => {
  it("contado igual a esperado → cuadró", () => {
    expect(calcularDiferencia(50_000, 50_000)).toEqual({ diferencia: 0, estado: "CUADRO" });
  });

  it("contado de más → sobró", () => {
    expect(calcularDiferencia(50_000, 53_000)).toEqual({ diferencia: 3_000, estado: "SOBRO" });
  });

  it("contado de menos → faltó", () => {
    expect(calcularDiferencia(50_000, 46_000)).toEqual({ diferencia: -4_000, estado: "FALTO" });
  });
});
