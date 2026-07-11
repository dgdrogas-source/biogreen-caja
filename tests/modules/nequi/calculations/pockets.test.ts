import { describe, expect, it } from "vitest";
import {
  aplicarTransferencias,
  calcularApartadoEnBolsillos,
  calcularDisponible,
  calcularRepartoPorMedio,
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

describe("calcularRepartoPorMedio", () => {
  const rows = [
    { amount: 5_000, direction: "INCOME" as const, pettyCashBucket: "COMISION", paymentMethod: "NEQUI" as const },
    { amount: 4_000, direction: "INCOME" as const, pettyCashBucket: "COMISION", paymentMethod: "EFECTIVO" as const },
    { amount: 3_904, direction: "EXPENSE" as const, pettyCashBucket: "COMISION", paymentMethod: "NEQUI" as const },
    { amount: 1_000, direction: "INCOME" as const, pettyCashBucket: "FUXION", paymentMethod: "EFECTIVO" as const },
  ];

  it("separa el disponible del bolsillo por medio de pago (saldo inicial cuenta como Nequi)", () => {
    const r = calcularRepartoPorMedio("COMISION", rows, 69_962);
    expect(r.nequi).toBe(71_058); // 69.962 + 5.000 − 3.904
    expect(r.efectivo).toBe(4_000);
  });

  it("invariante: nequi + efectivo = disponible del bolsillo", () => {
    const reparto = calcularRepartoPorMedio("COMISION", rows, 69_962);
    const resumen = calcularSaldoPorBolsillo("COMISION", rows, 69_962);
    expect(reparto.nequi + reparto.efectivo).toBe(resumen.disponible);
  });

  it("un lado puede quedar negativo si se pagó más de lo que entró por ese medio", () => {
    const r = calcularRepartoPorMedio("COMISION", [
      { amount: 2_000, direction: "INCOME", pettyCashBucket: "COMISION", paymentMethod: "NEQUI" },
      { amount: 5_000, direction: "EXPENSE", pettyCashBucket: "COMISION", paymentMethod: "EFECTIVO" },
    ]);
    expect(r.nequi).toBe(2_000);
    expect(r.efectivo).toBe(-5_000);
  });

  it("el saldo inicial en efectivo arranca el lado del efectivo", () => {
    // opening Nequi 69.962, opening efectivo 30.000
    const r = calcularRepartoPorMedio("COMISION", rows, 69_962, 30_000);
    expect(r.nequi).toBe(71_058); // 69.962 + 5.000 − 3.904
    expect(r.efectivo).toBe(34_000); // 30.000 + 4.000
    // el disponible incluye ambos saldos iniciales y sigue cuadrando con el reparto
    const resumen = calcularSaldoPorBolsillo("COMISION", rows, 69_962, 30_000);
    expect(resumen.disponible).toBe(105_058);
    expect(r.nequi + r.efectivo).toBe(resumen.disponible);
  });
});

function pocket(disponible: number): PocketResumen {
  return {
    ingresos: Math.max(disponible, 0),
    egresos: 0,
    openingBalance: 0,
    openingEfectivo: 0,
    disponible,
  };
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
  it("resta lo apartado en bolsillos Y la porción en Nequi de la base para consignaciones", () => {
    // Saldo 5.000.000, con 3.000.000 apartados en bolsillos y 1.000.000 de base en Nequi
    // → quedan 1.000.000 disponibles (que aún incluyen las comisiones).
    expect(calcularDisponible(5_000_000, 3_000_000, 1_000_000)).toBe(1_000_000);
  });

  it("sin base (default 0), el disponible es solo saldo − bolsillos", () => {
    expect(calcularDisponible(500_000, 0)).toBe(500_000);
    expect(calcularDisponible(4_753_645, 4_028_906)).toBe(724_739);
  });

  it("puede quedar negativo si lo apartado + la base superan el saldo de Nequi", () => {
    expect(calcularDisponible(500_000, 0, 2_000_000)).toBe(-1_500_000);
  });
});

// Escenario del dueño: los tres valores son la misma bolsa (Nequi) y siempre cuadran.
//   Saldo esperado = Disponible(puro) + Base(Nequi) + Comisiones + Bolsillos
// El "Disponible" que se muestra en pantalla incluye las comisiones (no las resta),
// por eso se ve mayor que el disponible puro.
describe("acople esperado ↔ disponible ↔ base (escenario del dueño)", () => {
  // Suma de los cuatro términos independientes; debe dar siempre el saldo esperado.
  function invariante(
    esperado: number,
    baseNequi: number,
    pockets: Record<string, PocketResumen>
  ) {
    const apartado = calcularApartadoEnBolsillos(pockets);
    const disponibleMostrado = calcularDisponible(esperado, apartado.totalApartado, baseNequi);
    const comisiones = apartado.comisionesDisponible;
    const disponiblePuro = disponibleMostrado - comisiones;
    const suma = disponiblePuro + baseNequi + comisiones + apartado.totalApartado;
    return { disponibleMostrado, disponiblePuro, comisiones, apartado, suma };
  }

  it("inicio del día: 5.000.000 = 950.000 disp + 1.000.000 base + 50.000 comis + 3.000.000 bolsillos", () => {
    const r = invariante(5_000_000, 1_000_000, {
      COMISION: pocket(50_000),
      LICORES_JHOANN: pocket(1_000_000),
      FUXION: pocket(1_000_000),
      BASE_FACTURAS: pocket(1_000_000),
      PENDIENTE_OTRO: pocket(0),
    });
    expect(r.apartado.totalApartado).toBe(3_000_000);
    expect(r.disponiblePuro).toBe(950_000);
    expect(r.disponibleMostrado).toBe(1_000_000); // incluye las comisiones
    expect(r.suma).toBe(5_000_000); // los cuatro términos cuadran con el esperado
  });

  it("tras un retiro de 50.000 (comisión 1.000): el disponible mostrado es 1.001.000 y todo cuadra", () => {
    // El retiro sube el saldo esperado (+50.000) y la base en Nequi (+50.000): se cancelan,
    // el disponible no se mueve. La comisión (+1.000) sube el esperado y las comisiones.
    const r = invariante(5_051_000, 1_050_000, {
      COMISION: pocket(51_000),
      LICORES_JHOANN: pocket(1_000_000),
      FUXION: pocket(1_000_000),
      BASE_FACTURAS: pocket(1_000_000),
      PENDIENTE_OTRO: pocket(0),
    });
    expect(r.disponibleMostrado).toBe(1_001_000); // ← lo que el dueño espera ver
    expect(r.disponiblePuro).toBe(950_000); // no se movió respecto al inicio
    expect(r.suma).toBe(5_051_000); // 950.000 + 1.050.000 + 51.000 + 3.000.000
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
