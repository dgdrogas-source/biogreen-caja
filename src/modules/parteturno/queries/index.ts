import "server-only";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { MOVEMENT_LABELS, type MovementType, type Shift } from "@/modules/nequi/types";
import type { VentaFarmaciaNequi } from "../calculations/parteTurno";

// Todas las lecturas de este archivo son de SOLO LECTURA a propósito: NO usan getOrCreateDay
// ni getDaySummary, que escriben (crean el turno / heredan el saldo inicial). Abrir una
// pantalla no debe crear filas — es el mismo error que ya se corrigió en el Resumen del
// Cierre general ("días fantasma").

const parteItemsInclude = {
  gastoItems: {
    include: { categoria: true, proveedorRef: true },
    orderBy: { createdAt: "asc" as const },
  },
  facturaItems: {
    include: { proveedorRef: true },
    orderBy: { createdAt: "asc" as const },
  },
} satisfies Prisma.ParteTurnoInclude;

export type ParteTurnoConItems = Prisma.ParteTurnoGetPayload<{
  include: typeof parteItemsInclude;
}>;

// El parte del turno (uno por turno, compartido: es el parte DEL TURNO, no de una vendedora).
export async function getParteTurno(date: string, shift: Shift) {
  const day = await prisma.businessDay.findUnique({ where: { date_shift: { date, shift } } });
  if (!day) return null;
  return prisma.parteTurno.findUnique({
    where: { businessDayId: day.id },
    include: parteItemsInclude,
  });
}

// Partes esperando aprobación del admin, del más reciente al más antiguo.
export async function getPartesPendientes() {
  return prisma.parteTurno.findMany({
    where: { estado: "ENVIADO" },
    include: {
      ...parteItemsInclude,
      businessDay: { select: { date: true, shift: true, status: true } },
      registradoBy: { select: { name: true, username: true } },
    },
    orderBy: [{ businessDay: { date: "desc" } }, { businessDay: { shift: "desc" } }],
  });
}

export async function contarPartesPendientes(): Promise<number> {
  return prisma.parteTurno.count({ where: { estado: "ENVIADO" } });
}

// Lo que YA hay guardado en el Cierre general de ese turno. Sirve para mostrarle al admin la
// comparación "qué hay hoy vs qué entra con el parte" antes de aprobar.
export async function getCierreDelTurnoParaComparar(businessDayId: string) {
  return prisma.cierreGeneral.findUnique({
    where: { businessDayId },
    include: {
      gastoItems: { select: { monto: true } },
      facturaItems: { select: { monto: true } },
    },
  });
}

// ---------------------------------------------------------------------------
// NEQUI → PARTE (flujo de una sola dirección).
//
// Lee los movimientos del turno del módulo Nequi para pre-llenar y contrastar el parte.
// NUNCA escribe en Nequi: es una consulta, nada más.
// ---------------------------------------------------------------------------

// Tipos que se le muestran a la vendedora como referencia, para que no los teclee dos veces.
const TIPOS_REFERENCIA: MovementType[] = [
  "RETIRO_CLIENTE",
  "CONSIGNACION_CLIENTE",
  "COMISION",
  "GASTO_FARMACIA",
  "PAGO_FACTURA",
];

export interface ReferenciaNequi {
  type: MovementType;
  label: string;
  nequi: number;
  efectivo: number;
}

export interface ResumenNequiTurno {
  // Venta de farmacia ya registrada en Nequi (la registra el ADMIN como total del turno).
  ventaFarmacia: VentaFarmaciaNequi;
  referencias: ReferenciaNequi[];
}

export async function getResumenNequiDelTurno(
  date: string,
  shift: Shift
): Promise<ResumenNequiTurno> {
  const vacio: ResumenNequiTurno = { ventaFarmacia: { nequi: 0, efectivo: 0 }, referencias: [] };

  const day = await prisma.businessDay.findUnique({ where: { date_shift: { date, shift } } });
  if (!day) return vacio;

  const rows = await prisma.movement.findMany({
    where: {
      businessDayId: day.id,
      deletedAt: null,
      type: { in: ["VENTA_FARMACIA", ...TIPOS_REFERENCIA] },
    },
    select: { type: true, amount: true, paymentMethod: true },
  });

  const porTipo = new Map<string, { nequi: number; efectivo: number }>();
  for (const r of rows) {
    const acc = porTipo.get(r.type) ?? { nequi: 0, efectivo: 0 };
    if (r.paymentMethod === "NEQUI") acc.nequi += r.amount;
    else acc.efectivo += r.amount;
    porTipo.set(r.type, acc);
  }

  return {
    ventaFarmacia: porTipo.get("VENTA_FARMACIA") ?? { nequi: 0, efectivo: 0 },
    referencias: TIPOS_REFERENCIA.filter((t) => porTipo.has(t)).map((t) => ({
      type: t,
      label: MOVEMENT_LABELS[t],
      nequi: porTipo.get(t)!.nequi,
      efectivo: porTipo.get(t)!.efectivo,
    })),
  };
}
