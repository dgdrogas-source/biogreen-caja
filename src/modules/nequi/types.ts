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
  "OTRO",
  "PENDIENTE_OTRO",
  "IMPUESTO_4X1000",
] as const;

export type MovementType = (typeof MOVEMENT_TYPES)[number];

export type PaymentMethod = "NEQUI" | "EFECTIVO";
export type Direction = "INCOME" | "EXPENSE";
export type Role = "ADMIN" | "WORKER";

// Medios de pago del "Cierre general" (venta de la farmacia desglosada, de Dominium).
// Es más amplio que PaymentMethod (que solo distingue Nequi/Efectivo para el cuadre Nequi);
// aquí se captura la venta por cada medio, sin tocar el enum de Movement.
export const MEDIOS_PAGO = [
  "EFECTIVO",
  "NEQUI",
  "TARJETA",
  "DAVIPLATA",
  "TRANSFERENCIA",
  "CREDITO",
  "OTRO",
] as const;
export type MedioPago = (typeof MEDIOS_PAGO)[number];

export const MEDIO_PAGO_LABELS: Record<MedioPago, string> = {
  EFECTIVO: "Efectivo",
  NEQUI: "Nequi",
  TARJETA: "Tarjeta",
  DAVIPLATA: "Daviplata",
  TRANSFERENCIA: "Transferencia",
  CREDITO: "Crédito (fiado)",
  OTRO: "Otro",
};

// Medios de pago válidos para un ABONO a crédito (nunca "CREDITO": un abono siempre entra
// por un medio real).
export const MEDIOS_PAGO_ABONO = MEDIOS_PAGO.filter((m) => m !== "CREDITO");
export type MedioPagoAbono = (typeof MEDIOS_PAGO_ABONO)[number];

// Bolsas acumuladas 70/30 (Fase 2), aisladas de POCKET_BUCKETS/pockets.ts a propósito.
export const BOLSA_GENERAL_BUCKETS = ["REPOSICION", "GASTOS_UTILIDAD"] as const;
export type BolsaGeneralBucket = (typeof BOLSA_GENERAL_BUCKETS)[number];
export const BOLSA_GENERAL_LABELS: Record<BolsaGeneralBucket, string> = {
  REPOSICION: "Bolsa de reposición",
  GASTOS_UTILIDAD: "Bolsa de gastos/utilidad",
};

// Porcentaje de la venta que se aparta para reponer inventario (política del dueño).
// El resto (1 − 0.7 = 30%) es el sobre de gastos/utilidad.
export const PORCENTAJE_REPOSICION = 0.7;

// Base fija de efectivo con la que arranca la caja principal cada turno (política del
// dueño, confirmada 2026-07-15). El "sobre blanco" es una caja menor aparte que se cuenta
// por separado — no entra en el cuadre de la caja principal.
export const BASE_FIJA_EFECTIVO_CAJA = 200_000;

// Medio de pago de un gasto o factura del Cierre general (de dónde salió la plata).
// Distinto de MEDIOS_PAGO (que describe la VENTA): aquí importa diferenciar caja principal
// vs sobre blanco, porque solo la caja principal se cuadra contra el conteo físico.
export const METODOS_PAGO_ITEM = [
  "EFECTIVO_CAJA",
  "EFECTIVO_SOBRE",
  "NEQUI",
  "DATAFONO",
  "TRANSFERENCIA",
  "OTRO",
] as const;
export type MetodoPagoItem = (typeof METODOS_PAGO_ITEM)[number];
export const METODO_PAGO_ITEM_LABELS: Record<MetodoPagoItem, string> = {
  EFECTIVO_CAJA: "Efectivo (caja)",
  EFECTIVO_SOBRE: "Efectivo (sobre blanco)",
  NEQUI: "Nequi",
  DATAFONO: "Datáfono",
  TRANSFERENCIA: "Transferencia",
  OTRO: "Otro",
};

// Proveedores del Cierre general: un proveedor es de UN tipo (COSTO para facturas, GASTO
// para gastos). Si el dueño necesita el mismo nombre en ambos contextos, crea dos registros
// (decisión confirmada 2026-07-15).
export const PROVEEDOR_TIPOS = ["COSTO", "GASTO"] as const;
export type ProveedorTipo = (typeof PROVEEDOR_TIPOS)[number];
export const PROVEEDOR_TIPO_LABELS: Record<ProveedorTipo, string> = {
  COSTO: "Costo (facturas)",
  GASTO: "Gastos",
};

// Turnos de caja: 2 por día (lunes-sábado). Cada turno tiene su propio
// BusinessDay, cuadre y cierre; los horarios se configuran en /configuracion.
export const SHIFTS = [1, 2] as const;
export type Shift = (typeof SHIFTS)[number];
export const SHIFT_LABELS: Record<Shift, string> = { 1: "Turno 1", 2: "Turno 2" };

export const MOVEMENT_LABELS: Record<MovementType, string> = {
  VENTA_FARMACIA: "Venta farmacia",
  ABONO_CREDITO: "Abono a crédito",
  RETIRO_CLIENTE: "Retiro cliente",
  CONSIGNACION_CLIENTE: "Recarga cliente",
  COMISION: "Comisión retiro/consignación",
  VENTA_FUXION: "Venta Fuxion",
  VENTA_LICORES_JHOANN: "Venta Licores Jhoann",
  PAGO_FACTURA: "Pago de factura",
  GASTO_FARMACIA: "Gasto farmacia",
  OTRO: "Otro",
  PENDIENTE_OTRO: "Pendiente / Otro",
  IMPUESTO_4X1000: "Impuesto 4x1000",
};

// Dirección fija por tipo. PENDIENTE_OTRO y OTRO la elige quien registra/reclasifica.
export const MOVEMENT_DIRECTIONS: Record<
  Exclude<MovementType, "PENDIENTE_OTRO" | "OTRO">,
  Direction
> = {
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

// Bolsillos organizativos ("Tus Bolsillos"): acumulados paralelos, NO afectan el cuadre de
// Nequi. Cada uno tiene un ingreso automático (tipo nativo) opcional; los gastos/facturas
// se marcan manualmente contra el bolsillo del que salen.
export const POCKET_BUCKETS = [
  "COMISION",
  "LICORES_JHOANN",
  "FUXION",
  "BASE_FACTURAS",
  "PENDIENTE_OTRO",
] as const;
export type PocketBucket = (typeof POCKET_BUCKETS)[number];

export const POCKET_LABELS: Record<PocketBucket, string> = {
  COMISION: "Comisiones",
  LICORES_JHOANN: "Licores Jhoann",
  FUXION: "Fuxion",
  BASE_FACTURAS: "Base para facturas",
  PENDIENTE_OTRO: "Pendiente / Otro",
};

// Tipo cuyo ingreso alimenta automáticamente el bolsillo al registrarse (null = solo manual).
export const POCKET_AUTO_INCOME_TYPE: Record<PocketBucket, MovementType | null> = {
  COMISION: "COMISION",
  LICORES_JHOANN: "VENTA_LICORES_JHOANN",
  FUXION: "VENTA_FUXION",
  BASE_FACTURAS: null, // por ahora solo entrada manual (70% de venta total vendrá en el módulo 2)
  PENDIENTE_OTRO: null, // solo entrada manual
};

// Tipos que en el Historial pueden (re)asignarse a un bolsillo: los ingresos que ya
// alimentan uno (para poder corregirlo), los gastos/facturas (salida) y OTRO (entrada manual).
export const POCKET_ELIGIBLE_TYPES: MovementType[] = [
  "COMISION",
  "VENTA_LICORES_JHOANN",
  "VENTA_FUXION",
  "GASTO_FARMACIA",
  "PAGO_FACTURA",
  "OTRO",
];

// Bolsillos entre los que el admin puede transferir dinero (reclasificación interna,
// histórica). Comisiones es un bolsillo normal: transfiere y aparta como los demás.
// "DISPONIBLE" es un bolsillo virtual: representa la plata que está fuera de los bolsillos
// reales, y es la diferencia entre el Total (saldo esperado) y lo apartado. No se guarda
// como bucket en Movement, solo se usa para las transferencias.
export const TRANSFER_BUCKETS = [
  "DISPONIBLE",
  "COMISION",
  "LICORES_JHOANN",
  "FUXION",
  "BASE_FACTURAS",
  "PENDIENTE_OTRO",
] as const;
export type TransferBucket = (typeof TRANSFER_BUCKETS)[number];

export const TRANSFER_BUCKET_LABELS: Record<TransferBucket, string> = {
  DISPONIBLE: "Disponible",
  COMISION: "Comisiones",
  LICORES_JHOANN: "Licores Jhoann",
  FUXION: "Fuxion",
  BASE_FACTURAS: "Base para facturas",
  PENDIENTE_OTRO: "Pendiente / Otro",
};
