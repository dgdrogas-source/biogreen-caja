// Total del turno con fallback al campo legado (deprecado en Fase 2). Los cierres guardados
// en Fase 1 solo tienen el número agregado (facturasPagadas/gastosVarios); los de Fase 2 en
// adelante tienen items itemizados, que son la fuente de verdad en cuanto existen.
export function sumarConFallback(legacyValue: number, items: { monto: number }[]): number {
  if (items.length === 0) return legacyValue;
  return items.reduce((sum, item) => sum + item.monto, 0);
}
