import { describe, expect, it } from "vitest";
import {
  calcularCarteraTotal,
  calcularSaldoCliente,
  calcularSaldosPorCliente,
} from "@/modules/fuxion/calculations/cartera";

describe("calcularSaldoCliente", () => {
  it("saldo = deuda − abonado", () => {
    const r = calcularSaldoCliente(
      [{ clienteId: "c1", precioUnitario: 5_500, cantidad: 4 }],
      [{ clienteId: "c1", monto: 10_000 }]
    );
    expect(r.deuda).toBe(22_000);
    expect(r.abonado).toBe(10_000);
    expect(r.saldo).toBe(12_000);
  });

  it("queda negativo si abonó de más y NO se recorta a cero", () => {
    const r = calcularSaldoCliente(
      [{ clienteId: "c1", precioUnitario: 5_500, cantidad: 1 }],
      [{ clienteId: "c1", monto: 10_000 }]
    );
    expect(r.saldo).toBe(-4_500);
  });

  it("sin ventas ni abonos todo en cero", () => {
    expect(calcularSaldoCliente([], [])).toEqual({ deuda: 0, abonado: 0, saldo: 0 });
  });
});

describe("calcularSaldosPorCliente", () => {
  it("agrupa por cliente sin mezclar deudas", () => {
    const m = calcularSaldosPorCliente(
      [
        { clienteId: "a", precioUnitario: 5_500, cantidad: 2 },
        { clienteId: "b", precioUnitario: 5_500, cantidad: 1 },
      ],
      [{ clienteId: "a", monto: 5_000 }]
    );
    expect(m.get("a")?.saldo).toBe(6_000);
    expect(m.get("b")?.saldo).toBe(5_500);
  });

  it("incluye a quien solo tiene abonos (saldo a favor)", () => {
    const m = calcularSaldosPorCliente([], [{ clienteId: "z", monto: 3_000 }]);
    expect(m.get("z")?.saldo).toBe(-3_000);
  });
});

describe("calcularCarteraTotal", () => {
  it("solo suma saldos POSITIVOS: quien pagó de más no tapa la deuda de otro", () => {
    const m = calcularSaldosPorCliente(
      [{ clienteId: "deudor", precioUnitario: 5_500, cantidad: 4 }],
      [{ clienteId: "adelantado", monto: 50_000 }]
    );
    expect(calcularCarteraTotal(m.values())).toBe(22_000); // no 22.000 − 50.000
  });

  it("cartera vacía es cero", () => {
    expect(calcularCarteraTotal([])).toBe(0);
  });
});
