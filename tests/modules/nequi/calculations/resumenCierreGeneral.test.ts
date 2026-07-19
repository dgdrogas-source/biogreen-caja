import { describe, expect, it } from "vitest";
import {
  agregarCierresDelDia,
  calcularRentabilidadBrutaMensual,
  cumpleEquilibrio,
  semaforoRentabilidad,
  type CierreDelDia,
} from "@/modules/nequi/calculations/resumenCierreGeneral";

describe("semaforoRentabilidad", () => {
  it("30% o más → verde", () => {
    expect(semaforoRentabilidad(0.3)).toBe("VERDE");
    expect(semaforoRentabilidad(0.34)).toBe("VERDE");
  });

  it("entre 26% y 29,99% → amarillo", () => {
    expect(semaforoRentabilidad(0.26)).toBe("AMARILLO");
    expect(semaforoRentabilidad(0.299)).toBe("AMARILLO");
  });

  it("por debajo de 26% → rojo", () => {
    expect(semaforoRentabilidad(0.2599)).toBe("ROJO");
    expect(semaforoRentabilidad(0)).toBe("ROJO");
  });

  it("null (sin venta) → null", () => {
    expect(semaforoRentabilidad(null)).toBeNull();
  });
});

describe("calcularRentabilidadBrutaMensual — real (ventas − costos) ÷ ventas (2026-07-19)", () => {
  it("acumula (Σ venta − Σ costos) ÷ Σ venta del mes", () => {
    const r = calcularRentabilidadBrutaMensual([
      { ventaTotal: 1000000, costos: 700000 }, // margen real 30%
      { ventaTotal: 500000, costos: 360000 }, // margen real 28%
    ]);
    expect(r.ventaMes).toBe(1500000);
    expect(r.costosMes).toBe(1060000);
    expect(r.utilidadBrutaMes).toBe(440000);
    expect(r.ratio).toBeCloseTo(440000 / 1500000, 6); // ≈ 0.2933 → amarillo
    expect(semaforoRentabilidad(r.ratio)).toBe("AMARILLO");
  });

  it("detecta un mes con margen real bajo aunque la POLÍTICA fuera 70/30 (la métrica vieja no podía ver esto)", () => {
    // La política de reparto (70/30) es independiente del costo real de la mercancía: un mes
    // en que las facturas subieron mucho da margen real bajo, aunque el margenBruto de
    // política siga siendo exactamente 30% (por construcción, calcularCierreGeneral).
    const r = calcularRentabilidadBrutaMensual([
      { ventaTotal: 1000000, costos: 800000 }, // margen real 20%, aunque la política diga 30%
    ]);
    expect(r.ratio).toBeCloseTo(0.2, 6);
    expect(semaforoRentabilidad(r.ratio)).toBe("ROJO");
  });

  it("sin cierres → venta 0 y ratio null (no divide por cero)", () => {
    const r = calcularRentabilidadBrutaMensual([]);
    expect(r.ventaMes).toBe(0);
    expect(r.costosMes).toBe(0);
    expect(r.ratio).toBeNull();
  });
});

describe("cumpleEquilibrio", () => {
  it("cumple cuando la venta alcanza o supera el punto", () => {
    expect(cumpleEquilibrio(1100000, 1100000)).toBe(true);
    expect(cumpleEquilibrio(1250000, 1100000)).toBe(true);
  });

  it("no cumple cuando la venta queda por debajo", () => {
    expect(cumpleEquilibrio(980000, 1100000)).toBe(false);
  });
});

describe("agregarCierresDelDia", () => {
  // Turno con venta 539.100 al 70/30 y 68.000 en facturas: la fila real de la captura
  // del dueño (2026-07-16 T2).
  const turnoBase: CierreDelDia = {
    ventaTotal: 539100,
    retiroCierre: 0,
    reposicionBruta: 377370, // 539.100 × 70%
    reposicionNeta: 309370, // 377.370 − 68.000
    terceroBruto: 0, // Tercero no estaba activado ese día
    margenBruto: 161730, // 539.100 × 30%
    facturasPagadas: 68000,
    gastosVarios: 0,
    consignado: false,
    descuadre: 8200, // sobró 8.200
  };

  it("día sin cierres → todo en cero y cuadre pendiente", () => {
    const r = agregarCierresDelDia([]);
    expect(r.turnosConCierre).toBe(0);
    expect(r.ventaTotal).toBe(0);
    expect(r.retiroParaGastos).toBe(0);
    expect(r.cuadre).toEqual({ descuadre: null, estado: "PENDIENTE", turnosPendientes: 0 });
    expect(r.consignado).toBe(false);
  });

  it("un solo turno: reproduce la captura real (retiro para gastos = 30% − gastos)", () => {
    const r = agregarCierresDelDia([turnoBase]);
    expect(r.ventaTotal).toBe(539100);
    expect(r.retiroParaFacturas).toBe(309370); // sin cambios (el dueño lo dio por bueno)
    expect(r.retiroParaGastos).toBe(161730); // ANTES daba −309.370 (retiro − facturas)
    expect(r.cuadre.estado).toBe("SOBRO");
    expect(r.cuadre.descuadre).toBe(8200);
  });

  it("suma los dos turnos del día", () => {
    const t2: CierreDelDia = {
      ...turnoBase,
      ventaTotal: 300000,
      reposicionBruta: 210000,
      reposicionNeta: 210000,
      margenBruto: 90000,
      facturasPagadas: 0,
      gastosVarios: 25000,
      retiroCierre: 150000,
      descuadre: -3200,
    };
    const r = agregarCierresDelDia([turnoBase, t2]);
    expect(r.turnosConCierre).toBe(2);
    expect(r.ventaTotal).toBe(839100);
    expect(r.retiroCierre).toBe(150000);
    expect(r.retiroParaFacturas).toBe(519370); // 309.370 + 210.000
    expect(r.retiroParaGastos).toBe(226730); // 161.730 + (90.000 − 25.000)
    expect(r.gastosVarios).toBe(25000);
    expect(r.cuadre.descuadre).toBe(5000); // 8.200 − 3.200
    expect(r.cuadre.estado).toBe("SOBRO");
  });

  it("respeta % distintos por turno (por eso se suman resultados, no ventas)", () => {
    // T1 al 70/30 y T2 al 60/40 sobre la misma venta: el 30/40 no se puede sacar de la suma.
    const t1: CierreDelDia = { ...turnoBase, ventaTotal: 100000, reposicionBruta: 70000, reposicionNeta: 70000, margenBruto: 30000, facturasPagadas: 0, gastosVarios: 0, descuadre: 0 };
    const t2: CierreDelDia = { ...t1, reposicionBruta: 60000, reposicionNeta: 60000, margenBruto: 40000 };
    const r = agregarCierresDelDia([t1, t2]);
    expect(r.apartado30).toBe(70000); // 30.000 + 40.000 — NO es 200.000 × un único %
    expect(r.retiroParaGastos).toBe(70000);
  });

  it("si a un turno le falta contar el efectivo, suma solo los contados y lo avisa", () => {
    const pendiente: CierreDelDia = { ...turnoBase, descuadre: null };
    const r = agregarCierresDelDia([turnoBase, pendiente]);
    expect(r.cuadre.descuadre).toBe(8200); // solo el turno contado
    expect(r.cuadre.turnosPendientes).toBe(1);
  });

  it("suma apartadoTercero de ambos turnos (2026-07-19)", () => {
    const t1: CierreDelDia = { ...turnoBase, terceroBruto: 20000 };
    const t2: CierreDelDia = { ...turnoBase, terceroBruto: 15000 };
    const r = agregarCierresDelDia([t1, t2]);
    expect(r.apartadoTercero).toBe(35000);
  });

  it("consignado solo si TODOS los turnos lo están", () => {
    const si = { ...turnoBase, consignado: true };
    expect(agregarCierresDelDia([si, si]).consignado).toBe(true);
    expect(agregarCierresDelDia([si, turnoBase]).consignado).toBe(false);
  });
});
