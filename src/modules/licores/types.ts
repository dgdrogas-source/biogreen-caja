// Tipos y etiquetas del módulo Licores. Módulo aislado (como `mensual`): no importa nada
// de `nequi/types.ts` salvo el puente explícito de medios de pago que sí tocan el cuadre.

export type ActionResult = { ok: true } | { ok: false; error: string };

// Medios con los que se puede cobrar (venta) o pagar (compra) una cerveza.
// CREDITO = fiado: la cerveza sale pero la plata queda por cobrar.
export const LICOR_MEDIOS_PAGO = [
  "EFECTIVO",
  "NEQUI",
  "TARJETA",
  "DAVIPLATA",
  "TRANSFERENCIA",
  "CREDITO",
] as const;
export type LicorMedioPago = (typeof LICOR_MEDIOS_PAGO)[number];

export const LICOR_MEDIO_PAGO_LABELS: Record<LicorMedioPago, string> = {
  EFECTIVO: "Efectivo",
  NEQUI: "Nequi",
  TARJETA: "Tarjeta",
  DAVIPLATA: "Daviplata",
  TRANSFERENCIA: "Transferencia",
  CREDITO: "Crédito (fiado)",
};

// Solo estos dos medios pasan por la cuenta Nequi / la caja, así que solo ellos generan el
// Movement ligado del módulo Nequi. Los demás quedan únicamente en Licores: si generaran
// un Movement, descuadrarían el cierre de Nequi con plata que nunca pasó por ahí.
export function afectaCuadreNequi(medio: LicorMedioPago): medio is "EFECTIVO" | "NEQUI" {
  return medio === "EFECTIVO" || medio === "NEQUI";
}

// Umbral por defecto de la alerta de stock bajo al crear un producto nuevo.
export const STOCK_MINIMO_DEFECTO = 6;

// Medios con los que un cliente abona su deuda de cerveza. Solo 2, iguales a las modalidades
// del cierre de licores: el dueño maneja "efectivo" y "plataforma" (todo lo digital junto).
export const LICOR_MEDIOS_ABONO = ["EFECTIVO", "PLATAFORMA"] as const;
export type LicorMedioAbono = (typeof LICOR_MEDIOS_ABONO)[number];

export const LICOR_MEDIO_ABONO_LABELS: Record<LicorMedioAbono, string> = {
  EFECTIVO: "Efectivo",
  PLATAFORMA: "Plataforma (Nequi, tarjeta, Daviplata, transferencia)",
};
