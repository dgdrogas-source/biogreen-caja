import { describe, expect, it } from "vitest";
import {
  calcularResumenProducto,
  calcularStock,
  calcularTotalesLicores,
  costoUnitarioPromedio,
  estadoStock,
  puedeVender,
  type CompraLicor,
  type VentaLicor,
} from "@/modules/licores/calculations/inventario";

// Caso real de la entrevista (2026-07-19): 48 Heineken por $120.000 (→ $2.500 c/u),
// y luego 3 vendidas a $5.000 c/u.
const COMPRA_HEINEKEN: CompraLicor = { cantidad: 48, valorTotal: 120_000 };
const VENTA_HEINEKEN: VentaLicor = {
  cantidad: 3,
  precioUnitario: 5_000,
  costoUnitario: 2_500,
  esCredito: false,
};

describe("costoUnitarioPromedio", () => {
  it("caso real: 48 unidades por $120.000 → $2.500 c/u", () => {
    expect(costoUnitarioPromedio([COMPRA_HEINEKEN])).toBe(2_500);
  });

  it("pondera por unidades, no promedia precios", () => {
    // 10 a $1.000 c/u + 90 a $2.000 c/u → (10.000 + 180.000) / 100 = 1.900 (no 1.500)
    const r = costoUnitarioPromedio([
      { cantidad: 10, valorTotal: 10_000 },
      { cantidad: 90, valorTotal: 180_000 },
    ]);
    expect(r).toBe(1_900);
  });

  it("redondea a peso entero", () => {
    expect(costoUnitarioPromedio([{ cantidad: 3, valorTotal: 10_000 }])).toBe(3_333);
  });

  it("sin compras → 0 (no divide por cero)", () => {
    expect(costoUnitarioPromedio([])).toBe(0);
  });
});

describe("calcularStock", () => {
  it("comprado menos vendido", () => {
    expect(calcularStock([COMPRA_HEINEKEN], [VENTA_HEINEKEN])).toBe(45);
  });

  it("sin movimientos → 0 (el dueño arranca en cero)", () => {
    expect(calcularStock([], [])).toBe(0);
  });

  // Regresión del bug del 2026-07-19: la vendedora borraba el movimiento desde Nequi y la
  // venta seguía viva, así que el inventario nunca volvía. Una venta retirada de la lista
  // (soft-delete) tiene que devolver las unidades.
  it("al quitar una venta borrada, el stock vuelve a subir", () => {
    expect(calcularStock([COMPRA_HEINEKEN], [VENTA_HEINEKEN])).toBe(45);
    expect(calcularStock([COMPRA_HEINEKEN], [])).toBe(48);
  });

  it("al quitar una compra borrada, el stock vuelve a bajar", () => {
    expect(calcularStock([], [VENTA_HEINEKEN])).toBe(-3); // negativo = dato inconsistente visible
  });
});

describe("estadoStock", () => {
  it("0 o menos → agotado", () => {
    expect(estadoStock(0, 6)).toBe("AGOTADO");
    expect(estadoStock(-2, 6)).toBe("AGOTADO");
  });

  it("hasta el umbral inclusive → bajo", () => {
    expect(estadoStock(6, 6)).toBe("BAJO");
    expect(estadoStock(1, 6)).toBe("BAJO");
  });

  it("por encima del umbral → ok", () => {
    expect(estadoStock(7, 6)).toBe("OK");
  });

  it("respeta un umbral propio por marca", () => {
    expect(estadoStock(10, 15)).toBe("BAJO"); // marca que rota rápido
    expect(estadoStock(10, 3)).toBe("OK"); // marca que rota lento
  });
});

describe("puedeVender", () => {
  it("permite vender si alcanza el stock", () => {
    expect(puedeVender(45, 3)).toBe(true);
    expect(puedeVender(3, 3)).toBe(true); // justo lo último
  });

  it("bloquea si no alcanza o está agotado", () => {
    expect(puedeVender(2, 3)).toBe(false);
    expect(puedeVender(0, 1)).toBe(false);
  });

  it("bloquea cantidades no positivas", () => {
    expect(puedeVender(45, 0)).toBe(false);
    expect(puedeVender(45, -1)).toBe(false);
  });
});

describe("calcularResumenProducto", () => {
  it("caso real completo: compra 48 a $120.000, vende 3 a $5.000", () => {
    const r = calcularResumenProducto([COMPRA_HEINEKEN], [VENTA_HEINEKEN], 6);
    expect(r.stock).toBe(45);
    expect(r.estado).toBe("OK");
    expect(r.invertido).toBe(120_000);
    expect(r.ingresoVentas).toBe(15_000);
    expect(r.costoVendido).toBe(7_500);
    expect(r.ganancia).toBe(7_500); // el número que el dueño espera ver
    expect(r.margen).toBeCloseTo(0.5, 6);
    expect(r.porCobrar).toBe(0);
    expect(r.valorInventario).toBe(112_500); // 45 × 2.500
  });

  it("una venta a crédito cuenta la ganancia pero queda por cobrar", () => {
    const fiado: VentaLicor = { ...VENTA_HEINEKEN, esCredito: true };
    const r = calcularResumenProducto([COMPRA_HEINEKEN], [fiado], 6);
    expect(r.ganancia).toBe(7_500);
    expect(r.porCobrar).toBe(15_000);
  });

  it("respeta el costo CONGELADO de cada venta aunque el precio de compra cambie", () => {
    // Se vendió cuando costaba 2.000; después se compró más caro. El margen viejo no cambia.
    const ventaVieja: VentaLicor = {
      cantidad: 2,
      precioUnitario: 5_000,
      costoUnitario: 2_000,
      esCredito: false,
    };
    const r = calcularResumenProducto(
      [{ cantidad: 10, valorTotal: 20_000 }, { cantidad: 10, valorTotal: 40_000 }],
      [ventaVieja],
      6
    );
    expect(r.costoVendido).toBe(4_000); // 2 × 2.000, NO 2 × 3.000 (el promedio nuevo)
    expect(r.ganancia).toBe(6_000);
  });

  it("sin ventas → margen null (no divide por cero)", () => {
    const r = calcularResumenProducto([COMPRA_HEINEKEN], [], 6);
    expect(r.margen).toBeNull();
    expect(r.ganancia).toBe(0);
  });

  it("marca agotada queda marcada como tal", () => {
    const r = calcularResumenProducto(
      [{ cantidad: 3, valorTotal: 7_500 }],
      [{ cantidad: 3, precioUnitario: 5_000, costoUnitario: 2_500, esCredito: false }],
      6
    );
    expect(r.stock).toBe(0);
    expect(r.estado).toBe("AGOTADO");
    expect(r.valorInventario).toBe(0);
  });
});

describe("calcularTotalesLicores", () => {
  it("suma los resúmenes y cuenta las alertas", () => {
    const heineken = calcularResumenProducto([COMPRA_HEINEKEN], [VENTA_HEINEKEN], 6);
    // Corona: comprada y vendida completa → agotada
    const corona = calcularResumenProducto(
      [{ cantidad: 10, valorTotal: 30_000 }],
      [{ cantidad: 10, precioUnitario: 6_000, costoUnitario: 3_000, esCredito: true }],
      6
    );
    const t = calcularTotalesLicores([heineken, corona]);

    expect(t.invertido).toBe(150_000); // 120.000 + 30.000
    expect(t.ingresoVentas).toBe(75_000); // 15.000 + 60.000
    expect(t.costoVendido).toBe(37_500); // 7.500 + 30.000
    expect(t.ganancia).toBe(37_500);
    expect(t.margen).toBeCloseTo(0.5, 6);
    expect(t.porCobrar).toBe(60_000); // solo la Corona fiada
    expect(t.unidadesEnStock).toBe(45);
    expect(t.productosAgotados).toBe(1);
    expect(t.productosBajos).toBe(0);
  });

  it("sin productos → todo en cero y margen null", () => {
    const t = calcularTotalesLicores([]);
    expect(t.invertido).toBe(0);
    expect(t.ganancia).toBe(0);
    expect(t.margen).toBeNull();
  });
});
