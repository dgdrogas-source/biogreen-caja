import { addDays } from "@/lib/dates";
import type { Shift } from "../types";

export interface ShiftConfigRow {
  shift: number;
  startTime: string; // "HH:MM" (America/Bogota)
  endTime: string; // "HH:MM"
}

// Horarios de respaldo si aún no se ha corrido el seed de ShiftConfig.
export const DEFAULT_SHIFT_CONFIGS: ShiftConfigRow[] = [
  { shift: 1, startTime: "06:00", endTime: "13:00" },
  { shift: 2, startTime: "13:00", endTime: "20:00" },
];

// Turno POR DEFECTO según la hora actual — solo sugiere; quien registra puede
// cambiarlo a mano. "HH:MM" con cero a la izquierda se compara como texto: el
// orden alfabético coincide con el orden horario.
// Fuera de ambos rangos: antes de que arranque el turno 2 → turno 1 (madrugada,
// hueco entre turnos); después → turno 2 (cierre de la noche).
export function turnoPorHora(horaHHMM: string, configs: ShiftConfigRow[]): Shift {
  const t1 = configs.find((c) => c.shift === 1) ?? DEFAULT_SHIFT_CONFIGS[0];
  const t2 = configs.find((c) => c.shift === 2) ?? DEFAULT_SHIFT_CONFIGS[1];
  if (horaHHMM >= t1.startTime && horaHHMM < t1.endTime) return 1;
  if (horaHHMM >= t2.startTime && horaHHMM < t2.endTime) return 2;
  return horaHHMM < t2.startTime ? 1 : 2;
}

// Turno sucesor en el calendario: T1 → T2 del mismo día; T2 → T1 del día siguiente.
// De aquí sale la cadena de herencia del saldo inicial (y el destino del reset).
export function turnoSiguiente(date: string, shift: Shift): { date: string; shift: Shift } {
  return shift === 1 ? { date, shift: 2 } : { date: addDays(date, 1), shift: 1 };
}
