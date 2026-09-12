import { describe, expect, it } from "vitest";
import { calcularEstadoDia, type EstadoDiaInput } from "@/modules/cierreDiario/calculations/estadoDia";

function base(overrides: Partial<EstadoDiaInput> = {}): EstadoDiaInput {
  return {
    turnoUnico: false,
    ventaDaviplataPorTurno: { 1: 100_000, 2: 80_000 },
    daviplataDelDia: { 1: null, 2: null },
    saldoRealCCGuardado: null,
    saldoEsperadoCC: null,
    pendientesVencidos: [],
    datafonoRegistrado: false,
    ...overrides,
  };
}

describe("calcularEstadoDia", () => {
  it("nada registrado todavía → gris (no rojo ni amarillo)", () => {
    const r = calcularEstadoDia(base());
    expect(r.cc).toBe("pendiente");
    expect(r.daviplata1).toBe("pendiente");
    expect(r.daviplata2).toBe("pendiente");
    expect(r.semaforo).toBe("gris");
  });

  it("todo cuadra → verde", () => {
    const r = calcularEstadoDia(
      base({
        daviplataDelDia: { 1: { saldoReal: 100_000 }, 2: { saldoReal: 80_000 } },
        saldoRealCCGuardado: 500_000,
        saldoEsperadoCC: 500_000,
      })
    );
    expect(r.semaforo).toBe("verde");
  });

  it("día a medias (CC cuadra, falta confirmar Daviplata Turno 2) → amarillo, no gris", () => {
    const r = calcularEstadoDia(
      base({
        daviplataDelDia: { 1: { saldoReal: 100_000 }, 2: null },
        saldoRealCCGuardado: 500_000,
        saldoEsperadoCC: 500_000,
      })
    );
    expect(r.cc).toBe("done");
    expect(r.daviplata1).toBe("done");
    expect(r.daviplata2).toBe("pendiente");
    expect(r.semaforo).toBe("amarillo");
  });

  it("diferencia real en Cuenta Corriente → rojo, aunque Daviplata cuadre", () => {
    const r = calcularEstadoDia(
      base({
        daviplataDelDia: { 1: { saldoReal: 100_000 }, 2: { saldoReal: 80_000 } },
        saldoRealCCGuardado: 450_000,
        saldoEsperadoCC: 500_000,
      })
    );
    expect(r.cc).toBe("danger");
    expect(r.semaforo).toBe("rojo");
  });

  it("rojo gana sobre amarillo: un turno sin confirmar no tapa una diferencia real", () => {
    const r = calcularEstadoDia(
      base({
        daviplataDelDia: { 1: { saldoReal: 999_999 }, 2: null }, // Turno 1 no cuadra, Turno 2 sin confirmar
        saldoRealCCGuardado: null,
        saldoEsperadoCC: null,
      })
    );
    expect(r.daviplata1).toBe("danger");
    expect(r.daviplata2).toBe("pendiente");
    expect(r.semaforo).toBe("rojo");
  });

  it("diferencia explicada por tarjeta pendiente vencida → amarillo", () => {
    const r = calcularEstadoDia(
      base({
        daviplataDelDia: { 1: { saldoReal: 100_000 }, 2: { saldoReal: 80_000 } },
        saldoRealCCGuardado: 519_200,
        saldoEsperadoCC: 500_000,
        pendientesVencidos: [{ montoVendido: 20_000 }],
      })
    );
    expect(r.cc).toBe("warn");
    expect(r.semaforo).toBe("amarillo");
  });

  it("domingo (turno único): Daviplata Turno 2 no existe y no cuenta para el semáforo", () => {
    const r = calcularEstadoDia(
      base({
        turnoUnico: true,
        daviplataDelDia: { 1: { saldoReal: 100_000 }, 2: null },
        saldoRealCCGuardado: 500_000,
        saldoEsperadoCC: 500_000,
      })
    );
    expect(r.daviplata2).toBeNull();
    expect(r.semaforo).toBe("verde");
  });

  it("domingo sin nada registrado → sigue siendo gris (no cuenta el Turno 2 inexistente)", () => {
    const r = calcularEstadoDia(base({ turnoUnico: true }));
    expect(r.daviplata2).toBeNull();
    expect(r.semaforo).toBe("gris");
  });

  it("el datáfono no participa del semáforo, sea cual sea su estado", () => {
    const registrado = calcularEstadoDia(
      base({
        daviplataDelDia: { 1: { saldoReal: 100_000 }, 2: { saldoReal: 80_000 } },
        saldoRealCCGuardado: 500_000,
        saldoEsperadoCC: 500_000,
        datafonoRegistrado: true,
      })
    );
    const sinRegistrar = calcularEstadoDia(
      base({
        daviplataDelDia: { 1: { saldoReal: 100_000 }, 2: { saldoReal: 80_000 } },
        saldoRealCCGuardado: 500_000,
        saldoEsperadoCC: 500_000,
        datafonoRegistrado: false,
      })
    );
    expect(registrado.datafono).toBe("done");
    expect(sinRegistrar.datafono).toBe("pendiente");
    expect(registrado.semaforo).toBe("verde");
    expect(sinRegistrar.semaforo).toBe("verde"); // mismo semáforo: el datáfono no lo cambia
  });
});
