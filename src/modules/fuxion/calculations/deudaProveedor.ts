// Deuda con el proveedor de Fuxion. Es LO ÚNICO que el módulo Licores no sabe hacer:
// allá una compra a crédito queda registrada pero nadie lleva cuánto se le debe.
//
// Reglas del dueño (2026-08-20):
//   - La bolsa se lleva FIADA y se le paga al proveedor COMPLETA, de una sola vez, cuando
//     se termina de vender. No hay abonos parciales.
//   - "Venda lo que venda, el valor de la bolsa va a ser para Kenny, y el restante se queda
//     para mí": el monto a pagar es FIJO por bolsa; lo que varía es la ganancia.
//
// El aviso "ya vendiste la bolsa, toca pagar" se calcula consumiendo el inventario en
// FIFO (se vende primero lo que llegó primero). Una bolsa está vendida cuando el total de
// unidades vendidas alcanzó el acumulado de existencias hasta esa compra inclusive.

export interface CompraPendiente {
  id: string;
  date: string; // YYYY-MM-DD
  cantidad: number;
  valorTotal: number;
  esCredito: boolean; // metodoPago === "CREDITO"
  pagada: boolean; // pagadaAt !== null
}

export interface EstadoBolsa {
  id: string;
  date: string;
  cantidad: number;
  valorTotal: number;
  unidadesRestantes: number; // de esta bolsa, cuántas siguen en la vitrina (FIFO)
  vendidaCompleta: boolean;
  esCredito: boolean;
  pagada: boolean;
  // true = ya se vendió toda y todavía no se le ha pagado al proveedor.
  tocaPagar: boolean;
}

// Ordena por fecha y luego por id, para que el resultado sea estable cuando dos compras
// caen el mismo día (el id de cuid es monótono en el tiempo).
function ordenar(compras: CompraPendiente[]): CompraPendiente[] {
  return [...compras].sort((a, b) => (a.date === b.date ? a.id.localeCompare(b.id) : a.date.localeCompare(b.date)));
}

// Estado de cada bolsa comprada, consumiendo el inventario en FIFO.
// `unidadesVendidas` es el total histórico vendido de ese producto.
export function calcularEstadoBolsas(
  inventarioInicial: number,
  compras: CompraPendiente[],
  unidadesVendidas: number
): EstadoBolsa[] {
  // El inventario inicial se consume antes que cualquier compra.
  let acumulado = Math.max(0, inventarioInicial);

  return ordenar(compras).map((c) => {
    acumulado += c.cantidad;
    // Cuántas unidades de ESTA bolsa siguen sin venderse: lo que sobra del acumulado
    // después de descontar todo lo vendido, tapado al tamaño de la bolsa.
    const unidadesRestantes = Math.min(c.cantidad, Math.max(0, acumulado - unidadesVendidas));
    const vendidaCompleta = unidadesRestantes === 0;
    return {
      id: c.id,
      date: c.date,
      cantidad: c.cantidad,
      valorTotal: c.valorTotal,
      unidadesRestantes,
      vendidaCompleta,
      esCredito: c.esCredito,
      pagada: c.pagada,
      tocaPagar: c.esCredito && !c.pagada && vendidaCompleta,
    };
  });
}

export interface ResumenDeuda {
  totalAdeudado: number; // Σ valor de las bolsas a crédito sin pagar
  bolsasSinPagar: number;
  // Subconjunto urgente: ya se vendieron completas y siguen sin pagarse.
  totalPorPagarYaVendido: number;
  bolsasPorPagarYaVendidas: number;
}

// Resumen de la deuda a partir de los estados de bolsa de TODOS los productos.
export function calcularResumenDeuda(estados: EstadoBolsa[]): ResumenDeuda {
  let totalAdeudado = 0;
  let bolsasSinPagar = 0;
  let totalPorPagarYaVendido = 0;
  let bolsasPorPagarYaVendidas = 0;

  for (const e of estados) {
    // Solo las bolsas a CRÉDITO generan deuda. Una comprada en efectivo/Nequi ya se pagó
    // en el momento, aunque todavía no se haya vendido.
    if (e.esCredito && !e.pagada) {
      totalAdeudado += e.valorTotal;
      bolsasSinPagar += 1;
    }
    if (e.tocaPagar) {
      totalPorPagarYaVendido += e.valorTotal;
      bolsasPorPagarYaVendidas += 1;
    }
  }

  return { totalAdeudado, bolsasSinPagar, totalPorPagarYaVendido, bolsasPorPagarYaVendidas };
}
