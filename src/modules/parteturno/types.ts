import { METODOS_PAGO_ITEM_MANUAL } from "@/modules/nequi/types";

// Estados del parte de turno. El flujo es BORRADOR → ENVIADO → APROBADO; "devolver" regresa
// a BORRADOR con una nota del admin. A propósito NO existe un estado RECHAZADO: sería un
// callejón sin salida del que la vendedora no podría sacar el parte.
export const PARTE_ESTADOS = ["BORRADOR", "ENVIADO", "APROBADO"] as const;
export type ParteEstado = (typeof PARTE_ESTADOS)[number];

// Cómo se le nombra el estado a la VENDEDORA (en su pantalla).
export const PARTE_ESTADO_LABELS: Record<ParteEstado, string> = {
  BORRADOR: "Borrador guardado",
  ENVIADO: "Enviado, esperando aprobación",
  APROBADO: "Aprobado",
};

// Cómo se le nombra al ADMIN (en la pestaña de revisión).
export const PARTE_ESTADO_LABELS_ADMIN: Record<ParteEstado, string> = {
  BORRADOR: "En borrador (la vendedora aún lo está llenando)",
  ENVIADO: "Pendiente de aprobar",
  APROBADO: "Aprobado",
};

// El parte solo lo puede editar la vendedora mientras esté en BORRADOR.
export function parteEsEditable(estado: string): boolean {
  return estado === "BORRADOR";
}

// Mismo contrato que el resto de acciones del proyecto: nunca lanzan al cliente.
export type ActionResult = { ok: true } | { ok: false; error: string };

// Métodos de pago que la VENDEDORA puede elegir: los manuales, sin DESCONTADO_ORIGEN (ese es
// exclusivo del 4% automático de tarjeta; elegirlo a mano descuadraría los saldos por
// plataforma). El schema Zod de las acciones del parte lo valida en servidor.
export type MetodoPagoManual = (typeof METODOS_PAGO_ITEM_MANUAL)[number];

// Un proveedor puede tener guardado cualquier método como habitual. Si por lo que sea fuera
// DESCONTADO_ORIGEN, simplemente no se pre-selecciona nada en vez de meter un valor que el
// servidor va a rechazar.
export function metodoPagoManual(valor: string | null | undefined): MetodoPagoManual | null {
  return METODOS_PAGO_ITEM_MANUAL.includes(valor as MetodoPagoManual)
    ? (valor as MetodoPagoManual)
    : null;
}
