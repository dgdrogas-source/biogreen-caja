import { describe, expect, it } from "vitest";
import {
  calcularEstadoBolsas,
  calcularResumenDeuda,
  type CompraPendiente,
} from "@/modules/fuxion/calculations/deudaProveedor";

// Caso real del Excel (2026-08-20): bolsa de 28 PRUNEX a crédito por $117.385, comprada el
// 2026-07-29. Al 2026-08-20 se habían vendido 8 sobres → quedan 20 y NO toca pagar todavía.
const BOLSA: CompraPendiente = {
  id: "c1",
  date: "2026-07-29",
  cantidad: 28,
  valorTotal: 117_385,
  esCredito: true,
  pagada: false,
};

describe("calcularEstadoBolsas", () => {
  it("caso real: bolsa a medio vender → todavía no toca pagar", () => {
    const [b] = calcularEstadoBolsas(0, [BOLSA], 8);
    expect(b.unidadesRestantes).toBe(20);
    expect(b.vendidaCompleta).toBe(false);
    expect(b.tocaPagar).toBe(false);
  });

  it("vendida completa y sin pagar → toca pagar", () => {
    const [b] = calcularEstadoBolsas(0, [BOLSA], 28);
    expect(b.unidadesRestantes).toBe(0);
    expect(b.vendidaCompleta).toBe(true);
    expect(b.tocaPagar).toBe(true);
  });

  it("vendida completa pero YA pagada → no vuelve a avisar", () => {
    const [b] = calcularEstadoBolsas(0, [{ ...BOLSA, pagada: true }], 28);
    expect(b.vendidaCompleta).toBe(true);
    expect(b.tocaPagar).toBe(false);
  });

  it("una bolsa comprada de contado nunca dispara el aviso de pago", () => {
    const [b] = calcularEstadoBolsas(0, [{ ...BOLSA, esCredito: false }], 28);
    expect(b.vendidaCompleta).toBe(true);
    expect(b.tocaPagar).toBe(false);
  });

  it("el inventario inicial se consume ANTES que las compras (FIFO)", () => {
    // 20 sobres ya estaban en la vitrina; se vendieron 20 → la bolsa nueva sigue intacta.
    const [b] = calcularEstadoBolsas(20, [BOLSA], 20);
    expect(b.unidadesRestantes).toBe(28);
    expect(b.vendidaCompleta).toBe(false);
  });

  it("FIFO con dos bolsas: se agota la vieja antes que la nueva", () => {
    const nueva: CompraPendiente = { ...BOLSA, id: "c2", date: "2026-08-15" };
    const [vieja, recien] = calcularEstadoBolsas(0, [BOLSA, nueva], 30);
    expect(vieja.vendidaCompleta).toBe(true); // sus 28 ya salieron
    expect(vieja.tocaPagar).toBe(true);
    expect(recien.unidadesRestantes).toBe(26); // solo salieron 2 de la nueva
    expect(recien.tocaPagar).toBe(false);
  });

  it("ordena por fecha aunque lleguen desordenadas", () => {
    const nueva: CompraPendiente = { ...BOLSA, id: "c2", date: "2026-08-15" };
    const r = calcularEstadoBolsas(0, [nueva, BOLSA], 30);
    expect(r[0].date).toBe("2026-07-29");
    expect(r[1].date).toBe("2026-08-15");
  });

  it("vender de más no deja unidades negativas", () => {
    const [b] = calcularEstadoBolsas(0, [BOLSA], 40);
    expect(b.unidadesRestantes).toBe(0);
  });
});

describe("calcularResumenDeuda", () => {
  it("una bolsa a crédito sin pagar cuenta como deuda aunque no se haya vendido", () => {
    const r = calcularResumenDeuda(calcularEstadoBolsas(0, [BOLSA], 8));
    expect(r.totalAdeudado).toBe(117_385);
    expect(r.bolsasSinPagar).toBe(1);
    expect(r.totalPorPagarYaVendido).toBe(0); // todavía no es urgente
    expect(r.bolsasPorPagarYaVendidas).toBe(0);
  });

  it("vendida completa: pasa a la deuda urgente sin dejar de ser deuda", () => {
    const r = calcularResumenDeuda(calcularEstadoBolsas(0, [BOLSA], 28));
    expect(r.totalAdeudado).toBe(117_385);
    expect(r.totalPorPagarYaVendido).toBe(117_385);
    expect(r.bolsasPorPagarYaVendidas).toBe(1);
  });

  it("una compra EN EFECTIVO nunca es deuda, ni siquiera a medio vender", () => {
    // Este es el caso que rompía la primera versión del cálculo.
    const r = calcularResumenDeuda(calcularEstadoBolsas(0, [{ ...BOLSA, esCredito: false }], 8));
    expect(r.totalAdeudado).toBe(0);
    expect(r.bolsasSinPagar).toBe(0);
  });

  it("una bolsa ya pagada deja de contar", () => {
    const r = calcularResumenDeuda(calcularEstadoBolsas(0, [{ ...BOLSA, pagada: true }], 28));
    expect(r.totalAdeudado).toBe(0);
    expect(r.totalPorPagarYaVendido).toBe(0);
  });

  it("suma varias bolsas pendientes", () => {
    const otra: CompraPendiente = { ...BOLSA, id: "c2", date: "2026-08-15" };
    const r = calcularResumenDeuda(calcularEstadoBolsas(0, [BOLSA, otra], 0));
    expect(r.totalAdeudado).toBe(234_770);
    expect(r.bolsasSinPagar).toBe(2);
  });

  it("sin bolsas todo en cero", () => {
    expect(calcularResumenDeuda([])).toEqual({
      totalAdeudado: 0,
      bolsasSinPagar: 0,
      totalPorPagarYaVendido: 0,
      bolsasPorPagarYaVendidas: 0,
    });
  });
});
