import { describe, expect, it } from "vitest";
import {
  calcularSaldosPlataforma,
  type PlataformasInput,
} from "@/modules/nequi/calculations/plataformas";
import type { Plataforma } from "@/modules/nequi/types";

const vacio: PlataformasInput = {
  cierres: [],
  transferencias: [],
  abonosTarjeta: [],
  saldosIniciales: {},
};

const saldoDe = (r: ReturnType<typeof calcularSaldosPlataforma>, p: Plataforma) =>
  r.saldos.find((s) => s.plataforma === p)!.saldo;

describe("calcularSaldosPlataforma", () => {
  it("sin datos → todo en cero", () => {
    const r = calcularSaldosPlataforma(vacio);
    expect(saldoDe(r, "SOBRE_BLANCO")).toBe(0);
    expect(saldoDe(r, "NEQUI")).toBe(0);
    expect(saldoDe(r, "BANCO")).toBe(0);
    expect(saldoDe(r, "DAVIPLATA")).toBe(0);
    expect(r.tarjetaPendiente).toBe(0);
    expect(r.totalDisponible).toBe(0);
  });

  it("respeta los saldos iniciales", () => {
    const r = calcularSaldosPlataforma({ ...vacio, saldosIniciales: { NEQUI: 50000, BANCO: 30000 } });
    expect(saldoDe(r, "NEQUI")).toBe(50000);
    expect(saldoDe(r, "BANCO")).toBe(30000);
    expect(r.totalDisponible).toBe(80000);
  });

  it("las ventas entran a su plataforma; el retiro va al sobre blanco", () => {
    const r = calcularSaldosPlataforma({
      ...vacio,
      cierres: [
        {
          ventaNequi: 100000,
          ventaTarjeta: 0,
          ventaDaviplata: 40000,
          ventaTransferencia: 90000,
          retiroCierre: 300000,
          pagos: [],
        },
      ],
    });
    expect(saldoDe(r, "NEQUI")).toBe(100000);
    expect(saldoDe(r, "DAVIPLATA")).toBe(40000);
    expect(saldoDe(r, "BANCO")).toBe(90000);
    expect(saldoDe(r, "SOBRE_BLANCO")).toBe(300000);
  });

  it("la venta con tarjeta NO entra a ninguna cuenta: queda pendiente en neto (−4%)", () => {
    const r = calcularSaldosPlataforma({
      ...vacio,
      cierres: [{ ventaNequi: 0, ventaTarjeta: 100000, ventaDaviplata: 0, ventaTransferencia: 0, retiroCierre: 0, pagos: [] }],
    });
    expect(saldoDe(r, "BANCO")).toBe(0); // todavía no abonada
    expect(r.tarjetaPendiente).toBe(96000); // 100.000 − 4%
  });

  it("al confirmar el abono, el neto entra al banco y baja el pendiente (soporta parcial)", () => {
    const base = {
      ...vacio,
      cierres: [{ ventaNequi: 0, ventaTarjeta: 100000, ventaDaviplata: 0, ventaTransferencia: 0, retiroCierre: 0, pagos: [] }],
    };
    const parcial = calcularSaldosPlataforma({ ...base, abonosTarjeta: [50000] });
    expect(saldoDe(parcial, "BANCO")).toBe(50000);
    expect(parcial.tarjetaPendiente).toBe(46000); // 96.000 − 50.000

    const completo = calcularSaldosPlataforma({ ...base, abonosTarjeta: [96000] });
    expect(saldoDe(completo, "BANCO")).toBe(96000);
    expect(completo.tarjetaPendiente).toBe(0);
  });

  it("los pagos bajan la plataforma según su método", () => {
    const r = calcularSaldosPlataforma({
      ...vacio,
      saldosIniciales: { NEQUI: 200000, BANCO: 100000, SOBRE_BLANCO: 300000, DAVIPLATA: 50000 },
      cierres: [
        {
          ventaNequi: 0, ventaTarjeta: 0, ventaDaviplata: 0, ventaTransferencia: 0, retiroCierre: 0,
          pagos: [
            { monto: 80000, metodoPago: "NEQUI" },
            { monto: 40000, metodoPago: "TRANSFERENCIA" }, // → banco
            { monto: 25000, metodoPago: "EFECTIVO_SOBRE" },
            { monto: 15000, metodoPago: "DAVIPLATA" },
          ],
        },
      ],
    });
    expect(saldoDe(r, "NEQUI")).toBe(120000); // 200 − 80
    expect(saldoDe(r, "BANCO")).toBe(60000); // 100 − 40
    expect(saldoDe(r, "SOBRE_BLANCO")).toBe(275000); // 300 − 25
    expect(saldoDe(r, "DAVIPLATA")).toBe(35000); // 50 − 15
  });

  it("el gasto DESCONTADO_ORIGEN (4% tarjeta) NO baja ninguna plataforma", () => {
    const r = calcularSaldosPlataforma({
      ...vacio,
      saldosIniciales: { BANCO: 100000 },
      cierres: [
        {
          ventaNequi: 0, ventaTarjeta: 0, ventaDaviplata: 0, ventaTransferencia: 0, retiroCierre: 0,
          pagos: [{ monto: 4000, metodoPago: "DESCONTADO_ORIGEN" }],
        },
      ],
    });
    expect(saldoDe(r, "BANCO")).toBe(100000); // intacto
    expect(r.totalDisponible).toBe(100000);
  });

  it("pagos EFECTIVO_CAJA, DATAFONO y OTRO no tocan las plataformas seguidas", () => {
    const r = calcularSaldosPlataforma({
      ...vacio,
      saldosIniciales: { BANCO: 100000 },
      cierres: [
        {
          ventaNequi: 0, ventaTarjeta: 0, ventaDaviplata: 0, ventaTransferencia: 0, retiroCierre: 0,
          pagos: [
            { monto: 10000, metodoPago: "EFECTIVO_CAJA" },
            { monto: 20000, metodoPago: null },
            { monto: 30000, metodoPago: "DATAFONO" },
            { monto: 5000, metodoPago: "OTRO" },
          ],
        },
      ],
    });
    expect(r.totalDisponible).toBe(100000);
  });

  it("transferencia interna: el destino gana el monto, el origen pierde monto + 4x1000", () => {
    const r = calcularSaldosPlataforma({
      ...vacio,
      saldosIniciales: { BANCO: 90000, NEQUI: 0 },
      transferencias: [{ fromPlataforma: "BANCO", toPlataforma: "NEQUI", monto: 90000, impuesto4x1000: 360 }],
    });
    expect(saldoDe(r, "NEQUI")).toBe(90000); // llega completo
    expect(saldoDe(r, "BANCO")).toBe(-360); // 90.000 − 90.000 − 360
  });

  it("caso integral coherente con el ejemplo del diseño", () => {
    const r = calcularSaldosPlataforma({
      saldosIniciales: { SOBRE_BLANCO: 0, NEQUI: 0, BANCO: 0, DAVIPLATA: 0 },
      cierres: [
        {
          ventaNequi: 150000,
          ventaTarjeta: 270833, // ×0.96 ≈ 260.000 neto
          ventaDaviplata: 40000,
          ventaTransferencia: 90000,
          retiroCierre: 300000,
          pagos: [],
        },
      ],
      transferencias: [],
      abonosTarjeta: [],
    });
    expect(saldoDe(r, "SOBRE_BLANCO")).toBe(300000);
    expect(saldoDe(r, "NEQUI")).toBe(150000);
    expect(saldoDe(r, "BANCO")).toBe(90000);
    expect(saldoDe(r, "DAVIPLATA")).toBe(40000);
    expect(r.tarjetaPendiente).toBe(Math.round(270833 * 0.96));
    expect(r.totalDisponible).toBe(580000); // no incluye la tarjeta pendiente
  });
});
