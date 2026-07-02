import { describe, expect, it } from "vitest";
import {
  aplica4x1000,
  calcularImpuesto4x1000,
} from "@/modules/nequi/calculations/impuesto4x1000";

describe("aplica4x1000", () => {
  it("aplica a egresos por Nequi: consignación, factura, gasto", () => {
    expect(aplica4x1000("CONSIGNACION_CLIENTE", "NEQUI")).toBe(true);
    expect(aplica4x1000("PAGO_FACTURA", "NEQUI")).toBe(true);
    expect(aplica4x1000("GASTO_FARMACIA", "NEQUI")).toBe(true);
  });

  it("NO aplica si el medio de pago es efectivo", () => {
    expect(aplica4x1000("CONSIGNACION_CLIENTE", "EFECTIVO")).toBe(false);
    expect(aplica4x1000("PAGO_FACTURA", "EFECTIVO")).toBe(false);
    expect(aplica4x1000("GASTO_FARMACIA", "EFECTIVO")).toBe(false);
  });

  it("NO aplica a dinero que entra: ventas, abonos, retiros, comisiones", () => {
    expect(aplica4x1000("VENTA_FARMACIA", "NEQUI")).toBe(false);
    expect(aplica4x1000("ABONO_CREDITO", "NEQUI")).toBe(false);
    expect(aplica4x1000("RETIRO_CLIENTE", "NEQUI")).toBe(false);
    expect(aplica4x1000("COMISION", "NEQUI")).toBe(false);
    expect(aplica4x1000("VENTA_FUXION", "NEQUI")).toBe(false);
    expect(aplica4x1000("VENTA_LICORES_JHOANN", "NEQUI")).toBe(false);
  });

  it("calcula 4 pesos por cada 1.000 (0.4%)", () => {
    expect(calcularImpuesto4x1000(200_000)).toBe(800);
    expect(calcularImpuesto4x1000(150_000)).toBe(600);
    expect(calcularImpuesto4x1000(1_000)).toBe(4);
  });

  it("redondea al peso cuando el monto no es múltiplo de 250", () => {
    expect(calcularImpuesto4x1000(1_100)).toBe(4); // 4.4 → 4
    expect(calcularImpuesto4x1000(1_150)).toBe(5); // 4.6 → 5
  });
});
