// Semáforo de cobertura de facturas (Fase 2, 2026-07-17). Compara la bolsa de facturas
// (70% acumulado) contra la plata real en las 4 plataformas + la tarjeta pendiente, y sugiere
// de dónde sacar el faltante (prioridad confirmada con la dueña: Nequi → Banco → Daviplata).
//
// Reglas del diseño (ver CLAUDE.md):
//   🟢 VERDE    — el efectivo (sobre blanco) + lo digital ya cubren la bolsa de facturas HOY.
//   🟡 AMARILLO — hoy falta, pero la tarjeta pendiente de abono lo cubre (problema de fecha).
//   🔴 ROJO     — falta incluso contando la tarjeta pendiente → mostrar la cartera como fuente.
//
// La "sugerencia" es informativa (de dónde sacar el faltante que el sobre blanco no cubre),
// no mueve plata sola: ella confirma o lo hace manual.

import { type Plataforma } from "../types";

const PRIORIDAD_COBERTURA: Plataforma[] = ["NEQUI", "BANCO", "DAVIPLATA"];

export type EstadoCobertura = "VERDE" | "AMARILLO" | "ROJO";

export interface SugerenciaPlataforma {
  plataforma: Plataforma;
  monto: number;
}

export interface CoberturaFacturasInput {
  bolsaFacturas: number;
  saldos: Record<Plataforma, number>;
  totalDisponible: number; // suma de las 4 plataformas (ya calculado por calcularSaldosPlataforma)
  tarjetaPendiente: number;
  carteraTotal?: number; // informativo, se muestra solo en ROJO
}

export interface CoberturaFacturasResumen {
  estado: EstadoCobertura;
  bolsaFacturas: number;
  faltanteHoy: number; // 0 si VERDE; lo que falta contando TODAS las plataformas, antes de la tarjeta
  huecoReal: number; // > 0 solo en ROJO: lo que falta incluso contando la tarjeta pendiente
  sobranteTrasPendiente: number; // > 0 solo en AMARILLO: lo que sobrará cuando abonen la tarjeta
  sugerencia: SugerenciaPlataforma[]; // de qué plataforma sacar lo que el sobre blanco no cubre
  carteraTotal: number;
}

export function calcularCoberturaFacturas(input: CoberturaFacturasInput): CoberturaFacturasResumen {
  const { bolsaFacturas, saldos, totalDisponible, tarjetaPendiente } = input;
  const carteraTotal = input.carteraTotal ?? 0;

  // Sugerencia: el sobre blanco es la reserva natural de facturas; si no alcanza, sacar del
  // resto en orden de prioridad, capado a lo que de verdad hay en cada plataforma.
  const sobreBlanco = saldos.SOBRE_BLANCO ?? 0;
  let restante = Math.max(0, bolsaFacturas - sobreBlanco);
  const sugerencia: SugerenciaPlataforma[] = [];
  for (const plat of PRIORIDAD_COBERTURA) {
    if (restante <= 0) break;
    const disponibleAhi = Math.max(0, saldos[plat] ?? 0);
    const tomar = Math.min(disponibleAhi, restante);
    if (tomar > 0) sugerencia.push({ plataforma: plat, monto: tomar });
    restante -= tomar;
  }

  const faltanteHoy = Math.max(0, bolsaFacturas - totalDisponible);

  let estado: EstadoCobertura;
  let huecoReal = 0;
  let sobranteTrasPendiente = 0;

  if (faltanteHoy === 0) {
    estado = "VERDE";
  } else if (faltanteHoy <= tarjetaPendiente) {
    estado = "AMARILLO";
    sobranteTrasPendiente = tarjetaPendiente - faltanteHoy;
  } else {
    estado = "ROJO";
    huecoReal = faltanteHoy - tarjetaPendiente;
  }

  return { estado, bolsaFacturas, faltanteHoy, huecoReal, sobranteTrasPendiente, sugerencia, carteraTotal };
}
