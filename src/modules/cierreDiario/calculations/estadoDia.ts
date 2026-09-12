import { clasificarDiferencia, type PendienteParaClasificar } from "./clasificarDiferencia";
import type { EstadoChip } from "../types";

// Semáforo único por día para el historial: resume Cuenta Corriente + Daviplata (Turno 1 y 2)
// en un solo color, confirmado con el dueño (2026-09-12, PROCESO-PARTES-HISTORIAL): "gris" es
// SOLO "nada registrado todavía"; un día a medias (algo cuadrado, algo pendiente) es "amarillo",
// no gris. Datáfono queda FUERA a propósito (ver campo `datafono` abajo) — el propio dueño
// definió el semáforo como "el peor de los TRES resultados" (CC + Daviplata T1 + T2), y
// matemáticamente el datáfono sin cerrar de un día no cambia el saldo esperado ni la
// clasificación de ESE día (getTarjetaLlegadaRango solo suma consignaciones YA resueltas de
// pendientes anteriores) — es un tema de completitud de flujo, no de exactitud numérica.
export type Semaforo = "verde" | "amarillo" | "rojo" | "gris";

export interface EstadoDiaInput {
  turnoUnico: boolean;
  ventaDaviplataPorTurno: Record<1 | 2, number>;
  daviplataDelDia: Record<1 | 2, { saldoReal: number | null } | null>;
  saldoRealCCGuardado: number | null;
  saldoEsperadoCC: number | null;
  pendientesVencidos: PendienteParaClasificar[];
  datafonoRegistrado: boolean;
}

export interface EstadoDiaResultado {
  cc: EstadoChip;
  daviplata1: EstadoChip;
  daviplata2: EstadoChip | null; // null si es día de turno único (domingo) — no cuenta para el semáforo
  datafono: EstadoChip; // informativo, fuera del semáforo (ver comentario de arriba)
  semaforo: Semaforo;
}

function estadoDaviplataTurno(shift: 1 | 2, input: EstadoDiaInput): EstadoChip {
  const real = input.daviplataDelDia[shift]?.saldoReal ?? null;
  if (real === null) return "pendiente";
  const diferencia = real - input.ventaDaviplataPorTurno[shift];
  return diferencia === 0 ? "done" : "danger";
}

export function calcularEstadoDia(input: EstadoDiaInput): EstadoDiaResultado {
  const daviplata1 = estadoDaviplataTurno(1, input);
  const daviplata2 = input.turnoUnico ? null : estadoDaviplataTurno(2, input);

  let cc: EstadoChip = "pendiente";
  if (input.saldoRealCCGuardado !== null && input.saldoEsperadoCC !== null) {
    const clasificacion = clasificarDiferencia(
      input.saldoRealCCGuardado - input.saldoEsperadoCC,
      input.pendientesVencidos
    );
    cc = clasificacion === "CUADRA" ? "done" : clasificacion === "EXPLICADA" ? "warn" : "danger";
  }

  const datafono: EstadoChip = input.datafonoRegistrado ? "done" : "pendiente";

  const relevantes = [cc, daviplata1, daviplata2].filter((e): e is EstadoChip => e !== null);
  const semaforo: Semaforo = relevantes.every((e) => e === "pendiente")
    ? "gris"
    : relevantes.some((e) => e === "danger")
      ? "rojo"
      : relevantes.some((e) => e === "warn" || e === "pendiente")
        ? "amarillo"
        : "verde";

  return { cc, daviplata1, daviplata2, datafono, semaforo };
}
