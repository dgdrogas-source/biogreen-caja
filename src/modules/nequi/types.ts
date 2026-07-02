export const MOVEMENT_TYPES = [
  "VENTA_FARMACIA",
  "ABONO_CREDITO",
  "RETIRO_CLIENTE",
  "CONSIGNACION_CLIENTE",
  "COMISION",
  "VENTA_FUXION",
  "VENTA_LICORES_JHOANN",
  "PAGO_FACTURA",
  "GASTO_FARMACIA",
  "PENDIENTE_OTRO",
  "IMPUESTO_4X1000",
] as const;

export type MovementType = (typeof MOVEMENT_TYPES)[number];

export type PaymentMethod = "NEQUI" | "EFECTIVO";
export type Direction = "INCOME" | "EXPENSE";
export type Role = "ADMIN" | "WORKER";

export const MOVEMENT_LABELS: Record<MovementType, string> = {
  VENTA_FARMACIA: "Venta farmacia",
  ABONO_CREDITO: "Abono a crédito",
  RETIRO_CLIENTE: "Retiro cliente",
  CONSIGNACION_CLIENTE: "Consignación cliente",
  COMISION: "Comisión retiro/consignación",
  VENTA_FUXION: "Venta Fuxion",
  VENTA_LICORES_JHOANN: "Venta Licores Jhoann",
  PAGO_FACTURA: "Pago de factura",
  GASTO_FARMACIA: "Gasto farmacia",
  PENDIENTE_OTRO: "Pendiente / Otro",
  IMPUESTO_4X1000: "Impuesto 4x1000",
};

// Dirección fija por tipo. PENDIENTE_OTRO la elige quien registra.
export const MOVEMENT_DIRECTIONS: Record<Exclude<MovementType, "PENDIENTE_OTRO">, Direction> = {
  VENTA_FARMACIA: "INCOME",
  ABONO_CREDITO: "INCOME",
  RETIRO_CLIENTE: "INCOME", // el cliente envía a Nequi y recibe efectivo
  CONSIGNACION_CLIENTE: "EXPENSE", // la farmacia envía desde Nequi
  COMISION: "INCOME",
  VENTA_FUXION: "INCOME",
  VENTA_LICORES_JHOANN: "INCOME",
  PAGO_FACTURA: "EXPENSE",
  GASTO_FARMACIA: "EXPENSE",
  IMPUESTO_4X1000: "EXPENSE",
};

// Tipos que puede registrar cada rol.
export const WORKER_TYPES: MovementType[] = [
  "RETIRO_CLIENTE",
  "CONSIGNACION_CLIENTE",
  "COMISION",
  "VENTA_FUXION",
  "VENTA_LICORES_JHOANN",
  "PENDIENTE_OTRO",
];

export const ADMIN_TYPES: MovementType[] = [
  "VENTA_FARMACIA",
  "ABONO_CREDITO",
  "PAGO_FACTURA",
  "GASTO_FARMACIA",
  "PENDIENTE_OTRO",
];

// Tipos que se ingresan como UN total diario (vienen agregados del software de facturación).
export const DAILY_TOTAL_TYPES: MovementType[] = ["VENTA_FARMACIA", "ABONO_CREDITO"];
