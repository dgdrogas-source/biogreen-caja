import { describe, expect, it } from "vitest";
import { baseNequiFlow } from "@/modules/nequi/calculations/base";

describe("baseNequiFlow", () => {
  it("un retiro sube la porción en Nequi (baja la de efectivo)", () => {
    expect(baseNequiFlow("RETIRO_CLIENTE", "INCOME", 80_000, "NEQUI")).toBe(80_000);
  });

  it("una consignación baja la porción en Nequi (sube la de efectivo)", () => {
    // Ejemplo del dueño: consignación de 510.000 → efectivo +510.000, Nequi −510.000
    expect(baseNequiFlow("CONSIGNACION_CLIENTE", "EXPENSE", 510_000, "NEQUI")).toBe(-510_000);
  });

  it("ventas, abonos, comisiones, gastos y facturas NO tocan la base", () => {
    expect(baseNequiFlow("VENTA_FARMACIA", "INCOME", 45_000, "NEQUI")).toBe(0);
    expect(baseNequiFlow("ABONO_CREDITO", "INCOME", 30_000, "NEQUI")).toBe(0);
    expect(baseNequiFlow("COMISION", "INCOME", 2_000, "NEQUI")).toBe(0);
    expect(baseNequiFlow("PAGO_FACTURA", "EXPENSE", 150_000, "NEQUI")).toBe(0);
    expect(baseNequiFlow("GASTO_FARMACIA", "EXPENSE", 40_000, "NEQUI")).toBe(0);
  });

  it("un retiro/consignación marcado en efectivo no mueve la base", () => {
    expect(baseNequiFlow("RETIRO_CLIENTE", "INCOME", 80_000, "EFECTIVO")).toBe(0);
    expect(baseNequiFlow("CONSIGNACION_CLIENTE", "EXPENSE", 510_000, "EFECTIVO")).toBe(0);
  });
});
