import { describe, expect, it } from "vitest";
import {
  calcularSaldoCliente,
  calcularSaldosPorCliente,
} from "@/modules/nequi/calculations/clientes";

describe("calcularSaldoCliente", () => {
  it("cliente sin ventas ni abonos → 0", () => {
    expect(calcularSaldoCliente([], [])).toBe(0);
  });

  it("solo ventas → saldo positivo (debe)", () => {
    expect(calcularSaldoCliente([{ monto: 50000 }, { monto: 20000 }], [])).toBe(70000);
  });

  it("ventas y abonos parciales", () => {
    expect(calcularSaldoCliente([{ monto: 100000 }], [{ monto: 30000 }])).toBe(70000);
  });

  it("abonos superan las ventas → saldo negativo (a favor)", () => {
    expect(calcularSaldoCliente([{ monto: 50000 }], [{ monto: 80000 }])).toBe(-30000);
  });
});

describe("calcularSaldosPorCliente", () => {
  it("agrupa correctamente por clienteId", () => {
    const saldos = calcularSaldosPorCliente(
      [
        { clienteId: "a", monto: 50000 },
        { clienteId: "b", monto: 20000 },
        { clienteId: "a", monto: 10000 },
      ],
      [{ clienteId: "a", monto: 15000 }]
    );
    expect(saldos.get("a")).toBe(45000); // 50.000 + 10.000 − 15.000
    expect(saldos.get("b")).toBe(20000);
  });

  it("un cliente que solo tiene abonos (sin ventas) queda con saldo negativo", () => {
    const saldos = calcularSaldosPorCliente([], [{ clienteId: "c", monto: 5000 }]);
    expect(saldos.get("c")).toBe(-5000);
  });

  it("array vacío devuelve un mapa vacío", () => {
    expect(calcularSaldosPorCliente([], []).size).toBe(0);
  });
});
