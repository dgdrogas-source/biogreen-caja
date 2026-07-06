import { describe, expect, it } from "vitest";
import {
  aplicarTransferencias,
  calcularApartadoEnBolsillos,
  calcularDisponible,
  calcularSaldoPorBolsillo,
  type PocketResumen,
} from "@/modules/nequi/calculations/pockets";

describe("calcularSaldoPorBolsillo", () => {
  it("suma ingresos y egresos solo del bolsillo indicado", () => {
    const r = calcularSaldoPorBolsillo("COMISION", [
      { amount: 2_000, direction: "INCOME", pettyCashBucket: "COMISION" },
      { amount: 3_000, direction: "INCOME", pettyCashBucket: "COMISION" },
      { amount: 800, direction: "EXPENSE", pettyCashBucket: "COMISION" },
      { amount: 1_200, direction: "EXPENSE", pettyCashBucket: "COMISION" },
    ]);
    expect(r.ingresos).toBe(5_000);
    expect(r.egresos).toBe(2_000);
    expect(r.disponible).toBe(3_000);
  });

  it("ignora filas de otros bolsillos o sin bolsillo", () => {
    const r = calcularSaldoPorBolsillo("LICORES_JHOANN", [
      { amount: 5_000, direction: "INCOME", pettyCashBucket: "FUXION" },
      { amount: 4_000, direction: "EXPENSE", pettyCashBucket: null },
    ]);
    expect(r.ingresos).toBe(0);
    expect(r.egresos).toBe(0);
    expect(r.disponible).toBe(0);
  });

  it("los bolsillos son independientes entre sí", () => {
    const rows = [
      { amount: 10_000, direction: "INCOME" as const, pettyCashBucket: "FUXION" },
      { amount: 3_000, direction: "EXPENSE" as const, pettyCashBucket: "FUXION" },
      { amount: 8_000, direction: "INCOME" as const, pettyCashBucket: "LICORES_JHOANN" },
    ];
    const fuxion = calcularSaldoPorBolsillo("FUXION", rows);
    const licores = calcularSaldoPorBolsillo("LICORES_JHOANN", rows);
    expect(fuxion.disponible).toBe(7_000);
    expect(licores.disponible).toBe(8_000);
  });

  it("el bolsillo puede quedar negativo si se paga más de lo acumulado", () => {
    const r = calcularSaldoPorBolsillo("BASE_FACTURAS", [
      { amount: 1_000, direction: "INCOME", pettyCashBucket: "BASE_FACTURAS" },
      { amount: 5_000, direction: "EXPENSE", pettyCashBucket: "BASE_FACTURAS" },
    ]);
    expect(r.disponible).toBe(-4_000);
  });

  it("suma el saldo inicial manual al disponible calculado", () => {
    const r = calcularSaldoPorBolsillo(
      "COMISION",
      [
        { amount: 15_000, direction: "INCOME", pettyCashBucket: "COMISION" },
        { amount: 4_560, direction: "EXPENSE", pettyCashBucket: "COMISION" },
      ],
      42_960
    );
    expect(r.ingresos).toBe(15_000);
    expect(r.egresos).toBe(4_560);
    expect(r.openingBalance).toBe(42_960);
    expect(r.disponible).toBe(53_400); // 42_960 + 15_000 - 4_560
  });

  it("sin saldo inicial (default), el disponible es solo la actividad de movimientos", () => {
    const r = calcularSaldoPorBolsillo("FUXION", [
      { amount: 8_000, direction: "INCOME", pettyCashBucket: "FUXION" },
    ]);
    expect(r.openingBalance).toBe(0);
    expect(r.disponible).toBe(8_000);
  });
});

function pocket(disponible: number): PocketResumen {
  return { ingresos: Math.max(disponible, 0), egresos: 0, openingBalance: 0, disponible };
}

describe("calcularApartadoEnBolsillos", () => {
  it("suma los cuatro bolsillos apartados; Comisiones NO entra en el total", () => {
    const r = calcularApartadoEnBolsillos({
      COMISION: pocket(50_000),
      LICORES_JHOANN: pocket(10_000),
      FUXION: pocket(5_000),
      BASE_FACTURAS: pocket(20_000),
      PENDIENTE_OTRO: pocket(7_000),
    });
    expect(r.totalApartado).toBe(42_000); // 10.000 + 5.000 + 20.000 + 7.000 (sin las Comisiones)
    expect(r.comisionesDisponible).toBe(50_000); // se conserva para mostrarlo, pero no se aparta
    expect(r.licoresDisponible).toBe(10_000);
    expect(r.fuxionDisponible).toBe(5_000);
    expect(r.baseDisponible).toBe(20_000);
    expect(r.pendienteOtroDisponible).toBe(7_000);
  });

  it("reproduce el caso real: apartado total de 4.028.906 (Comisiones fuera)", () => {
    const r = calcularApartadoEnBolsillos({
      COMISION: pocket(52_394),
      LICORES_JHOANN: pocket(322_901),
      FUXION: pocket(195_672),
      BASE_FACTURAS: pocket(607_733),
      PENDIENTE_OTRO: pocket(2_902_600),
    });
    expect(r.totalApartado).toBe(4_028_906); // 4.081.300 − 52.394 de Comisiones
    expect(r.comisionesDisponible).toBe(52_394);
  });

  it("clampa bolsillos negativos a 0 para no inflar el apartado", () => {
    const r = calcularApartadoEnBolsillos({
      COMISION: pocket(-500),
      LICORES_JHOANN: pocket(-3_000),
      FUXION: pocket(5_000),
      BASE_FACTURAS: pocket(0),
      PENDIENTE_OTRO: pocket(-1_000),
    });
    expect(r.comisionesDisponible).toBe(0);
    expect(r.licoresDisponible).toBe(0);
    expect(r.pendienteOtroDisponible).toBe(0);
    expect(r.totalApartado).toBe(5_000);
  });
});

describe("calcularDisponible", () => {
  it("es el saldo de Nequi menos lo apartado en bolsillos", () => {
    // Caso real: saldo 4.753.645 con 4.028.906 apartados → 724.739 libres.
    // La base para consignaciones ya está dentro del saldo (no se suma ni se resta):
    // al no estar apartada, queda contada dentro del disponible.
    expect(calcularDisponible(4_753_645, 4_028_906)).toBe(724_739);
  });

  it("sin nada apartado, el disponible es todo el saldo de Nequi", () => {
    expect(calcularDisponible(500_000, 0)).toBe(500_000);
  });

  it("puede quedar negativo si lo apartado supera el saldo de Nequi", () => {
    expect(calcularDisponible(10_000, 100_000)).toBe(-90_000);
  });
});

describe("aplicarTransferencias", () => {
  it("resta del origen y suma al destino", () => {
    const base = {
      LICORES_JHOANN: pocket(10_000),
      FUXION: pocket(2_000),
      BASE_FACTURAS: pocket(0),
    };
    const r = aplicarTransferencias(base, [
      { fromBucket: "LICORES_JHOANN", toBucket: "FUXION", amount: 3_000 },
    ]);
    expect(r.LICORES_JHOANN.disponible).toBe(7_000);
    expect(r.FUXION.disponible).toBe(5_000);
    expect(r.BASE_FACTURAS.disponible).toBe(0);
  });

  it("ignora el lado DISPONIBLE (bolsillo virtual, no está en el mapa)", () => {
    const base = { LICORES_JHOANN: pocket(10_000) };
    // Apartar desde Disponible hacia Licores: solo se ve el lado real (Licores sube).
    const r = aplicarTransferencias(base, [
      { fromBucket: "DISPONIBLE", toBucket: "LICORES_JHOANN", amount: 4_000 },
    ]);
    expect(r.LICORES_JHOANN.disponible).toBe(14_000);
  });

  it("aplica varias transferencias en orden", () => {
    const base = {
      LICORES_JHOANN: pocket(10_000),
      FUXION: pocket(0),
      BASE_FACTURAS: pocket(0),
    };
    const r = aplicarTransferencias(base, [
      { fromBucket: "LICORES_JHOANN", toBucket: "FUXION", amount: 4_000 },
      { fromBucket: "FUXION", toBucket: "BASE_FACTURAS", amount: 1_000 },
    ]);
    expect(r.LICORES_JHOANN.disponible).toBe(6_000);
    expect(r.FUXION.disponible).toBe(3_000);
    expect(r.BASE_FACTURAS.disponible).toBe(1_000);
  });
});
