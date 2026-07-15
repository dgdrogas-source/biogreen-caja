// Cuentas por cobrar por cliente: saldo = Σ ventas a crédito − Σ abonos (mismo patrón que
// los bolsillos: acumulado calculado, nunca persistido). Un saldo negativo significa que el
// cliente abonó de más (queda a favor).

export function calcularSaldoCliente(
  ventas: { monto: number }[],
  abonos: { monto: number }[]
): number {
  const totalVentas = ventas.reduce((s, v) => s + v.monto, 0);
  const totalAbonos = abonos.reduce((s, a) => s + a.monto, 0);
  return totalVentas - totalAbonos;
}

export function calcularSaldosPorCliente(
  ventas: { clienteId: string; monto: number }[],
  abonos: { clienteId: string; monto: number }[]
): Map<string, number> {
  const saldos = new Map<string, number>();
  for (const v of ventas) saldos.set(v.clienteId, (saldos.get(v.clienteId) ?? 0) + v.monto);
  for (const a of abonos) saldos.set(a.clienteId, (saldos.get(a.clienteId) ?? 0) - a.monto);
  return saldos;
}
