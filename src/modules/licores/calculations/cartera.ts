// Cartera de licores: cuánto debe cada cliente por cerveza fiada.
// Es una cartera PROPIA, separada a propósito de la de la farmacia (decisión del dueño,
// 2026-07-19): nada de licores puede mover la cartera del Cierre general.
//   saldo = Σ ventas a crédito − Σ abonos.

export interface VentaCreditoLicor {
  clienteId: string;
  precioUnitario: number;
  cantidad: number;
}

export interface AbonoLicor {
  clienteId: string;
  monto: number;
}

export interface SaldoCliente {
  deuda: number; // total fiado
  abonado: number; // total pagado
  saldo: number; // lo que aún debe (deuda − abonado)
}

const sumar = <T>(xs: T[], pick: (x: T) => number) => xs.reduce((s, x) => s + pick(x), 0);

// Saldo de UN cliente. Puede quedar negativo si abonó de más (pagó por adelantado); se
// devuelve tal cual para que el dueño lo vea, no se recorta a cero.
export function calcularSaldoCliente(
  ventas: VentaCreditoLicor[],
  abonos: AbonoLicor[]
): SaldoCliente {
  const deuda = sumar(ventas, (v) => v.precioUnitario * v.cantidad);
  const abonado = sumar(abonos, (a) => a.monto);
  return { deuda, abonado, saldo: deuda - abonado };
}

// Saldo de todos los clientes a la vez, agrupando por clienteId.
export function calcularSaldosPorCliente(
  ventas: VentaCreditoLicor[],
  abonos: AbonoLicor[]
): Map<string, SaldoCliente> {
  const ids = new Set([...ventas.map((v) => v.clienteId), ...abonos.map((a) => a.clienteId)]);
  const out = new Map<string, SaldoCliente>();
  for (const id of ids) {
    out.set(
      id,
      calcularSaldoCliente(
        ventas.filter((v) => v.clienteId === id),
        abonos.filter((a) => a.clienteId === id)
      )
    );
  }
  return out;
}

// Total de la cartera: lo que le deben en conjunto. Solo suma saldos POSITIVOS — un cliente
// que pagó de más no debe tapar la deuda de otro.
export function calcularCarteraTotal(saldos: Iterable<SaldoCliente>): number {
  let total = 0;
  for (const s of saldos) if (s.saldo > 0) total += s.saldo;
  return total;
}
