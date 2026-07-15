import { describe, expect, it } from "vitest";
import { sumarConFallback, sumarEfectivoCaja } from "@/modules/nequi/calculations/cierreGeneralItems";

describe("sumarConFallback", () => {
  it("sin items, devuelve el valor legado", () => {
    expect(sumarConFallback(50000, [])).toBe(50000);
  });

  it("con items, suma los items e ignora el valor legado", () => {
    expect(sumarConFallback(999999, [{ monto: 10000 }, { monto: 5000 }])).toBe(15000);
  });

  it("items vacío y legado 0 → 0", () => {
    expect(sumarConFallback(0, [])).toBe(0);
  });

  it("un solo item", () => {
    expect(sumarConFallback(0, [{ monto: 7000 }])).toBe(7000);
  });
});

describe("sumarEfectivoCaja", () => {
  it("suma items sin metodoPago (legado) como caja principal", () => {
    expect(sumarEfectivoCaja([{ monto: 10000, metodoPago: null }])).toBe(10000);
  });

  it("suma items EFECTIVO_CAJA explícitos", () => {
    expect(sumarEfectivoCaja([{ monto: 10000, metodoPago: "EFECTIVO_CAJA" }])).toBe(10000);
  });

  it("ignora items pagados del sobre blanco", () => {
    expect(sumarEfectivoCaja([{ monto: 10000, metodoPago: "EFECTIVO_SOBRE" }])).toBe(0);
  });

  it("ignora items pagados por Nequi, datáfono, transferencia u otro", () => {
    const items = [
      { monto: 1000, metodoPago: "NEQUI" },
      { monto: 2000, metodoPago: "DATAFONO" },
      { monto: 3000, metodoPago: "TRANSFERENCIA" },
      { monto: 4000, metodoPago: "OTRO" },
    ];
    expect(sumarEfectivoCaja(items)).toBe(0);
  });

  it("mezcla: solo suma los de caja principal (explícitos o legados)", () => {
    const items = [
      { monto: 100000, metodoPago: null },
      { monto: 50000, metodoPago: "EFECTIVO_CAJA" },
      { monto: 30000, metodoPago: "EFECTIVO_SOBRE" },
      { monto: 20000, metodoPago: "NEQUI" },
    ];
    expect(sumarEfectivoCaja(items)).toBe(150000);
  });
});
