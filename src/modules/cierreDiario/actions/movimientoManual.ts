"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { todayBogota } from "@/lib/dates";
import { calcularImpuesto4x1000 } from "@/modules/nequi/calculations/impuesto4x1000";
import { getMovimientosManualesRango } from "../queries";
import {
  CUENTAS_CIERRE_DIARIO,
  TIPOS_MOVIMIENTO_MANUAL,
  type CuentaCierreDiario,
  type TipoMovimientoManual,
} from "../types";

export type ActionResult = { ok: true; mensaje?: string } | { ok: false; error: string };

async function requireAdmin() {
  const session = await auth();
  if (!session?.user) throw new Error("No autorizado");
  if (session.user.role !== "ADMIN") throw new Error("Solo el administrador puede hacer esto");
  return session.user;
}

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida");

// Base sin refine (para poder .extend() en actualizarSchema — zod no deja extender un
// ZodEffects). El tope de "no fecha futura" se aplica en ambos schemas de abajo.
const movimientoBase = z.object({
  date: dateSchema,
  descripcion: z.string().trim().min(1, "Escribe una descripción").max(200),
  tipo: z.enum(TIPOS_MOVIMIENTO_MANUAL),
  cuenta: z.enum(CUENTAS_CIERRE_DIARIO),
  monto: z.number().int().positive("El monto debe ser mayor a cero"),
});
const noFechaFutura = (d: { date: string }) => d.date <= todayBogota();
const MSG_FECHA_FUTURA = { message: "No puedes registrar un movimiento con fecha futura", path: ["date"] };

const movimientoSchema = movimientoBase.refine(noFechaFutura, MSG_FECHA_FUTURA);
const actualizarSchema = movimientoBase.extend({ id: z.string().min(1) }).refine(noFechaFutura, MSG_FECHA_FUTURA);

function impuestoDe(tipo: TipoMovimientoManual, cuenta: CuentaCierreDiario, monto: number): number {
  return tipo === "EGRESO" && cuenta === "CUENTA_CORRIENTE" ? calcularImpuesto4x1000(monto) : 0;
}

// Movimientos que Dominium no conoce (arriendo, nómina, retiros, cuotas de manejo,
// transferencias entre cuentas propias) — antes se llevaban de memoria. El 4x1000 se calcula
// automático SOLO para egresos de Cuenta Corriente (Daviplata no lo paga). `date` puede ser
// cualquier día hasta hoy — el admin puede registrar un ingreso/egreso de un día anterior que
// se le haya pasado (ver HistorialMovimientosManualesCard).
export async function registrarMovimientoManual(
  input: z.infer<typeof movimientoSchema>
): Promise<ActionResult> {
  try {
    const user = await requireAdmin();
    const d = movimientoSchema.parse(input);
    const impuesto4x1000 = impuestoDe(d.tipo, d.cuenta, d.monto);

    await prisma.$transaction([
      prisma.cierreDiarioMovimientoManual.create({
        data: {
          date: d.date,
          descripcion: d.descripcion,
          tipo: d.tipo,
          cuenta: d.cuenta,
          monto: d.monto,
          impuesto4x1000,
          createdById: user.id,
        },
      }),
      prisma.auditLog.create({
        data: {
          action: "CIERRE_DIARIO_MOVIMIENTO_MANUAL_CREATE",
          changedById: user.id,
          fieldChanges: JSON.stringify({
            descripcion: { before: null, after: d.descripcion },
            monto: { before: null, after: d.monto },
            fecha: { before: null, after: d.date },
          }),
        },
      }),
    ]);

    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    if (e instanceof z.ZodError) return { ok: false, error: e.issues[0]?.message ?? "Datos inválidos" };
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado" };
  }
}

// Corrige un movimiento ya registrado (typo en la descripción, monto mal digitado, tipo o
// cuenta equivocada) — de cualquier día, no solo de hoy. El 4x1000 se recalcula desde cero con
// los valores nuevos (nunca se arrastra el impuesto viejo).
export async function actualizarMovimientoManual(
  input: z.infer<typeof actualizarSchema>
): Promise<ActionResult> {
  try {
    const user = await requireAdmin();
    const d = actualizarSchema.parse(input);

    const existente = await prisma.cierreDiarioMovimientoManual.findUnique({ where: { id: d.id } });
    if (!existente) return { ok: false, error: "Movimiento no encontrado" };

    const impuesto4x1000 = impuestoDe(d.tipo, d.cuenta, d.monto);

    await prisma.$transaction([
      prisma.cierreDiarioMovimientoManual.update({
        where: { id: d.id },
        data: {
          date: d.date,
          descripcion: d.descripcion,
          tipo: d.tipo,
          cuenta: d.cuenta,
          monto: d.monto,
          impuesto4x1000,
        },
      }),
      prisma.auditLog.create({
        data: {
          action: "CIERRE_DIARIO_MOVIMIENTO_MANUAL_UPDATE",
          changedById: user.id,
          fieldChanges: JSON.stringify({
            descripcion: { before: existente.descripcion, after: d.descripcion },
            monto: { before: existente.monto, after: d.monto },
            fecha: { before: existente.date, after: d.date },
            tipo: { before: existente.tipo, after: d.tipo },
            cuenta: { before: existente.cuenta, after: d.cuenta },
          }),
        },
      }),
    ]);

    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    if (e instanceof z.ZodError) return { ok: false, error: e.issues[0]?.message ?? "Datos inválidos" };
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado" };
  }
}

export async function eliminarMovimientoManual(id: string): Promise<ActionResult> {
  try {
    const user = await requireAdmin();
    const mov = await prisma.cierreDiarioMovimientoManual.findUnique({ where: { id } });
    if (!mov) return { ok: false, error: "Movimiento no encontrado" };

    await prisma.$transaction([
      prisma.cierreDiarioMovimientoManual.delete({ where: { id } }),
      prisma.auditLog.create({
        data: {
          action: "CIERRE_DIARIO_MOVIMIENTO_MANUAL_DELETE",
          changedById: user.id,
          fieldChanges: JSON.stringify({ descripcion: { before: mov.descripcion, after: null } }),
        },
      }),
    ]);

    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado" };
  }
}

export interface MovimientoManualBuscado {
  id: string;
  date: string;
  descripcion: string;
  tipo: TipoMovimientoManual;
  cuenta: CuentaCierreDiario;
  monto: number;
  impuesto4x1000: number;
}

// Lectura bajo demanda para HistorialMovimientosManualesCard: el admin elige una fecha
// cualquiera (no solo la ventana que alimenta el esperado de Cuenta Corriente de hoy) y ve/
// corrige lo que haya ese día. Reusa la query de rango con desde==hasta (un solo día).
export async function buscarMovimientosManualesPorFecha(
  date: string
): Promise<{ ok: true; items: MovimientoManualBuscado[] } | { ok: false; error: string }> {
  try {
    await requireAdmin();
    const d = dateSchema.parse(date);
    const rows = await getMovimientosManualesRango(d, d);
    return {
      ok: true,
      items: rows.map((r) => ({
        id: r.id,
        date: r.date,
        descripcion: r.descripcion,
        tipo: r.tipo as TipoMovimientoManual,
        cuenta: r.cuenta as CuentaCierreDiario,
        monto: r.monto,
        impuesto4x1000: r.impuesto4x1000,
      })),
    };
  } catch (e) {
    if (e instanceof z.ZodError) return { ok: false, error: e.issues[0]?.message ?? "Fecha inválida" };
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado" };
  }
}
