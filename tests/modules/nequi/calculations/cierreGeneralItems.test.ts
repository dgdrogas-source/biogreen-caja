import { describe, expect, it } from "vitest";
import { sumarConFallback } from "@/modules/nequi/calculations/cierreGeneralItems";

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
