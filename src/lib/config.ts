// Parámetros del negocio — editarlos aquí requiere redeploy, pero quedan versionados.

// Base que el administrador mantiene disponible para consignaciones/transferencias (informativo).
export const SALDO_REFERENCIA = 1_110_000;

// Impuesto 4x1000: 4 pesos por cada 1.000 → 0.4% sobre dinero que SALE de Nequi.
export const TASA_4X1000 = 0.004;

// Tabla de comisión por retiro/consignación (ver calculations/comision.ts).
export const COMISION_TRAMOS = {
  tramo1Limite: 50_000,
  tramo1Valor: 1_000,
  tramo2Limite: 110_000,
  tramo2Valor: 2_000,
  tramo3Limite: 300_000,
  tramo3Valor: 3_000,
  adicionalPorTramo: 1_000,
  tamanoTramoAdicional: 100_000,
} as const;
