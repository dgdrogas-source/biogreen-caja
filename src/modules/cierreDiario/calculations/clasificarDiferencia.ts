import type { ClasificacionDiferencia } from "../types";

// Clasifica automáticamente una diferencia (saldo real − saldo esperado) entre CUADRA, REAL o
// EXPLICADA, para que un número en pesos no sea lo único que ve el admin. CUADRA es directo
// (diferencia = 0). El caso EXPLICADA cubre exactamente esto: un pendiente de tarjeta cuya
// fecha estimada de llegada YA pasó, pero nadie ha confirmado el calce todavía (ver
// actions/cierreDiario.ts → confirmarCalceTarjeta) — ese dinero ya está en el banco (sube el
// saldo real) pero `tarjetaLlegadaHoy` sigue en 0 porque nadie lo marcó (no sube el esperado).
// El banco descuenta comisión (~2%-6%, ver calculations/calceTarjeta.ts) antes de consignar,
// así que lo que realmente llegó es entre el 94% y el 98% del monto vendido pendiente — es
// ESE rango el que se compara contra la diferencia observada, no la comisión en sí.
//
// El caso de "anticipo" (cliente pagó antes de facturar) NO se detecta aquí: no es
// distinguible de una diferencia real solo por el monto. Ese caso lo reconoce el admin y lo
// deja escrito en la nota — la clasificación automática no inventa una explicación que no
// puede verificar.

export interface PendienteParaClasificar {
  montoVendido: number;
}

const DESCUENTO_MIN = 0.02;
const DESCUENTO_MAX = 0.06;

export function clasificarDiferencia(
  diferencia: number,
  pendientesVencidosSinResolver: PendienteParaClasificar[]
): ClasificacionDiferencia {
  if (diferencia === 0) return "CUADRA";

  const totalVendidoPendientes = pendientesVencidosSinResolver.reduce(
    (s, p) => s + p.montoVendido,
    0
  );
  if (totalVendidoPendientes > 0) {
    const minEsperado = totalVendidoPendientes * (1 - DESCUENTO_MAX);
    const maxEsperado = totalVendidoPendientes * (1 - DESCUENTO_MIN);
    if (diferencia >= minEsperado && diferencia <= maxEsperado) return "EXPLICADA";
  }

  return "REAL";
}
