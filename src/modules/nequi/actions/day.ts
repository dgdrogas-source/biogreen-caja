"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getOrCreateDay } from "../server/businessDay";

export type ActionResult = { ok: true } | { ok: false; error: string };

async function requireAdminSession() {
  const session = await auth();
  if (!session?.user) throw new Error("No autorizado");
  if (session.user.role !== "ADMIN") throw new Error("Solo el administrador puede hacer esto");
  return session.user;
}

const balanceSchema = z.number().int().nonnegative("El saldo no puede ser negativo");

// Definir el saldo inicial (primer uso, o corrección de un día abierto).
export async function setOpeningBalance(date: string, amount: number): Promise<ActionResult> {
  try {
    const user = await requireAdminSession();
    const value = balanceSchema.parse(amount);
    const day = await getOrCreateDay(date);
    if (day.status === "CLOSED") return { ok: false, error: "El día está cerrado, reábrelo primero" };

    await prisma.$transaction([
      prisma.businessDay.update({ where: { id: day.id }, data: { openingBalance: value } }),
      prisma.auditLog.create({
        data: {
          businessDayId: day.id,
          action: "UPDATE",
          changedById: user.id,
          fieldChanges: JSON.stringify({
            saldoInicial: { before: day.openingBalance, after: value },
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

export async function closeDay(date: string, realBalance: number): Promise<ActionResult> {
  try {
    const user = await requireAdminSession();
    const value = balanceSchema.parse(realBalance);
    const day = await getOrCreateDay(date);
    if (day.status === "CLOSED") return { ok: false, error: "Este día ya está cerrado" };
    if (day.openingBalance === null)
      return { ok: false, error: "Define primero el saldo inicial del día" };

    await prisma.$transaction([
      prisma.businessDay.update({
        where: { id: day.id },
        data: {
          closingRealBalance: value,
          status: "CLOSED",
          closedAt: new Date(),
          closedById: user.id,
        },
      }),
      prisma.auditLog.create({
        data: {
          businessDayId: day.id,
          action: "CLOSE_DAY",
          changedById: user.id,
          fieldChanges: JSON.stringify({ saldoReal: { before: null, after: value } }),
        },
      }),
    ]);

    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado" };
  }
}

export async function reopenDay(date: string): Promise<ActionResult> {
  try {
    const user = await requireAdminSession();
    const day = await prisma.businessDay.findUnique({ where: { date } });
    if (!day) return { ok: false, error: "Ese día no existe" };
    if (day.status !== "CLOSED") return { ok: false, error: "Ese día no está cerrado" };

    await prisma.$transaction([
      prisma.businessDay.update({
        where: { id: day.id },
        data: { status: "OPEN", closedAt: null, closedById: null },
      }),
      prisma.auditLog.create({
        data: {
          businessDayId: day.id,
          action: "REOPEN_DAY",
          changedById: user.id,
          fieldChanges: JSON.stringify({
            estado: { before: "CLOSED", after: "OPEN" },
            saldoRealAlCierre: { before: day.closingRealBalance, after: day.closingRealBalance },
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
