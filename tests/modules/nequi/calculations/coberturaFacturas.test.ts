import { describe, expect, it } from "vitest";
import { calcularCoberturaFacturas } from "@/modules/nequi/calculations/coberturaFacturas";
import type { Plataforma } from "@/modules/nequi/types";

const saldos = (over: Partial<Record<Plataforma, number>> = {}): Record<Plataforma, number> => ({
  SOBRE_BLANCO: 0,
  NEQUI: 0,
  BANCO: 0,
  DAVIPLATA: 0,
  ...over,
});

describe("calcularCoberturaFacturas", () => {
  it("bolsa en cero → VERDE, sin sugerencia", () => {
    const r = calcularCoberturaFacturas({
      bolsaFacturas: 0,
      saldos: saldos(),
      totalDisponible: 0,
      tarjetaPendiente: 0,
    });
    expect(r.estado).toBe("VERDE");
    expect(r.sugerencia).toEqual([]);
  });

  it("el sobre blanco solo ya cubre la bolsa → VERDE, sin sugerencia", () => {
    const r = calcularCoberturaFacturas({
      bolsaFacturas: 200000,
      saldos: saldos({ SOBRE_BLANCO: 300000 }),
      totalDisponible: 300000,
      tarjetaPendiente: 0,
    });
    expect(r.estado).toBe("VERDE");
    expect(r.faltanteHoy).toBe(0);
    expect(r.sugerencia).toEqual([]);
  });

  it("reproduce el ejemplo del diseño: AMARILLO con sugerencia en orden Nequi→Banco→Daviplata", () => {
    const r = calcularCoberturaFacturas({
      bolsaFacturas: 800000,
      saldos: saldos({ SOBRE_BLANCO: 300000, NEQUI: 150000, BANCO: 90000, DAVIPLATA: 40000 }),
      totalDisponible: 580000,
      tarjetaPendiente: 260000,
    });
    expect(r.estado).toBe("AMARILLO");
    expect(r.faltanteHoy).toBe(220000); // 800.000 − 580.000
    expect(r.sobranteTrasPendiente).toBe(40000); // 260.000 − 220.000
    expect(r.huecoReal).toBe(0);
    expect(r.sugerencia).toEqual([
      { plataforma: "NEQUI", monto: 150000 },
      { plataforma: "BANCO", monto: 90000 },
      { plataforma: "DAVIPLATA", monto: 40000 },
    ]);
  });

  it("cubre con solo parte de la prioridad: se detiene apenas alcanza", () => {
    const r = calcularCoberturaFacturas({
      bolsaFacturas: 400000,
      saldos: saldos({ SOBRE_BLANCO: 300000, NEQUI: 500000, BANCO: 90000, DAVIPLATA: 40000 }),
      totalDisponible: 930000,
      tarjetaPendiente: 0,
    });
    expect(r.estado).toBe("VERDE");
    // faltan 100.000 del sobre blanco; Nequi solo tiene que aportar eso, no los 500.000
    expect(r.sugerencia).toEqual([{ plataforma: "NEQUI", monto: 100000 }]);
  });

  it("límite exacto AMARILLO/ROJO: faltanteHoy == tarjetaPendiente → AMARILLO, sobrante 0", () => {
    const r = calcularCoberturaFacturas({
      bolsaFacturas: 500000,
      saldos: saldos({ SOBRE_BLANCO: 300000 }),
      totalDisponible: 300000,
      tarjetaPendiente: 200000,
    });
    expect(r.estado).toBe("AMARILLO");
    expect(r.sobranteTrasPendiente).toBe(0);
  });

  it("ni con la tarjeta alcanza → ROJO, con hueco real y la cartera como referencia", () => {
    const r = calcularCoberturaFacturas({
      bolsaFacturas: 1000000,
      saldos: saldos({ SOBRE_BLANCO: 100000, NEQUI: 50000 }),
      totalDisponible: 150000,
      tarjetaPendiente: 100000,
      carteraTotal: 340000,
    });
    expect(r.estado).toBe("ROJO");
    expect(r.faltanteHoy).toBe(850000);
    expect(r.huecoReal).toBe(750000); // 850.000 − 100.000
    expect(r.sobranteTrasPendiente).toBe(0);
    expect(r.carteraTotal).toBe(340000);
  });

  it("una plataforma en negativo no se usa como fuente (no resta más de lo que hay)", () => {
    const r = calcularCoberturaFacturas({
      bolsaFacturas: 100000,
      saldos: saldos({ SOBRE_BLANCO: 0, NEQUI: -20000, BANCO: 100000 }),
      totalDisponible: 80000,
      tarjetaPendiente: 0,
    });
    // Nequi en negativo se salta (no se le puede "sacar" nada); va a Banco.
    expect(r.sugerencia).toEqual([{ plataforma: "BANCO", monto: 100000 }]);
  });
});
