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
