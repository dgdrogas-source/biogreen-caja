import type { Direction, MovementType, PaymentMethod } from "../types";

// Solo los retiros y consignaciones desplazan el reparto de la base.
const BASE_TYPES: MovementType[] = ["RETIRO_CLIENTE", "CONSIGNACION_CLIENTE"];

// Cuánto cambia la porción en Nequi de la base por este movimiento.
// La porción en efectivo cambia en sentido contrario, así que la base total no cambia.
//   Retiro (entra plata a Nequi)      → Nequi sube, efectivo baja.
//   Consignación (sale plata de Nequi) → Nequi baja, efectivo sube.
export function baseNequiFlow(
  type: MovementType,
  direction: Direction,
  amount: number,
  paymentMethod: PaymentMethod
): number {
  if (paymentMethod !== "NEQUI") return 0;
  if (!BASE_TYPES.includes(type)) return 0;
  return direction === "INCOME" ? amount : -amount;
}
