import { describe, expect, it } from "vitest";
import {
  diferenciasConNequi,
  totalesParte,
  type ParteTurnoFila,
} from "@/modules/parteturno/calculations/parteTurno";

// Recibo REAL de Dominium ("Cuadre de Caja 1989", 01/07/2026, cajera ANA BARRERA), que es
// justo lo que la vendedora copia al parte. Total Ingresos del recibo: $859.600. En ese recibo
// la tarjeta venía combinada (Cierre General); tras separar Crédito/Débito (2026-09-09), el
// monto original de "TARJETAS DEBITO" se conserva tal cual en ventaTarjetaDebito.
const RECIBO: ParteTurnoFila = {
  ventaEfectivo: 539_300, // EFECTIVO (14 registros)
  ventaNequi: 109_100, // NEQUI (10 registros)
  ventaTarjeta: 0, // Tarjeta Crédito (este recibo no tenía)
  ventaTarjetaDebito: 203_600, // TARJETAS DEBITO (6 registros)
  ventaDaviplata: 0,
  ventaTransferencia: 0,
  ventaCredito: 7_600, // CREDITO (1 registro)
  ventaOtro: 0,
};

describe("totalesParte", () => {
  it("la venta total del recibo real cuadra con su 'Total Ingresos'", () => {
    expect(totalesParte(RECIBO).ventaTotal).toBe(859_600);
  });

  it("suma los 8 medios de pago, cada uno a su campo (tarjeta crédito y débito por separado)", () => {
    const fila: ParteTurnoFila = {
      ...RECIBO,
      ventaEfectivo: 1,
      ventaNequi: 2,
      ventaTarjeta: 4,
      ventaTarjetaDebito: 8,
      ventaDaviplata: 16,
      ventaTransferencia: 32,
      ventaCredito: 64,
      ventaOtro: 128,
    };
    expect(totalesParte(fila).ventaTotal).toBe(1 + 2 + 4 + 8 + 16 + 32 + 64 + 128);
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
