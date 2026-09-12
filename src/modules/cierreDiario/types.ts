// Módulo Cierre Diario (2026-09-09) — conciliación diaria entre lo que Dominium (vía Parte de
// Turno) registró como vendido en Cuenta Corriente/Daviplata y el dinero real en el banco.
// Reemplaza a "Cierre general". Ver .claude/PROCESO-CIERRE-DIARIO.md.

export const CUENTAS_CIERRE_DIARIO = ["CUENTA_CORRIENTE", "DAVIPLATA"] as const;
export type CuentaCierreDiario = (typeof CUENTAS_CIERRE_DIARIO)[number];
export const CUENTA_CIERRE_DIARIO_LABELS: Record<CuentaCierreDiario, string> = {
  CUENTA_CORRIENTE: "Cuenta Corriente",
  DAVIPLATA: "Daviplata",
};

export const FRANQUICIAS = ["VISA", "MASTERCARD", "OTRA"] as const;
export type Franquicia = (typeof FRANQUICIAS)[number];
export const FRANQUICIA_LABELS: Record<Franquicia, string> = {
  VISA: "Visa",
  MASTERCARD: "Mastercard",
  OTRA: "Otra",
};

export const TIPOS_MOVIMIENTO_MANUAL = ["INGRESO", "EGRESO"] as const;
export type TipoMovimientoManual = (typeof TIPOS_MOVIMIENTO_MANUAL)[number];
export const TIPO_MOVIMIENTO_MANUAL_LABELS: Record<TipoMovimientoManual, string> = {
  INGRESO: "Ingreso",
  EGRESO: "Egreso",
};

// Clasificación automática de la diferencia entre saldo esperado y saldo real. CUADRA = no
// hay diferencia. EXPLICADA = hay diferencia pero coincide con tarjeta pendiente dentro de
// rango (no es un error). REAL = diferencia sin explicar, hay que investigar.
export const CLASIFICACIONES_DIFERENCIA = ["CUADRA", "EXPLICADA", "REAL"] as const;
export type ClasificacionDiferencia = (typeof CLASIFICACIONES_DIFERENCIA)[number];

export type ActionResult = { ok: true; mensaje?: string } | { ok: false; error: string };

// Estado de un indicador puntual (un turno de Daviplata, Cuenta Corriente, Datáfono) en la
// franja de chips de "Comparación bancaria" y en el semáforo de Historial. "pendiente" = sin
// dato todavía (no es un error, solo falta digitarlo).
export type EstadoChip = "pendiente" | "done" | "warn" | "danger";
