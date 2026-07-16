// Tipos y etiquetas de UI del módulo Cierre Mensual. Las uniones de dominio viven en
// calculations/cierreMensual.ts (fuente única); aquí solo se les pone nombre legible.
import type {
  CierreMensualCierre,
  DiferenciaTipo,
  FaltanteDisposicion,
} from "./calculations/cierreMensual";

export type ActionResult = { ok: true } | { ok: false; error: string };

export const CIERRE_LABELS: Record<CierreMensualCierre, string> = {
  NEQUI: "Nequi",
  EFECTIVO: "Efectivo",
  BANCO: "Banco",
};

export const TIPO_DIFERENCIA_LABELS: Record<DiferenciaTipo, string> = {
  SOBRANTE: "Sobrante",
  FALTANTE: "Faltante",
};

export const DISPOSICION_LABELS: Record<FaltanteDisposicion, string> = {
  CUBRE_EMPLEADA: "Lo cubre la empleada",
  DESCUENTA_DISPONIBLE: "Descontar del disponible",
};

// "2026-07" -> "julio 2026"
export function formatMes(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("es-CO", { month: "long", year: "numeric" }).format(
    new Date(Date.UTC(y, m - 1, 1, 12))
  );
}
