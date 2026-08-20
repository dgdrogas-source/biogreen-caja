// Tipos y etiquetas del módulo Fuxion. Módulo aislado (mismo patrón que `licores` y
// `mensual`): no importa nada de `nequi/types.ts` salvo el puente explícito de medios de
// pago que sí tocan el cuadre.

export type ActionResult = { ok: true } | { ok: false; error: string };

// Medios con los que se puede cobrar una venta de Fuxion.
// CREDITO = fiado: el sobre sale pero la plata queda por cobrar.
export const FUXION_MEDIOS_PAGO = [
  "EFECTIVO",
  "NEQUI",
  "TARJETA",
  "DAVIPLATA",
  "TRANSFERENCIA",
  "CREDITO",
] as const;
export type FuxionMedioPago = (typeof FUXION_MEDIOS_PAGO)[number];

export const FUXION_MEDIO_PAGO_LABELS: Record<FuxionMedioPago, string> = {
  EFECTIVO: "Efectivo",
  NEQUI: "Nequi",
  TARJETA: "Tarjeta",
  DAVIPLATA: "Daviplata",
  TRANSFERENCIA: "Transferencia",
  CREDITO: "Crédito (fiado)",
};

// Solo estos dos medios pasan por la cuenta Nequi / la caja, así que solo ellos generan el
// Movement ligado. Los demás quedan únicamente en Fuxion: si generaran un Movement,
// descuadrarían el cierre de Nequi con plata que nunca pasó por ahí.
export function afectaCuadreNequi(medio: FuxionMedioPago): medio is "EFECTIVO" | "NEQUI" {
  return medio === "EFECTIVO" || medio === "NEQUI";
}

// Medios con los que el dueño paga una COMPRA al proveedor. A diferencia de Licores, aquí
// SÍ existe CREDITO: la bolsa se lleva fiada y se paga cuando se termina de vender
// (decisión del dueño, 2026-08-20).
export const FUXION_MEDIOS_PAGO_COMPRA = ["EFECTIVO", "NEQUI", "CREDITO"] as const;
export type FuxionMedioPagoCompra = (typeof FUXION_MEDIOS_PAGO_COMPRA)[number];

export const FUXION_MEDIO_PAGO_COMPRA_LABELS: Record<FuxionMedioPagoCompra, string> = {
  EFECTIVO: "Efectivo",
  NEQUI: "Nequi",
  CREDITO: "Crédito (se paga al vender la bolsa)",
};

// Medios con los que se le PAGA al proveedor una compra que quedó a crédito. Ambos mueven
// plata real, así que ambos generan su Movement ligado.
export const FUXION_MEDIOS_PAGO_PROVEEDOR = ["EFECTIVO", "NEQUI"] as const;
export type FuxionMedioPagoProveedor = (typeof FUXION_MEDIOS_PAGO_PROVEEDOR)[number];

// Cuántos sobres trae una bolsa. PRECARGADO en el formulario, pero editable: en el
// histórico hubo una compra de 7 unidades (OFF), así que no se fuerza.
export const UNIDADES_POR_BOLSA = 28;

// Umbral por defecto de la alerta de stock bajo al crear un producto nuevo.
export const STOCK_MINIMO_DEFECTO = 6;

// Medios con los que un cliente abona su deuda. Solo 2, iguales a las modalidades del
// cierre de Fuxion: "efectivo" y "plataforma" (todo lo digital junto).
export const FUXION_MEDIOS_ABONO = ["EFECTIVO", "PLATAFORMA"] as const;
export type FuxionMedioAbono = (typeof FUXION_MEDIOS_ABONO)[number];

export const FUXION_MEDIO_ABONO_LABELS: Record<FuxionMedioAbono, string> = {
  EFECTIVO: "Efectivo",
  PLATAFORMA: "Plataforma (Nequi, tarjeta, Daviplata, transferencia)",
};
