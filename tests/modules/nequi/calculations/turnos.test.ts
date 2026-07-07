import { describe, expect, it } from "vitest";
import {
  DEFAULT_SHIFT_CONFIGS,
  turnoPorHora,
  turnoSiguiente,
} from "@/modules/nequi/calculations/turnos";

describe("turnoPorHora", () => {
  // Horarios por defecto: T1 06:00–13:00, T2 13:00–20:00.
  it("dentro del rango del turno 1 devuelve 1", () => {
    expect(turnoPorHora("06:00", DEFAULT_SHIFT_CONFIGS)).toBe(1);
    expect(turnoPorHora("09:30", DEFAULT_SHIFT_CONFIGS)).toBe(1);
    expect(turnoPorHora("12:59", DEFAULT_SHIFT_CONFIGS)).toBe(1);
  });

  it("dentro del rango del turno 2 devuelve 2 (el inicio del T2 ya es T2)", () => {
    expect(turnoPorHora("13:00", DEFAULT_SHIFT_CONFIGS)).toBe(2);
    expect(turnoPorHora("16:45", DEFAULT_SHIFT_CONFIGS)).toBe(2);
    expect(turnoPorHora("19:59", DEFAULT_SHIFT_CONFIGS)).toBe(2);
  });

  it("fuera de ambos rangos: madrugada → 1, noche → 2", () => {
    expect(turnoPorHora("04:30", DEFAULT_SHIFT_CONFIGS)).toBe(1);
    expect(turnoPorHora("20:00", DEFAULT_SHIFT_CONFIGS)).toBe(2);
    expect(turnoPorHora("23:15", DEFAULT_SHIFT_CONFIGS)).toBe(2);
  });

  it("respeta horarios personalizados, incluso con hueco entre turnos", () => {
    const configs = [
      { shift: 1, startTime: "07:30", endTime: "12:30" },
      { shift: 2, startTime: "14:30", endTime: "21:00" },
    ];
    expect(turnoPorHora("07:30", configs)).toBe(1);
    expect(turnoPorHora("12:30", configs)).toBe(1); // hueco 12:30–14:30, antes del T2 → 1
    expect(turnoPorHora("14:00", configs)).toBe(1);
    expect(turnoPorHora("14:30", configs)).toBe(2);
    expect(turnoPorHora("22:00", configs)).toBe(2);
  });

  it("sin configuración usa los horarios por defecto", () => {
    expect(turnoPorHora("08:00", [])).toBe(1);
    expect(turnoPorHora("15:00", [])).toBe(2);
  });
});

describe("turnoSiguiente", () => {
  it("del turno 1 pasa al turno 2 del mismo día", () => {
    expect(turnoSiguiente("2026-07-06", 1)).toEqual({ date: "2026-07-06", shift: 2 });
  });

  it("del turno 2 pasa al turno 1 del día siguiente", () => {
    expect(turnoSiguiente("2026-07-06", 2)).toEqual({ date: "2026-07-07", shift: 1 });
  });

  it("cruza fin de mes y fin de año correctamente", () => {
    expect(turnoSiguiente("2026-07-31", 2)).toEqual({ date: "2026-08-01", shift: 1 });
    expect(turnoSiguiente("2026-12-31", 2)).toEqual({ date: "2027-01-01", shift: 1 });
  });
});
