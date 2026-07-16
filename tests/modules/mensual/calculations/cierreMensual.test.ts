import { describe, expect, it } from "vitest";
import {
  calcularCierreMensual,
  type CierreMensualInput,
} from "@/modules/mensual/calculations/cierreMensual";

// Base vacía reutilizable.
const vacio: CierreMensualInput = { dias: [], gastos: [], diferencias: [] };

describe("calcularCierreMensual", () => {
  it("mes vacío → todo en cero", () => {
    const r = calcularCierreMensual(vacio);
    expect(r.ventaTotal).toBe(0);
    expect(r.gastosTotal).toBe(0);
    expect(r.carteraAlCierre).toBe(0);
    expect(r.disponible).toBe(0);
    expect(r.gastosPorCategoria).toEqual([]);
  });

  it("suma la venta real de cada día (sin promedios)", () => {
    const r = calcularCierreMensual({
      ...vacio,
      dias: [
        { date: "2026-08-01", ventaDia: 300000, comisionTarjeta: 0, impuesto4x1000: 0, carteraTotal: 0 },
        { date: "2026-08-02", ventaDia: 250000, comisionTarjeta: 0, impuesto4x1000: 0, carteraTotal: 0 },
        { date: "2026-08-03", ventaDia: 400000, comisionTarjeta: 0, impuesto4x1000: 0, carteraTotal: 0 },
      ],
    });
    expect(r.ventaTotal).toBe(950000);
  });

  it("cartera al cierre = snapshot del día MÁS RECIENTE (no la suma)", () => {
    const r = calcularCierreMensual({
      ...vacio,
      dias: [
        { date: "2026-08-01", ventaDia: 0, comisionTarjeta: 0, impuesto4x1000: 0, carteraTotal: 100000 },
        { date: "2026-08-03", ventaDia: 0, comisionTarjeta: 0, impuesto4x1000: 0, carteraTotal: 80000 },
        { date: "2026-08-02", ventaDia: 0, comisionTarjeta: 0, impuesto4x1000: 0, carteraTotal: 120000 },
      ],
    });
    expect(r.carteraAlCierre).toBe(80000); // el del 03, aunque venga desordenado
  });

  it("agrupa gastos por categoría, ordenados de mayor a menor", () => {
    const r = calcularCierreMensual({
      ...vacio,
      gastos: [
        { date: "2026-08-01", categoriaId: "papeleria", categoriaNombre: "Papelería", monto: 20000 },
        { date: "2026-08-02", categoriaId: "nomina", categoriaNombre: "Nómina", monto: 500000 },
        { date: "2026-08-03", categoriaId: "papeleria", categoriaNombre: "Papelería", monto: 15000 },
      ],
    });
    expect(r.gastosTotal).toBe(535000);
    expect(r.gastosPorCategoria).toEqual([
      { categoriaId: "nomina", categoriaNombre: "Nómina", total: 500000 },
      { categoriaId: "papeleria", categoriaNombre: "Papelería", total: 35000 },
    ]);
  });

  it("el banco: comisión 4% + 4×1000 se acumulan y restan del disponible", () => {
    const r = calcularCierreMensual({
      ...vacio,
      dias: [
        { date: "2026-08-01", ventaDia: 1000000, comisionTarjeta: 8000, impuesto4x1000: 400, carteraTotal: 0 },
      ],
    });
    expect(r.comisionTotal).toBe(8000);
    expect(r.impuesto4x1000Total).toBe(400);
    expect(r.cargosBancoTotal).toBe(8400);
    expect(r.disponible).toBe(1000000 - 0 - 0 - 8000 - 400); // 991600
  });

  it("SOBRANTE suma al disponible", () => {
    const r = calcularCierreMensual({
      ...vacio,
      dias: [{ date: "2026-08-01", ventaDia: 100000, comisionTarjeta: 0, impuesto4x1000: 0, carteraTotal: 0 }],
      diferencias: [{ date: "2026-08-01", cierre: "EFECTIVO", tipo: "SOBRANTE", monto: 3000 }],
    });
    expect(r.sobrantesTotal).toBe(3000);
    expect(r.ajusteDiferencias).toBe(3000);
    expect(r.disponible).toBe(103000);
  });

  it("FALTANTE que cubre la empleada NO toca el disponible", () => {
    const r = calcularCierreMensual({
      ...vacio,
      dias: [{ date: "2026-08-01", ventaDia: 100000, comisionTarjeta: 0, impuesto4x1000: 0, carteraTotal: 0 }],
      diferencias: [
        { date: "2026-08-01", cierre: "NEQUI", tipo: "FALTANTE", monto: 5000, disposicion: "CUBRE_EMPLEADA" },
      ],
    });
    expect(r.faltantesTotal).toBe(5000);
    expect(r.faltantesCubiertosEmpleada).toBe(5000);
    expect(r.faltantesQueDescuentan).toBe(0);
    expect(r.ajusteDiferencias).toBe(0);
    expect(r.disponible).toBe(100000); // intacto
  });

  it("FALTANTE marcado 'descontar' SÍ resta del disponible", () => {
    const r = calcularCierreMensual({
      ...vacio,
      dias: [{ date: "2026-08-01", ventaDia: 100000, comisionTarjeta: 0, impuesto4x1000: 0, carteraTotal: 0 }],
      diferencias: [
        { date: "2026-08-01", cierre: "BANCO", tipo: "FALTANTE", monto: 5000, disposicion: "DESCUENTA_DISPONIBLE" },
      ],
    });
    expect(r.faltantesQueDescuentan).toBe(5000);
    expect(r.ajusteDiferencias).toBe(-5000);
    expect(r.disponible).toBe(95000);
  });

  it("FALTANTE pendiente (sin decisión) todavía NO descuenta, pero se reporta", () => {
    const r = calcularCierreMensual({
      ...vacio,
      dias: [{ date: "2026-08-01", ventaDia: 100000, comisionTarjeta: 0, impuesto4x1000: 0, carteraTotal: 0 }],
      diferencias: [{ date: "2026-08-01", cierre: "EFECTIVO", tipo: "FALTANTE", monto: 5000 }],
    });
    expect(r.faltantesPendientes).toBe(5000);
    expect(r.faltantesQueDescuentan).toBe(0);
    expect(r.disponible).toBe(100000);
  });

  it("ejemplo integral del mes (venta − cartera − gastos − 4% − 4×1000 + ajuste)", () => {
    const r = calcularCierreMensual({
      dias: [
        { date: "2026-08-01", ventaDia: 650000, comisionTarjeta: 8000, impuesto4x1000: 400, carteraTotal: 120000 },
        { date: "2026-08-02", ventaDia: 500000, comisionTarjeta: 6000, impuesto4x1000: 0, carteraTotal: 100000 },
      ],
      gastos: [
        { date: "2026-08-01", categoriaId: "pap", categoriaNombre: "Papelería", monto: 20000 },
        { date: "2026-08-02", categoriaId: "ser", categoriaNombre: "Servicios", monto: 80000 },
      ],
      diferencias: [
        { date: "2026-08-01", cierre: "NEQUI", tipo: "FALTANTE", monto: 5000, disposicion: "CUBRE_EMPLEADA" },
        { date: "2026-08-02", cierre: "EFECTIVO", tipo: "SOBRANTE", monto: 2000 },
      ],
    });
    // venta = 1.150.000 ; cartera (último día) = 100.000 ; gastos = 100.000
    // comisión = 14.000 ; 4x1000 = 400 ; ajuste = +2.000 (sobrante) − 0 (faltante lo cubre empleada)
    expect(r.ventaTotal).toBe(1150000);
    expect(r.carteraAlCierre).toBe(100000);
    expect(r.gastosTotal).toBe(100000);
    expect(r.comisionTotal).toBe(14000);
    expect(r.impuesto4x1000Total).toBe(400);
    expect(r.ajusteDiferencias).toBe(2000);
    const esperado = 1150000 - 100000 - 100000 - 14000 - 400 + 2000; // 937.600
    expect(r.disponible).toBe(esperado);
    expect(r.disponible).toBe(937600);
  });
});
