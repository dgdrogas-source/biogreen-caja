// Cierre de Fuxion (2026-08-20). ESPORÁDICO: el dueño lo hace cuando quiere, no en fecha
// fija. Cada cierre es un CORTE: se lleva todo lo que aún no se había cerrado.
//
// Solo 2 modalidades, que es como él lo maneja:
//   EFECTIVO   → plata física (es la única que se cuenta y se cuadra)
//   PLATAFORMA → todo lo digital junto (Nequi, Daviplata, tarjeta, transferencia)
// El CRÉDITO no es ninguna de las dos: esa plata todavía no entró, va a la cartera.
//
// Diferencia con el cierre de Licores: aquí también salen los PAGOS AL PROVEEDOR (la bolsa
// que se paga completa al venderse). Sin restarlos, el efectivo esperado quedaría inflado.

export type Modalidad = "EFECTIVO" | "PLATAFORMA" | "CREDITO";

// Reduce el medio de pago detallado a la modalidad del cierre.
export function modalidadDe(medioPago: string): Modalidad {
  if (medioPago === "EFECTIVO") return "EFECTIVO";
  if (medioPago === "CREDITO") return "CREDITO";
  return "PLATAFORMA"; // NEQUI | TARJETA | DAVIPLATA | TRANSFERENCIA
}

export interface VentaParaCierre {
  precioUnitario: number;
  cantidad: number;
  metodoPago: string;
}

export interface CompraParaCierre {
  valorTotal: number;
  metodoPago: string;
}

export interface AbonoParaCierre {
  monto: number;
  medioPago: string; // EFECTIVO | PLATAFORMA
}

// Pago al proveedor de una bolsa que se había llevado a crédito.
export interface PagoProveedorParaCierre {
  valorTotal: number;
  metodoPago: string; // EFECTIVO | NEQUI
}

export interface TotalesCierreFuxion {
  ventasEfectivo: number;
  ventasPlataforma: number;
  ventasCredito: number; // salió mercancía, entró deuda (no es plata en mano)
  abonosEfectivo: number;
  abonosPlataforma: number;
  comprasEfectivo: number;
  comprasPlataforma: number;
  pagosEfectivo: number; // pagos al proveedor
  pagosPlataforma: number;
  // Lo que DEBERÍA haber en la caja de Fuxion: lo que entró en efectivo menos lo que salió
  // en efectivo. Sin restar compras y pagos, un corte de varias semanas nunca cuadraría.
  efectivoEsperado: number;
  // Referencia, no se cuenta físicamente.
  plataformaNeta: number;
}

const sumar = <T>(xs: T[], pick: (x: T) => number) => xs.reduce((s, x) => s + pick(x), 0);

export function calcularTotalesCierre(
  ventas: VentaParaCierre[],
  compras: CompraParaCierre[],
  abonos: AbonoParaCierre[],
  pagos: PagoProveedorParaCierre[] = []
): TotalesCierreFuxion {
  const porModalidad = (m: Modalidad) => ventas.filter((v) => modalidadDe(v.metodoPago) === m);
  const totalVenta = (vs: VentaParaCierre[]) => sumar(vs, (v) => v.precioUnitario * v.cantidad);

  const ventasEfectivo = totalVenta(porModalidad("EFECTIVO"));
  const ventasPlataforma = totalVenta(porModalidad("PLATAFORMA"));
  const ventasCredito = totalVenta(porModalidad("CREDITO"));

  const abonosEfectivo = sumar(
    abonos.filter((a) => a.medioPago === "EFECTIVO"),
    (a) => a.monto
  );
  const abonosPlataforma = sumar(
    abonos.filter((a) => a.medioPago !== "EFECTIVO"),
    (a) => a.monto
  );

  const comprasEfectivo = sumar(
    compras.filter((c) => modalidadDe(c.metodoPago) === "EFECTIVO"),
    (c) => c.valorTotal
  );
  // Una compra a crédito no saca plata todavía (sale cuando se le paga al proveedor, y eso
  // entra por `pagos`), así que aquí solo cuenta la digital.
  const comprasPlataforma = sumar(
    compras.filter((c) => modalidadDe(c.metodoPago) === "PLATAFORMA"),
    (c) => c.valorTotal
  );

  const pagosEfectivo = sumar(
    pagos.filter((p) => modalidadDe(p.metodoPago) === "EFECTIVO"),
    (p) => p.valorTotal
  );
  const pagosPlataforma = sumar(
    pagos.filter((p) => modalidadDe(p.metodoPago) !== "EFECTIVO"),
    (p) => p.valorTotal
  );

  return {
    ventasEfectivo,
    ventasPlataforma,
    ventasCredito,
    abonosEfectivo,
    abonosPlataforma,
    comprasEfectivo,
    comprasPlataforma,
    pagosEfectivo,
    pagosPlataforma,
    efectivoEsperado: ventasEfectivo + abonosEfectivo - comprasEfectivo - pagosEfectivo,
    plataformaNeta: ventasPlataforma + abonosPlataforma - comprasPlataforma - pagosPlataforma,
  };
}

export type EstadoCierreFuxion = "CUADRO" | "SOBRO" | "FALTO";

// Diferencia del conteo físico: positivo = sobró, negativo = faltó.
export function calcularDiferencia(
  efectivoEsperado: number,
  efectivoContado: number
): { diferencia: number; estado: EstadoCierreFuxion } {
  const diferencia = efectivoContado - efectivoEsperado;
  return {
    diferencia,
    estado: diferencia === 0 ? "CUADRO" : diferencia > 0 ? "SOBRO" : "FALTO",
  };
}
