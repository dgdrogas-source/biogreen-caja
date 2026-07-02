import { TASA_4X1000 } from "@/lib/config";
import type { MovementType, PaymentMethod } from "../types";

// Tipos de movimiento que sacan dinero de Nequi y por tanto generan 4x1000.
const TIPOS_CON_IMPUESTO: MovementType[] = [
  "CONSIGNACION_CLIENTE",
  "PAGO_FACTURA",
  "GASTO_FARMACIA",
];

export function aplica4x1000(type: MovementType, paymentMethod: PaymentMethod): boolean {
  return paymentMethod === "NEQUI" && TIPOS_CON_IMPUESTO.includes(type);
}

export function calcularImpuesto4x1000(monto: number): number {
  return Math.round(monto * TASA_4X1000);
}
