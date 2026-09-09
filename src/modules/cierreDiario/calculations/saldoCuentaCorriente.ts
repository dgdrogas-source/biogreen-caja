// Cálculo puro del saldo esperado de Cuenta Corriente, "en cadena": el saldo real confirmado
// la última vez, más lo que entró/salió DESDE esa confirmación hasta hoy. Nunca se compara el
// saldo total del banco contra la venta acumulada (mezclaría todo el histórico) — solo el
// movimiento del período se compara, encadenado al último saldo confirmado.
//
// "Período" es normalmente solo hoy (la mamá confirma a diario), pero si lleva días sin
// confirmar (viaje, fin de semana) es todo el hueco: desde el día siguiente a la última
// confirmación hasta hoy. Las queries de rango (getVentasTransferenciaRango,
// getTarjetaLlegadaRango, getMovimientosManualesRango) suman ese período; esta función solo
// los junta.
//
// La tarjeta vendida en el período JAMÁS entra aquí: siempre tarda 1-2 días hábiles en llegar
// (ver calculations/calceTarjeta.ts) — solo transferencia y la tarjeta que POR FIN llegó en el
// período (de pendientes anteriores, ya calzada) alimentan el esperado.

import { addDays, diffDays } from "@/lib/dates";

export interface PeriodoCC {
  desde: string; // primer día cuyos movimientos hay que sumar (inclusive)
  diasSinConfirmar: number | null; // días entre la última confirmación y hoy; null si nunca hubo
  diasHueco: number; // días del período que NO son hoy (0 = ritmo diario normal)
}

// Dada la fecha de la última confirmación de Cuenta Corriente (o null si nunca se confirmó) y
// hoy, calcula el período de movimientos a sumar para el esperado. El día de la confirmación
// se EXCLUYE (sus movimientos ya están dentro del saldo real observado ese día); se suma desde
// el día siguiente hasta hoy inclusive. Sin confirmación previa: solo hoy, sin cadena.
export function rangoPeriodoCC(ultimaConfirmacionDate: string | null, hoy: string): PeriodoCC {
  if (!ultimaConfirmacionDate) {
    return { desde: hoy, diasSinConfirmar: null, diasHueco: 0 };
  }
  const diasSinConfirmar = diffDays(ultimaConfirmacionDate, hoy);
  return {
    desde: addDays(ultimaConfirmacionDate, 1),
    diasSinConfirmar,
    diasHueco: diasSinConfirmar > 1 ? diasSinConfirmar - 1 : 0,
  };
}

export interface SaldoEnCadenaInput {
  saldoConfirmadoAnterior: number; // saldoRealCC de la última confirmación (su fecha es el ancla)
  transferenciasPeriodo: number;
  tarjetaLlegadaPeriodo: number; // consignaciones de pendientes anteriores calzadas en el período
  ingresosManualesPeriodo: number;
  egresosManualesPeriodo: number; // ya debe incluir el 4x1000 si aplica (ver impuesto4x1000.ts)
}

export function calcularSaldoEsperadoCC(input: SaldoEnCadenaInput): number {
  return (
    input.saldoConfirmadoAnterior +
    input.transferenciasPeriodo +
    input.tarjetaLlegadaPeriodo +
    input.ingresosManualesPeriodo -
    input.egresosManualesPeriodo
  );
}

// Daviplata es más simple: comparación directa, mismo día (llega sin desfase) — no hay cadena.
export function calcularDiferenciaDaviplata(esperado: number, real: number): number {
  return real - esperado;
}
