import { describe, expect, it } from "vitest";
import {
  comisionTarjetaDelParte,
  cuadreDelParte,
  diferenciasConNequi,
  parteComoFilaCierre,
  totalesParte,
  type ParteTurnoFila,
} from "@/modules/parteturno/calculations/parteTurno";
import { cierreInputDesdeFila } from "@/modules/nequi/calculations/cierreGeneralItems";
import { calcularCierreGeneral } from "@/modules/nequi/calculations/cierreGeneral";

// Recibo REAL de Dominium ("Cuadre de Caja 1989", 01/07/2026, cajera ANA BARRERA), que es
// justo lo que la vendedora copia al parte. Total Ingresos del recibo: $859.600.
const RECIBO: ParteTurnoFila = {
  ventaEfectivo: 539_300, // EFECTIVO (14 registros)
  ventaNequi: 109_100, // NEQUI (10 registros)
  ventaTarjeta: 203_600, // TARJETAS DEBITO (6 registros)
  ventaDaviplata: 0,
  ventaTransferencia: 0,
  ventaCredito: 7_600, // CREDITO (1 registro)
  ventaOtro: 0,
  ventaSinFactura: 0,
  retiroCierre: 0,
  realEfectivo: null,
  gastoItems: [],
  facturaItems: [],
};

describe("totalesParte", () => {
  it("la venta total del recibo real cuadra con su 'Total Ingresos'", () => {
    expect(totalesParte(RECIBO).ventaTotal).toBe(859_600);
  });

  it("la base suma la venta sin factura", () => {
    expect(totalesParte({ ...RECIBO, ventaSinFactura: 40_400 }).base).toBe(900_000);
  });

  it("suma gastos y facturas de sus items", () => {
    const t = totalesParte({
      ...RECIBO,
      gastoItems: [{ monto: 20_000, metodoPago: "EFECTIVO_CAJA" }, { monto: 5_000, metodoPago: "NEQUI" }],
      facturaItems: [{ monto: 300_000, metodoPago: "EFECTIVO_SOBRE" }],
    });
    expect(t.totalGastos).toBe(25_000);
    expect(t.totalFacturas).toBe(300_000);
  });

  // Solo lo pagado DE la caja principal baja el efectivo que debe quedar en ella.
  it("separa lo pagado de la caja principal de lo pagado por otros medios", () => {
    const t = totalesParte({
      ...RECIBO,
      gastoItems: [
        { monto: 20_000, metodoPago: "EFECTIVO_CAJA" },
        { monto: 5_000, metodoPago: "NEQUI" },
        { monto: 3_000, metodoPago: null }, // null = caja principal (compatibilidad)
      ],
      facturaItems: [{ monto: 300_000, metodoPago: "EFECTIVO_SOBRE" }],
    });
    expect(t.gastosEfectivoCaja).toBe(23_000);
    expect(t.facturasEfectivoCaja).toBe(0); // el sobre blanco no toca la caja principal
  });
});

describe("parteComoFilaCierre", () => {
  // ⚠️ EL TEST QUE HABRÍA CAZADO LOS DOS BUGS HISTÓRICOS del adaptador del Cierre general
  // (perdía los % congelados y retiroCierre en silencio). Cada medio lleva un valor DISTINTO
  // a propósito: así un copy-paste entre campos rompe el test en vez de pasar desapercibido.
  it("pasa los 7 medios de venta, cada uno a su campo", () => {
    const distintos: ParteTurnoFila = {
      ...RECIBO,
      ventaEfectivo: 1,
      ventaNequi: 2,
      ventaTarjeta: 0, // en 0 para que no se cuele el gasto de comisión en este caso
      ventaDaviplata: 8,
      ventaTransferencia: 16,
      ventaCredito: 32,
      ventaOtro: 64,
      ventaSinFactura: 128,
    };
    const fila = parteComoFilaCierre(distintos, 70, 0);

    expect(fila.ventaEfectivo).toBe(1);
    expect(fila.ventaNequi).toBe(2);
    expect(fila.ventaTarjeta).toBe(0);
    expect(fila.ventaDaviplata).toBe(8);
    expect(fila.ventaTransferencia).toBe(16);
    expect(fila.ventaCredito).toBe(32);
    expect(fila.ventaOtro).toBe(64);
    expect(fila.ventaSinFactura).toBe(128);

    // Y que sobreviven al segundo salto (fila → input del cálculo).
    expect(cierreInputDesdeFila(fila).ventasPorMedio).toEqual({
      EFECTIVO: 1,
      NEQUI: 2,
      TARJETA: 0,
      DAVIPLATA: 8,
      TRANSFERENCIA: 16,
      CREDITO: 32,
      OTRO: 64,
    });
  });

  it("pasa retiroCierre (el campo que el Cierre general perdía y dejaba el retiro en $0)", () => {
    const fila = parteComoFilaCierre({ ...RECIBO, retiroCierre: 450_000 }, 70, 0);
    expect(fila.retiroCierre).toBe(450_000);
    expect(calcularCierreGeneral(cierreInputDesdeFila(fila)).retiroCierre).toBe(450_000);
  });

  it("pasa los % que se le den, no el default 70/0", () => {
    const fila = parteComoFilaCierre(RECIBO, 60, 10);
    expect(fila.porcentajeReposicion).toBe(60);
    expect(fila.porcentajeTercero).toBe(10);
    // Y llegan al cálculo ya como fracción.
    const input = cierreInputDesdeFila(fila);
    expect(input.porcentajeReposicion).toBe(0.6);
    expect(input.porcentajeTercero).toBe(0.1);
  });

  it("realEfectivo null no inventa un cuadre; con valor, sí lo pasa", () => {
    expect(cierreInputDesdeFila(parteComoFilaCierre(RECIBO, 70, 0)).realPorMedio).toBeUndefined();
    const contado = parteComoFilaCierre({ ...RECIBO, realEfectivo: 739_300 }, 70, 0);
    expect(cierreInputDesdeFila(contado).realPorMedio).toEqual({ EFECTIVO: 739_300 });
  });

  it("los items del parte pasan tal cual", () => {
    const fila = parteComoFilaCierre(
      {
        ...RECIBO,
        ventaTarjeta: 0,
        gastoItems: [{ monto: 20_000, metodoPago: "EFECTIVO_CAJA" }],
        facturaItems: [{ monto: 300_000, metodoPago: "EFECTIVO_SOBRE" }],
      },
      70,
      0
    );
    const input = cierreInputDesdeFila(fila);
    expect(input.gastosVarios).toBe(20_000);
    expect(input.facturasPagadas).toBe(300_000);
  });
});

describe("comisión del 4% de tarjeta en la vista previa", () => {
  it("calcula el 4% de la venta con tarjeta del recibo real", () => {
    expect(comisionTarjetaDelParte(203_600)).toBe(8_144);
  });

  it("sin venta de tarjeta no hay comisión ni gasto inyectado", () => {
    expect(comisionTarjetaDelParte(0)).toBe(0);
    expect(parteComoFilaCierre({ ...RECIBO, ventaTarjeta: 0 }, 70, 0).gastoItems).toHaveLength(0);
  });

  // Si la previa no contara la comisión, la utilidad mostrada al admin sería más alta que la
  // que verá después de aprobar (la aprobación SÍ crea ese gasto automático).
  it("la inyecta como gasto para que previa y resultado tras aprobar coincidan", () => {
    const fila = parteComoFilaCierre(RECIBO, 70, 0);
    expect(fila.gastoItems).toHaveLength(1);
    expect(fila.gastoItems[0].monto).toBe(8_144);
    expect(cierreInputDesdeFila(fila).gastosVarios).toBe(8_144);
  });

  it("se suma a los gastos que la vendedora ya registró, no los reemplaza", () => {
    const fila = parteComoFilaCierre(
      { ...RECIBO, gastoItems: [{ monto: 20_000, metodoPago: "EFECTIVO_CAJA" }] },
      70,
      0
    );
    expect(cierreInputDesdeFila(fila).gastosVarios).toBe(28_144);
  });
});

describe("el recibo real, de punta a punta por el cálculo del Cierre general", () => {
  const resumen = calcularCierreGeneral(cierreInputDesdeFila(parteComoFilaCierre(RECIBO, 70, 0)));

  it("base = Total Ingresos del recibo", () => {
    expect(resumen.base).toBe(859_600);
  });

  it("reposición bruta = 70% de la base", () => {
    expect(resumen.reposicionBruta).toBeCloseTo(601_720, 2);
  });

  it("la utilidad descuenta la comisión del 4%", () => {
    // margen bruto 30% = 257.880 ; menos la comisión de 8.144
    expect(resumen.utilidadDia).toBeCloseTo(249_736, 2);
  });

  it("con reparto de tres (60/10/30) los números cambian de forma consistente", () => {
    const r = calcularCierreGeneral(cierreInputDesdeFila(parteComoFilaCierre(RECIBO, 60, 10)));
    expect(r.reposicionBruta).toBeCloseTo(515_760, 2); // 60%
    expect(r.terceroBruto).toBeCloseTo(85_960, 2); // 10%
    // El tercero resta de gastos/utilidad, NO de reposición.
    expect(r.margenBruto).toBeCloseTo(257_880, 2); // sigue siendo el 30%
    expect(r.utilidadDia).toBeCloseTo(249_736, 2);
  });
});

describe("cuadreDelParte", () => {
  it("efectivo esperado = base fija + venta en efectivo − lo pagado de la caja", () => {
    const r = cuadreDelParte({
      ...RECIBO,
      gastoItems: [{ monto: 20_000, metodoPago: "EFECTIVO_CAJA" }],
      facturaItems: [{ monto: 300_000, metodoPago: "EFECTIVO_SOBRE" }], // no toca la caja
      realEfectivo: null,
    });
    expect(r.efectivoEsperado).toBe(200_000 + 539_300 - 20_000);
    expect(r.estado).toBe("PENDIENTE");
    expect(r.descuadre).toBeNull();
  });

  it("detecta sobrante y faltante contra el conteo físico", () => {
    expect(cuadreDelParte({ ...RECIBO, realEfectivo: 739_400 }).descuadre).toBe(100);
    expect(cuadreDelParte({ ...RECIBO, realEfectivo: 739_400 }).estado).toBe("SOBRO");
    expect(cuadreDelParte({ ...RECIBO, realEfectivo: 739_000 }).estado).toBe("FALTO");
    expect(cuadreDelParte({ ...RECIBO, realEfectivo: 739_300 }).estado).toBe("CUADRO");
  });
});

describe("diferenciasConNequi", () => {
  it("avisa cuando el recibo del POS no coincide con lo registrado en Nequi", () => {
    const d = diferenciasConNequi(RECIBO, { nequi: 100_000, efectivo: 539_300 });
    expect(d).toHaveLength(1);
    expect(d[0]).toMatchObject({ campo: "ventaNequi", parte: 109_100, nequi: 100_000, diferencia: 9_100 });
  });

  it("callado cuando todo coincide", () => {
    expect(diferenciasConNequi(RECIBO, { nequi: 109_100, efectivo: 539_300 })).toEqual([]);
  });

  // Regla deliberada: la venta de farmacia en Nequi la registra el ADMIN, y normalmente aún
  // no lo ha hecho cuando la vendedora cierra. Avisar contra un 0 haría saltar la alarma en
  // TODOS los partes y el aviso dejaría de significar algo.
  it("callado cuando Nequi no tiene nada registrado (no inventa una alarma contra 0)", () => {
    expect(diferenciasConNequi(RECIBO, { nequi: 0, efectivo: 0 })).toEqual([]);
  });

  it("solo calla el medio que está en 0; el otro sí se contrasta", () => {
    const d = diferenciasConNequi(RECIBO, { nequi: 0, efectivo: 500_000 });
    expect(d).toHaveLength(1);
    expect(d[0].campo).toBe("ventaEfectivo");
    expect(d[0].diferencia).toBe(39_300);
  });

  it("la diferencia es negativa si el recibo dice menos que Nequi", () => {
    const d = diferenciasConNequi({ ventaNequi: 90_000, ventaEfectivo: 0 }, { nequi: 109_100, efectivo: 0 });
    expect(d[0].diferencia).toBe(-19_100);
  });
});
