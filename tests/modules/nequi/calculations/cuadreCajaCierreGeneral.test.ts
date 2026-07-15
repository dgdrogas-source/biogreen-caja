import { describe, expect, it } from "vitest";
import { calcularCuadreCaja } from "@/modules/nequi/calculations/cuadreCajaCierreGeneral";

describe("calcularCuadreCaja", () => {
  it("sin efectivo contado, queda PENDIENTE y descuadre null", () => {
    const r = calcularCuadreCaja({
      baseFija: 200000,
      ventaEfectivo: 330700,
      facturasEnEfectivoCaja: 0,
      gastosEnEfectivoCaja: 0,
      realEfectivo: null,
    });
    expect(r.estado).toBe("PENDIENTE");
    expect(r.descuadre).toBeNull();
    expect(r.efectivoEsperado).toBe(530700);
  });

  it("cuadra exacto", () => {
    const r = calcularCuadreCaja({
      baseFija: 200000,
      ventaEfectivo: 330700,
      facturasEnEfectivoCaja: 0,
      gastosEnEfectivoCaja: 0,
      realEfectivo: 530700,
    });
    expect(r.estado).toBe("CUADRO");
    expect(r.descuadre).toBe(0);
  });

  it("sobra dinero (descuadre positivo)", () => {
    const r = calcularCuadreCaja({
      baseFija: 200000,
      ventaEfectivo: 330700,
      facturasEnEfectivoCaja: 0,
      gastosEnEfectivoCaja: 0,
      realEfectivo: 551300,
    });
    expect(r.estado).toBe("SOBRO");
    expect(r.descuadre).toBe(20600);
  });

  it("falta dinero (descuadre negativo) — antes era imposible de registrar", () => {
    const r = calcularCuadreCaja({
      baseFija: 200000,
      ventaEfectivo: 330700,
      facturasEnEfectivoCaja: 0,
      gastosEnEfectivoCaja: 0,
      realEfectivo: 510100,
    });
    expect(r.estado).toBe("FALTO");
    expect(r.descuadre).toBe(-20600);
  });

  it("facturas y gastos pagados de caja reducen el efectivo esperado", () => {
    const r = calcularCuadreCaja({
      baseFija: 200000,
      ventaEfectivo: 330700,
      facturasEnEfectivoCaja: 100000,
      gastosEnEfectivoCaja: 35000,
      realEfectivo: 395700,
    });
    expect(r.efectivoEsperado).toBe(395700); // 200000 + 330700 - 100000 - 35000
    expect(r.estado).toBe("CUADRO");
  });

  it("un pago hecho desde el sobre blanco NO debe restar del efectivo esperado de caja", () => {
    // Comparado con el caso anterior, si esos mismos 100000/35000 se hubieran pagado del
    // sobre blanco (no de caja), el llamador no los incluiría aquí — efectivo esperado
    // vuelve a ser base + venta, sin descontar nada.
    const r = calcularCuadreCaja({
      baseFija: 200000,
      ventaEfectivo: 330700,
      facturasEnEfectivoCaja: 0,
      gastosEnEfectivoCaja: 0,
      realEfectivo: 530700,
    });
    expect(r.efectivoEsperado).toBe(530700);
    expect(r.estado).toBe("CUADRO");
  });
});
