import { describe, expect, it } from "vitest";
import {
  calcularCarteraTotal,
  calcularSaldoCliente,
  calcularSaldosPorCliente,
} from "@/modules/licores/calculations/cartera";

describe("calcularSaldoCliente", () => {
  it("saldo = fiado − abonado", () => {
    const r = calcularSaldoCliente(
      [
        { clienteId: "c1", precioUnitario: 5_000, cantidad: 3 }, // 15.000
        { clienteId: "c1", precioUnitario: 6_000, cantidad: 2 }, // 12.000
      ],
      [{ clienteId: "c1", monto: 10_000 }]
    );
    expect(r.deuda).toBe(27_000);
    expect(r.abonado).toBe(10_000);
    expect(r.saldo).toBe(17_000);
  });

  it("cliente al día → saldo 0", () => {
    const r = calcularSaldoCliente(
      [{ clienteId: "c1", precioUnitario: 5_000, cantidad: 2 }],
      [{ clienteId: "c1", monto: 10_000 }]
    );
    expect(r.saldo).toBe(0);
  });

  it("si abonó de más el saldo queda negativo (se muestra, no se esconde)", () => {
    const r = calcularSaldoCliente(
      [{ clienteId: "c1", precioUnitario: 5_000, cantidad: 1 }],
      [{ clienteId: "c1", monto: 8_000 }]
    );
    expect(r.saldo).toBe(-3_000);
  });

  it("sin movimientos → todo en cero", () => {
    expect(calcularSaldoCliente([], [])).toEqual({ deuda: 0, abonado: 0, saldo: 0 });
  });
});

describe("calcularSaldosPorCliente", () => {
  it("agrupa por cliente sin mezclar deudas", () => {
    const saldos = calcularSaldosPorCliente(
      [
        { clienteId: "ana", precioUnitario: 5_000, cantidad: 4 }, // 20.000
        { clienteId: "beto", precioUnitario: 5_000, cantidad: 1 }, // 5.000
      ],
      [{ clienteId: "ana", monto: 5_000 }]
    );
    expect(saldos.get("ana")?.saldo).toBe(15_000);
    expect(saldos.get("beto")?.saldo).toBe(5_000);
  });

  it("incluye a quien solo tiene abonos (pagó por adelantado)", () => {
    const saldos = calcularSaldosPorCliente([], [{ clienteId: "ana", monto: 5_000 }]);
    expect(saldos.get("ana")?.saldo).toBe(-5_000);
  });
});

describe("calcularCarteraTotal", () => {
  it("suma solo los saldos positivos: un cliente adelantado no tapa la deuda de otro", () => {
    const saldos = calcularSaldosPorCliente(
      [
        { clienteId: "ana", precioUnitario: 5_000, cantidad: 4 }, // debe 20.000
        { clienteId: "beto", precioUnitario: 5_000, cantidad: 1 }, // 5.000
      ],
      [{ clienteId: "beto", monto: 12_000 }] // beto queda en −7.000
    );
    expect(calcularCarteraTotal(saldos.values())).toBe(20_000); // NO 13.000
  });

  it("sin clientes → 0", () => {
    expect(calcularCarteraTotal([])).toBe(0);
  });
});
