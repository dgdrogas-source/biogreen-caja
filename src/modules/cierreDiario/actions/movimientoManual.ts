"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { todayBogota } from "@/lib/dates";
import { calcularImpuesto4x1000 } from "@/modules/nequi/calculations/impuesto4x1000";
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

// Tope de "no fecha futura" aplicado con .refine().
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

function impuestoDe(tipo: TipoMovimientoManual, cuenta: CuentaCierreDiario, monto: number): number {
  return tipo === "EGRESO" && cuenta === "CUENTA_CORRIENTE" ? calcularImpuesto4x1000(monto) : 0;
}

// Movimientos que Dominium no conoce (arriendo, nómina, retiros, cuotas de manejo,
// transferencias entre cuentas propias) — antes se llevaban de memoria. El 4x1000 se calcula
// automático SOLO para egresos de Cuenta Corriente (Daviplata no lo paga). `date` puede ser
// cualquier día hasta hoy: MovimientosManualesCard no decide la fecha, solo usa la que le pasa
// la página que lo monta — "hoy" desde /cierre/diario, o un día pasado desde
// /cierre/diario/historial/[date] (agregado 2026-09-12).
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

