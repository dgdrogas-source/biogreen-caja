// Total del turno con fallback al campo legado (deprecado en Fase 2). Los cierres guardados
// en Fase 1 solo tienen el número agregado (facturasPagadas/gastosVarios); los de Fase 2 en
// adelante tienen items itemizados, que son la fuente de verdad en cuanto existen.
export function sumarConFallback(legacyValue: number, items: { monto: number }[]): number {
  if (items.length === 0) return legacyValue;
  return items.reduce((sum, item) => sum + item.monto, 0);
}

// Suma solo los items pagados de la CAJA PRINCIPAL en efectivo (metodoPago null o
// "EFECTIVO_CAJA"; null = items guardados antes de que existiera el campo, se asumen de
// caja por compatibilidad). Los pagados del sobre blanco u otro medio no restan de la caja
// principal — ver cuadreCajaCierreGeneral.ts.
export function sumarEfectivoCaja(items: { monto: number; metodoPago: string | null }[]): number {
  return items
    .filter((i) => (i.metodoPago ?? "EFECTIVO_CAJA") === "EFECTIVO_CAJA")
    .reduce((sum, item) => sum + item.monto, 0);
}

// ---------------------------------------------------------------------------
// Adaptador fila guardada → input del cálculo (2026-07-19).
//
// Vivía como función privada sin tests dentro de queries/index.ts y ya había producido DOS
// bugs por campos que se olvidó de pasar: los % congelados del cierre (siempre usaba 70/0) y
// `retiroCierre` (siempre 0 → "Retiro del día" en $0 y la alerta "Pendiente consignar" nunca
// disparaba, porque consignar = retiroCierre − reposiciónNeta salía siempre negativo).
//
// ⚠️ Al añadir un campo nuevo a CierreGeneral que el cálculo use, hay que pasarlo AQUÍ y
// cubrirlo con un test — ese es justo el agujero que dejó pasar los dos bugs.
// ---------------------------------------------------------------------------

// Forma ESTRUCTURAL de la fila (no el tipo de Prisma, para poder testear sin BD). El tipo
// generado por Prisma la satisface tal cual.
export interface CierreGeneralFila {
  ventaEfectivo: number;
  ventaNequi: number;
  ventaTarjeta: number;
  ventaDaviplata: number;
  ventaTransferencia: number;
  ventaCredito: number;
  ventaOtro: number;
  ventaSinFactura: number;
  facturasPagadas: number; // legado (Fase 1), solo se usa si no hay facturaItems
  gastosVarios: number; // legado (Fase 1), solo se usa si no hay gastoItems
  retiroCierre: number;
  realEfectivo: number | null;
  porcentajeReposicion: number; // entero 0..100 tal como está en la BD
  porcentajeTercero: number; // entero 0..100 tal como está en la BD
  facturaItems: { monto: number }[];
  gastoItems: { monto: number }[];
}

// NOTA: el tipo de retorno se deja INFERIDO a propósito. CierreGeneralInput.facturasPagadas es
// opcional, pero BolsaCierreInput lo exige requerido y queries/index.ts asigna esta salida a
// BolsaCierreInput[]. Anotar `: CierreGeneralInput` rompería esa asignación.
export function cierreInputDesdeFila(c: CierreGeneralFila) {
  return {
    ventasPorMedio: {
      EFECTIVO: c.ventaEfectivo,
      NEQUI: c.ventaNequi,
      TARJETA: c.ventaTarjeta,
      DAVIPLATA: c.ventaDaviplata,
      TRANSFERENCIA: c.ventaTransferencia,
      CREDITO: c.ventaCredito,
      OTRO: c.ventaOtro,
    },
    ventaSinFactura: c.ventaSinFactura,
    facturasPagadas: sumarConFallback(c.facturasPagadas, c.facturaItems),
    gastosVarios: sumarConFallback(c.gastosVarios, c.gastoItems),
    retiroCierre: c.retiroCierre,
    realPorMedio: c.realEfectivo != null ? { EFECTIVO: c.realEfectivo } : undefined,
    porcentajeReposicion: (c.porcentajeReposicion ?? 70) / 100, // % congelado → fracción
    porcentajeTercero: (c.porcentajeTercero ?? 0) / 100, // % congelado → fracción
  };
}

// ---------------------------------------------------------------------------
// Agrupación del desglose del día (2026-07-19, pedido de la dueña).
//
// El Resumen suma los DOS turnos, y hay gastos que se generan uno por cierre —el 4% de
// tarjeta, sobre todo— así que sin agrupar se ven duplicados ("Comisión bancaria" dos veces).
// Se muestra una sola línea con el acumulado.
// ---------------------------------------------------------------------------

export interface GastoDelDia {
  monto: number;
  categoria: string;
  proveedor: string | null;
  descripcion: string | null;
  autoGenerado: boolean;
}

export interface FacturaDelDia {
  monto: number;
  proveedor: string;
  descripcion: string | null;
}

export interface GrupoDesglose {
  clave: string; // categoría (gastos) o proveedor (facturas) — sirve de key en la UI
  total: number;
  cantidad: number;
  // Solo se conservan si el grupo tiene UN item: mezclar descripciones/proveedores de varios
  // pagos distintos sería engañoso.
  proveedor: string | null;
  descripcion: string | null;
  autoGenerado: boolean; // true solo si TODOS los items del grupo lo son
}

function agrupar<T>(
  items: T[],
  clave: (x: T) => string,
  monto: (x: T) => number,
  proveedor: (x: T) => string | null,
  descripcion: (x: T) => string | null,
  autoGenerado: (x: T) => boolean
): GrupoDesglose[] {
  const mapa = new Map<string, GrupoDesglose>();
  for (const item of items) {
    const k = clave(item);
    const actual = mapa.get(k);
    if (actual) {
      actual.total += monto(item);
      actual.cantidad += 1;
      actual.proveedor = null; // varios items → no se puede atribuir a uno solo
      actual.descripcion = null;
      actual.autoGenerado = actual.autoGenerado && autoGenerado(item);
    } else {
      mapa.set(k, {
        clave: k,
        total: monto(item),
        cantidad: 1,
        proveedor: proveedor(item),
        descripcion: descripcion(item),
        autoGenerado: autoGenerado(item),
      });
    }
  }
  return [...mapa.values()].sort((a, b) => b.total - a.total); // lo más grande primero
}

// Gastos del día agrupados POR CATEGORÍA.
export function agruparGastosDelDia(items: GastoDelDia[]): GrupoDesglose[] {
  return agrupar(
    items,
    (g) => g.categoria,
    (g) => g.monto,
    (g) => g.proveedor,
    (g) => g.descripcion,
    (g) => g.autoGenerado
  );
}

// Facturas del día agrupadas POR PROVEEDOR (misma duplicación: dos pagos al mismo proveedor,
// uno por turno).
export function agruparFacturasDelDia(items: FacturaDelDia[]): GrupoDesglose[] {
  return agrupar(
    items,
    (f) => f.proveedor,
    (f) => f.monto,
    () => null, // el proveedor ya es la clave del grupo
    (f) => f.descripcion,
    () => false // las facturas no tienen items autogenerados
  );
}
