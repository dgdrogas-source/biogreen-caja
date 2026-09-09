// Cálculo puro del saldo esperado de Cuenta Corriente, "en cadena": el saldo confirmado ayer
// más lo que debía llegar hoy, menos/más los movimientos manuales de hoy. Nunca se compara el
// saldo total del banco contra la venta del día (mezclaría todo el histórico) — solo el
// movimiento de HOY se compara contra la venta de HOY, encadenado al último saldo confirmado.
//
// La tarjeta del día JAMÁS entra aquí: siempre tarda 1-2 días hábiles en llegar (ver
// calculations/calceTarjeta.ts) — solo transferencia (mismo día) y la tarjeta que por fin
// llegó HOY (de pendientes de días anteriores) alimentan el esperado de hoy.

export interface SaldoEnCadenaInput {
  saldoConfirmadoAyer: number;
  transferenciasHoy: number;
  tarjetaLlegadaHoy: number; // consignaciones de pendientes anteriores que llegaron hoy
  ingresosManualesHoy: number;
  egresosManualesHoy: number; // ya debe incluir el 4x1000 si aplica (ver impuesto4x1000.ts)
}

export function calcularSaldoEsperadoCC(input: SaldoEnCadenaInput): number {
  return (
    input.saldoConfirmadoAyer +
    input.transferenciasHoy +
    input.tarjetaLlegadaHoy +
    input.ingresosManualesHoy -
    input.egresosManualesHoy
  );
}

// Daviplata es más simple: comparación directa, mismo día (llega sin desfase) — no hay cadena.
export function calcularDiferenciaDaviplata(esperado: number, real: number): number {
  return real - esperado;
}
