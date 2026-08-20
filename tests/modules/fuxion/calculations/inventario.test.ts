import { describe, expect, it } from "vitest";
import {
  calcularResumenProducto,
  calcularStock,
  calcularTotalesFuxion,
  costoUnitarioPromedio,
  estadoStock,
  puedeVender,
  type CompraFuxion,
  type VentaFuxion,
} from "@/modules/fuxion/calculations/inventario";

// Caso real del Excel (2026-08-20): una bolsa de PRUNEX trae 28 sobres y cuesta $117.385
// (→ $4.192 c/u), y se vende a $5.500 el sobre.
const BOLSA_PRUNEX: CompraFuxion = { cantidad: 28, valorTotal: 117_385 };
const VENTA_PRUNEX: VentaFuxion = {
  cantidad: 8,
  precioUnitario: 5_500,
  costoUnitario: 4_192,
  esCredito: false,
};

describe("costoUnitarioPromedio", () => {
  it("caso real: bolsa de 28 por $117.385 → $4.192 c/u", () => {
    expect(costoUnitarioPromedio([BOLSA_PRUNEX])).toBe(4_192);
  });

  it("pondera por unidades, no promedia precios", () => {
    // 28 a ~4.192 + 7 a ~5.071 → (117.385 + 35.500) / 35 = 4.368 (no el promedio simple)
    expect(
      costoUnitarioPromedio([BOLSA_PRUNEX, { cantidad: 7, valorTotal: 35_500 }])
    ).toBe(4_368);
  });

  it("sin compras devuelve 0 (no divide por cero)", () => {
    expect(costoUnitarioPromedio([])).toBe(0);
  });
});

describe("calcularStock", () => {
  it("suma el inventario inicial: es la diferencia con Licores", () => {
    // 20 PRUNEX contados al arrancar el módulo, sin compras ni ventas todavía.
    expect(calcularStock(20, [], [])).toBe(20);
  });

  it("inicial + compras − ventas", () => {
    expect(calcularStock(20, [BOLSA_PRUNEX], [VENTA_PRUNEX])).toBe(40); // 20 + 28 − 8
  });

  it("sin inventario inicial se comporta como Licores", () => {
    expect(calcularStock(0, [BOLSA_PRUNEX], [VENTA_PRUNEX])).toBe(20);
  });

  it("puede dar negativo si se borró una compra ya vendida (no se oculta)", () => {
    expect(calcularStock(0, [], [VENTA_PRUNEX])).toBe(-8);
  });
});

describe("estadoStock", () => {
  it("0 o menos → AGOTADO", () => {
    expect(estadoStock(0, 6)).toBe("AGOTADO");
    expect(estadoStock(-3, 6)).toBe("AGOTADO");
  });

  it("hasta el umbral inclusive → BAJO", () => {
    expect(estadoStock(6, 6)).toBe("BAJO");
    expect(estadoStock(1, 6)).toBe("BAJO");
  });

  it("por encima del umbral → OK", () => {
    expect(estadoStock(7, 6)).toBe("OK");
  });
});

describe("puedeVender", () => {
  it("regla dura: sin stock no se vende", () => {
    expect(puedeVender(0, 1)).toBe(false);
  });

  it("no alcanza para la cantidad pedida", () => {
    expect(puedeVender(3, 4)).toBe(false);
  });

  it("alcanza justo", () => {
    expect(puedeVender(4, 4)).toBe(true);
  });

  it("cantidad cero o negativa nunca es válida", () => {
    expect(puedeVender(10, 0)).toBe(false);
    expect(puedeVender(10, -2)).toBe(false);
  });
});

describe("calcularResumenProducto", () => {
  it("caso real completo de una bolsa de PRUNEX", () => {
    const r = calcularResumenProducto(0, [BOLSA_PRUNEX], [VENTA_PRUNEX], 6);
    expect(r.stock).toBe(20); // 28 − 8
    expect(r.estado).toBe("OK");
    expect(r.invertido).toBe(117_385);
    expect(r.ingresoVentas).toBe(44_000); // 8 × 5.500
    expect(r.costoVendido).toBe(33_536); // 8 × 4.192
    expect(r.ganancia).toBe(10_464);
    expect(r.valorInventario).toBe(83_840); // 20 × 4.192
  });

  it("la bolsa completa vendida deja la ganancia esperada (~24%)", () => {
    const r = calcularResumenProducto(
      0,
      [BOLSA_PRUNEX],
      [{ cantidad: 28, precioUnitario: 5_500, costoUnitario: 4_192, esCredito: false }],
      6
    );
    expect(r.ingresoVentas).toBe(154_000); // 28 × 5.500
    expect(r.ganancia).toBe(36_624); // ≈ los 36.615 del Excel (redondeo del costo unitario)
    expect(r.margen).toBeCloseTo(0.2378, 3);
    expect(r.estado).toBe("AGOTADO");
  });

  it("margen null si no hubo ventas (evita dividir por cero)", () => {
    expect(calcularResumenProducto(0, [BOLSA_PRUNEX], [], 6).margen).toBeNull();
  });

  it("porCobrar solo cuenta las ventas a crédito", () => {
    const r = calcularResumenProducto(
      0,
      [BOLSA_PRUNEX],
      [
        VENTA_PRUNEX,
        { cantidad: 2, precioUnitario: 5_500, costoUnitario: 4_192, esCredito: true },
      ],
      6
    );
    expect(r.porCobrar).toBe(11_000); // solo las 2 fiadas
    expect(r.ingresoVentas).toBe(55_000); // pero el ingreso las incluye
  });

  it("el inventario inicial entra al stock y al valor del inventario", () => {
    const r = calcularResumenProducto(20, [], [], 6);
    expect(r.stock).toBe(20);
    expect(r.valorInventario).toBe(0); // sin compras no hay costo conocido todavía
  });
});

describe("calcularTotalesFuxion", () => {
  it("suma resultados ya calculados, no recalcula sobre totales crudos", () => {
    const a = calcularResumenProducto(0, [BOLSA_PRUNEX], [VENTA_PRUNEX], 6);
    const b = calcularResumenProducto(
      0,
      [{ cantidad: 28, valorTotal: 140_000 }],
      [{ cantidad: 1, precioUnitario: 6_500, costoUnitario: 5_000, esCredito: false }],
      6
    );
    const t = calcularTotalesFuxion([a, b]);
    expect(t.invertido).toBe(257_385);
    expect(t.ingresoVentas).toBe(50_500);
    expect(t.ganancia).toBe(a.ganancia + b.ganancia);
    expect(t.unidadesEnStock).toBe(a.stock + b.stock);
  });

  it("cuenta agotados y bajos por separado", () => {
    const agotado = calcularResumenProducto(0, [], [], 6);
    const bajo = calcularResumenProducto(3, [], [], 6);
    const ok = calcularResumenProducto(30, [], [], 6);
    const t = calcularTotalesFuxion([agotado, bajo, ok]);
    expect(t.productosAgotados).toBe(1);
    expect(t.productosBajos).toBe(1);
  });

  it("sin ventas el margen global es null", () => {
    expect(calcularTotalesFuxion([calcularResumenProducto(0, [BOLSA_PRUNEX], [], 6)]).margen).toBeNull();
  });
});
