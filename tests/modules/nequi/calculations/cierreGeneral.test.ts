import { describe, expect, it } from "vitest";
import { calcularCierreGeneral } from "@/modules/nequi/calculations/cierreGeneral";

describe("calcularCierreGeneral", () => {
  it("reproduce la fila real del Excel 2024-11-03 T1 (venta 534.175)", () => {
    const r = calcularCierreGeneral({
      ventasPorMedio: { EFECTIVO: 534175 }, // el Excel viejo solo tenía el total; aquí como un medio
      facturasPagadas: 0,
      gastosVarios: 0,
      retiroCierre: 379400,
    });
    expect(r.ventaTotal).toBe(534175);
    expect(r.reposicionNeta).toBe(373922.5); // 534.175 × 0.7 − 0  (col F del Excel)
    expect(r.consignar).toBe(5477.5); // 379.400 − 373.922,5  (col J)
    expect(r.utilidadDia).toBe(160252.5); // 534.175 × 0.3
  });

  it("reproduce la fila real 2024-11-04 T1 con facturas pagadas (venta 736.600, facturas 28.000)", () => {
    const r = calcularCierreGeneral({
      ventasPorMedio: { EFECTIVO: 736600 },
      facturasPagadas: 28000,
      retiroCierre: 466600,
    });
    expect(r.reposicionNeta).toBeCloseTo(487620, 2); // 736.600×0.7 − 28.000  (col F)
    expect(r.consignar).toBeCloseTo(-21020, 2); // 466.600 − 487.620  (col J, negativo)
    expect(r.utilidadDia).toBeCloseTo(220980, 2); // 736.600 × 0.3
  });

  it("suma la venta de varios medios de pago (Dominium)", () => {
    const r = calcularCierreGeneral({
      ventasPorMedio: { EFECTIVO: 400000, NEQUI: 300000, TARJETA: 200000, CREDITO: 100000 },
    });
    expect(r.ventaTotal).toBe(1000000);
    expect(r.reposicionBruta).toBe(700000);
    expect(r.margenBruto).toBe(300000);
  });

  it("cuadre por medio: descuadre = real − esperado (falta en efectivo)", () => {
    const r = calcularCierreGeneral({
      ventasPorMedio: { EFECTIVO: 400000, NEQUI: 300000 },
      realPorMedio: { EFECTIVO: 398000 }, // contaron 2.000 menos en efectivo
    });
    const efectivo = r.cuadrePorMedio.find((c) => c.medio === "EFECTIVO")!;
    expect(efectivo.descuadre).toBe(-2000);
    const nequi = r.cuadrePorMedio.find((c) => c.medio === "NEQUI")!;
    expect(nequi.descuadre).toBe(0); // sin real → asume que cuadra
    expect(r.descuadreTotal).toBe(-2000);
  });

  it("incluye la venta sin factura en la base del 70/30", () => {
    const r = calcularCierreGeneral({
      ventasPorMedio: { EFECTIVO: 500000 },
      ventaSinFactura: 149000, // como la fila 2024-11-06 del Excel
    });
    expect(r.base).toBe(649000);
    expect(r.reposicionBruta).toBeCloseTo(454300, 2); // 649.000 × 0.7
  });
});
