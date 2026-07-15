import { describe, expect, it } from "vitest";
import { diffDays, startOfIsoWeek, startOfMonth } from "@/lib/dates";

describe("startOfIsoWeek", () => {
  it("un lunes devuelve la misma fecha", () => {
    expect(startOfIsoWeek("2026-07-13")).toBe("2026-07-13"); // lunes
  });

  it("un domingo devuelve el lunes de esa misma semana (6 días antes)", () => {
    expect(startOfIsoWeek("2026-07-19")).toBe("2026-07-13"); // domingo → lunes previo
  });

  it("un miércoles devuelve el lunes de esa semana", () => {
    expect(startOfIsoWeek("2026-07-15")).toBe("2026-07-13");
  });

  it("un sábado devuelve el lunes de esa semana", () => {
    expect(startOfIsoWeek("2026-07-18")).toBe("2026-07-13");
  });

  it("cruza el límite de mes correctamente", () => {
    expect(startOfIsoWeek("2026-08-02")).toBe("2026-07-27"); // domingo 2-ago → lunes 27-jul
  });
});

describe("startOfMonth", () => {
  it("devuelve el día 01 del mismo mes", () => {
    expect(startOfMonth("2026-07-19")).toBe("2026-07-01");
  });

  it("funciona en el primer día del mes", () => {
    expect(startOfMonth("2026-07-01")).toBe("2026-07-01");
  });

  it("funciona en el último día del mes", () => {
    expect(startOfMonth("2026-02-28")).toBe("2026-02-01");
  });
});

describe("diffDays", () => {
  it("misma fecha → 0", () => {
    expect(diffDays("2026-07-13", "2026-07-13")).toBe(0);
  });

  it("b posterior a a → positivo", () => {
    expect(diffDays("2026-07-13", "2026-07-19")).toBe(6);
  });

  it("b anterior a a → negativo", () => {
    expect(diffDays("2026-07-19", "2026-07-13")).toBe(-6);
  });

  it("cruza el límite de mes", () => {
    expect(diffDays("2026-07-27", "2026-08-02")).toBe(6);
  });
});
