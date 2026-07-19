"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getSaldosPorPlataforma } from "../queries";
import { PLATAFORMAS } from "../types";

export type ActionResult = { ok: true } | { ok: false; error: string };

async function requireAdmin() {
  const session = await auth();
  if (!session?.user) throw new Error("No autorizado");
  if (session.user.role !== "ADMIN") throw new Error("Solo el administrador puede hacer esto");
  return session.user;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// ---- Ajustar saldo inicial de una plataforma (mismo patrón que ajustarBolsaGeneral) ----
const saldoInicialSchema = z.object({
  plataforma: z.enum(PLATAFORMAS),
  amount: z.number().int("El saldo debe ser un número entero"), // puede ser negativo
});

export async function ajustarSaldoInicialPlataforma(
  plataforma: string,
  amount: number
): Promise<ActionResult> {
  try {
    const user = await requireAdmin();
    const d = saldoInicialSchema.parse({ plataforma, amount });

    const current = await prisma.plataformaSaldoInicial.findUnique({
      where: { plataforma: d.plataforma },
    });
    if ((current?.openingBalance ?? 0) === d.amount) return { ok: true };

    await prisma.$transaction([
      prisma.plataformaSaldoInicial.upsert({
        where: { plataforma: d.plataforma },
        update: { openingBalance: d.amount },
        create: { plataforma: d.plataforma, openingBalance: d.amount },
      }),
      prisma.auditLog.create({
        data: {
          action: "SET_SALDO_PLATAFORMA",
          changedById: user.id,
          fieldChanges: JSON.stringify({
            plataforma: { before: d.plataforma, after: d.plataforma },
            saldoInicial: { before: current?.openingBalance ?? 0, after: d.amount },
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

// ---- Confirmar un abono de tarjeta (el banco abonó, en neto; puede ser parcial) ----
const abonoSchema = z.object({
  date: z.string().regex(DATE_RE, "Fecha inválida"),
  monto: z.number().int().positive("El monto debe ser mayor a cero"),
  nota: z.string().max(300).optional(),
});

export async function confirmarAbonoTarjeta(
  input: z.infer<typeof abonoSchema>
): Promise<ActionResult> {
  try {
    const user = await requireAdmin();
    const d = abonoSchema.parse(input);

    // No dejar confirmar más de lo que el banco tiene pendiente por abonar.
    const { tarjetaPendiente } = await getSaldosPorPlataforma();
    if (d.monto > tarjetaPendiente) {
      return {
        ok: false,
        error: `Solo hay $${tarjetaPendiente.toLocaleString("es-CO")} pendientes de abono de tarjeta.`,
      };
    }

    await prisma.$transaction([
      prisma.tarjetaAbono.create({
        data: { date: d.date, monto: d.monto, nota: d.nota ?? null, createdById: user.id },
      }),
      prisma.auditLog.create({
        data: {
          action: "TARJETA_ABONO",
          changedById: user.id,
          fieldChanges: JSON.stringify({ abono: { before: null, after: d.monto } }),
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

export async function eliminarAbonoTarjeta(id: string): Promise<ActionResult> {
  try {
    const user = await requireAdmin();
    const abono = await prisma.tarjetaAbono.findUnique({ where: { id } });
    if (!abono) return { ok: false, error: "Abono no encontrado" };

    await prisma.$transaction([
      prisma.tarjetaAbono.delete({ where: { id } }),
      prisma.auditLog.create({
        data: {
          action: "TARJETA_ABONO_DELETE",
          changedById: user.id,
          fieldChanges: JSON.stringify({ abono: { before: abono.monto, after: null } }),
        },
      }),
    ]);

    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado" };
  }
}

// ---- Registrar un movimiento real entre plataformas (ej. Banco → Nequi) ----
const transferenciaSchema = z
  .object({
    fromPlataforma: z.enum(PLATAFORMAS),
    toPlataforma: z.enum(PLATAFORMAS),
    monto: z.number().int().positive("El monto debe ser mayor a cero"),
    impuesto4x1000: z.number().int().nonnegative().optional(),
    nota: z.string().max(300).optional(),
  })
  .refine((d) => d.fromPlataforma !== d.toPlataforma, {
    message: "El origen y el destino no pueden ser la misma plataforma",
  });

export async function registrarTransferenciaPlataforma(
  input: z.infer<typeof transferenciaSchema>
): Promise<ActionResult> {
  try {
    const user = await requireAdmin();
    const d = transferenciaSchema.parse(input);

    await prisma.$transaction([
      prisma.plataformaTransferencia.create({
        data: {
          fromPlataforma: d.fromPlataforma,
          toPlataforma: d.toPlataforma,
          monto: d.monto,
          impuesto4x1000: d.impuesto4x1000 ?? 0,
          nota: d.nota ?? null,
          createdById: user.id,
        },
      }),
      prisma.auditLog.create({
        data: {
          action: "PLATAFORMA_TRANSFERENCIA",
          changedById: user.id,
          fieldChanges: JSON.stringify({
            movimiento: { before: null, after: `${d.fromPlataforma} → ${d.toPlataforma}` },
            monto: { before: null, after: d.monto },
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

export async function eliminarTransferenciaPlataforma(id: string): Promise<ActionResult> {
  try {
    const user = await requireAdmin();
    const t = await prisma.plataformaTransferencia.findUnique({ where: { id } });
    if (!t) return { ok: false, error: "Movimiento no encontrado" };

    await prisma.$transaction([
      prisma.plataformaTransferencia.delete({ where: { id } }),
      prisma.auditLog.create({
        data: {
          action: "PLATAFORMA_TRANSFERENCIA_DELETE",
          changedById: user.id,
          fieldChanges: JSON.stringify({
            movimiento: { before: `${t.fromPlataforma} → ${t.toPlataforma}`, after: null },
            monto: { before: t.monto, after: null },
          }),
        },
      }),
    ]);

    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado" };
  }
}
