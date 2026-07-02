"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { SALDO_REFERENCIA } from "@/lib/config";
import { todayBogota } from "@/lib/dates";
import { baseNequiFlow } from "../calculations/base";
import { aplica4x1000, calcularImpuesto4x1000 } from "../calculations/impuesto4x1000";
import {
  ADMIN_TYPES,
  DAILY_TOTAL_TYPES,
  MOVEMENT_DIRECTIONS,
  MOVEMENT_TYPES,
  WORKER_TYPES,
  type Direction,
  type MovementType,
  type PaymentMethod,
} from "../types";
import { getOrCreateDay } from "../server/businessDay";

// Desplaza el reparto de la base: la porción Nequi cambia y la de efectivo va al revés.
async function adjustBase(tx: Prisma.TransactionClient, deltaNequi: number) {
  if (deltaNequi === 0) return;
  await tx.baseFund.upsert({
    where: { id: 1 },
    update: {
      nequiPortion: { increment: deltaNequi },
      cashPortion: { decrement: deltaNequi },
    },
    create: {
      id: 1,
      nequiPortion: SALDO_REFERENCIA + deltaNequi,
      cashPortion: -deltaNequi,
    },
  });
}

export type ActionResult = { ok: true } | { ok: false; error: string };

const movementSchema = z.object({
  type: z.enum(MOVEMENT_TYPES.filter((t) => t !== "IMPUESTO_4X1000") as [MovementType, ...MovementType[]]),
  amount: z.number().int("El monto debe ser un número entero").positive("El monto debe ser mayor a cero"),
  paymentMethod: z.enum(["NEQUI", "EFECTIVO"]),
  note: z.string().max(300).optional(),
  direction: z.enum(["INCOME", "EXPENSE"]).optional(), // solo para PENDIENTE_OTRO
  sourceMovementId: z.string().optional(), // solo para COMISION
});

export type MovementInput = z.infer<typeof movementSchema>;

async function requireSession() {
  const session = await auth();
  if (!session?.user) throw new Error("No autorizado");
  return session.user;
}

function allowedTypes(role: string): MovementType[] {
  return role === "ADMIN" ? [...ADMIN_TYPES, ...WORKER_TYPES] : WORKER_TYPES;
}

function resolveDirection(type: MovementType, direction?: string): string {
  if (type === "PENDIENTE_OTRO") return direction === "EXPENSE" ? "EXPENSE" : "INCOME";
  return MOVEMENT_DIRECTIONS[type as Exclude<MovementType, "PENDIENTE_OTRO">];
}

function revalidateAll() {
  revalidatePath("/", "layout");
}

export async function createMovement(input: MovementInput): Promise<ActionResult> {
  try {
    const user = await requireSession();
    const data = movementSchema.parse(input);

    if (!allowedTypes(user.role).includes(data.type)) {
      return { ok: false, error: "No tienes permiso para registrar este tipo de movimiento" };
    }

    const day = await getOrCreateDay(todayBogota());
    if (day.status === "CLOSED") {
      return { ok: false, error: "El día ya fue cerrado. Pide al administrador que lo reabra." };
    }

    const direction = resolveDirection(data.type, data.direction);

    // Ventas farmacia y abonos se manejan como UN total diario: si ya existe, se actualiza.
    if (DAILY_TOTAL_TYPES.includes(data.type)) {
      const existing = await prisma.movement.findFirst({
        where: { businessDayId: day.id, type: data.type, deletedAt: null },
      });
      if (existing) {
        await prisma.$transaction([
          prisma.movement.update({
            where: { id: existing.id },
            data: { amount: data.amount, note: data.note },
          }),
          prisma.auditLog.create({
            data: {
              movementId: existing.id,
              businessDayId: day.id,
              action: "UPDATE",
              changedById: user.id,
              fieldChanges: JSON.stringify({
                amount: { before: existing.amount, after: data.amount },
              }),
            },
          }),
        ]);
        revalidateAll();
        return { ok: true };
      }
    }

    await prisma.$transaction(async (tx) => {
      const movement = await tx.movement.create({
        data: {
          businessDayId: day.id,
          type: data.type,
          direction,
          amount: data.amount,
          paymentMethod: data.paymentMethod,
          note: data.note,
          registeredById: user.id,
          sourceMovementId: data.sourceMovementId,
          needsReclassification: data.type === "PENDIENTE_OTRO",
        },
      });

      await tx.auditLog.create({
        data: {
          movementId: movement.id,
          businessDayId: day.id,
          action: "CREATE",
          changedById: user.id,
        },
      });

      // Un retiro/consignación desplaza el reparto de la base.
      await adjustBase(
        tx,
        baseNequiFlow(data.type, direction as Direction, data.amount, data.paymentMethod)
      );

      // 4x1000 automático sobre dinero que sale de Nequi.
      if (aplica4x1000(data.type, data.paymentMethod)) {
        const tax = await tx.movement.create({
          data: {
            businessDayId: day.id,
            type: "IMPUESTO_4X1000",
            direction: "EXPENSE",
            amount: calcularImpuesto4x1000(data.amount),
            paymentMethod: "NEQUI",
            registeredById: user.id,
            isSystemGenerated: true,
            sourceMovementId: movement.id,
          },
        });
        await tx.auditLog.create({
          data: {
            movementId: tax.id,
            businessDayId: day.id,
            action: "CREATE",
            changedById: user.id,
            fieldChanges: JSON.stringify({ auto: { before: null, after: "4x1000 automático" } }),
          },
        });
      }
    });

    revalidateAll();
    return { ok: true };
  } catch (e) {
    if (e instanceof z.ZodError) return { ok: false, error: e.issues[0]?.message ?? "Datos inválidos" };
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado" };
  }
}

const updateSchema = z.object({
  id: z.string(),
  amount: z.number().int().positive("El monto debe ser mayor a cero"),
  paymentMethod: z.enum(["NEQUI", "EFECTIVO"]),
  note: z.string().max(300).optional(),
});

export type MovementUpdateInput = z.infer<typeof updateSchema>;

export async function updateMovement(input: MovementUpdateInput): Promise<ActionResult> {
  try {
    const user = await requireSession();
    const data = updateSchema.parse(input);

    const movement = await prisma.movement.findUnique({
      where: { id: data.id },
      include: { businessDay: true, derivedMovements: { where: { type: "IMPUESTO_4X1000", deletedAt: null } } },
    });
    if (!movement || movement.deletedAt) return { ok: false, error: "Movimiento no encontrado" };
    if (movement.isSystemGenerated) return { ok: false, error: "Los movimientos automáticos no se editan directamente" };

    if (user.role !== "ADMIN") {
      if (movement.registeredById !== user.id) return { ok: false, error: "Solo puedes editar tus propios registros" };
      if (movement.businessDay.date !== todayBogota()) return { ok: false, error: "Solo puedes editar registros del día actual" };
    }
    if (movement.businessDay.status === "CLOSED") {
      return { ok: false, error: "El día está cerrado. El administrador debe reabrirlo para editar." };
    }

    const changes: Record<string, { before: unknown; after: unknown }> = {};
    if (movement.amount !== data.amount) changes.monto = { before: movement.amount, after: data.amount };
    if (movement.paymentMethod !== data.paymentMethod)
      changes.medioPago = { before: movement.paymentMethod, after: data.paymentMethod };
    if ((movement.note ?? "") !== (data.note ?? "")) changes.nota = { before: movement.note, after: data.note };
    if (Object.keys(changes).length === 0) return { ok: true };

    await prisma.$transaction(async (tx) => {
      await tx.movement.update({
        where: { id: movement.id },
        data: { amount: data.amount, paymentMethod: data.paymentMethod, note: data.note },
      });

      // Ajustar el reparto de la base por la diferencia (viejo → nuevo).
      const oldFlow = baseNequiFlow(
        movement.type as MovementType,
        movement.direction as Direction,
        movement.amount,
        movement.paymentMethod as PaymentMethod
      );
      const newFlow = baseNequiFlow(
        movement.type as MovementType,
        movement.direction as Direction,
        data.amount,
        data.paymentMethod as PaymentMethod
      );
      await adjustBase(tx, newFlow - oldFlow);

      await tx.auditLog.create({
        data: {
          movementId: movement.id,
          businessDayId: movement.businessDayId,
          action: "UPDATE",
          changedById: user.id,
          fieldChanges: JSON.stringify(changes),
        },
      });

      // Recalcular el 4x1000 ligado si cambia monto o medio de pago.
      const taxChild = movement.derivedMovements[0];
      const shouldHaveTax = aplica4x1000(movement.type as MovementType, data.paymentMethod as PaymentMethod);
      if (shouldHaveTax) {
        const newTax = calcularImpuesto4x1000(data.amount);
        if (taxChild) {
          if (taxChild.amount !== newTax) {
            await tx.movement.update({ where: { id: taxChild.id }, data: { amount: newTax } });
          }
        } else {
          await tx.movement.create({
            data: {
              businessDayId: movement.businessDayId,
              type: "IMPUESTO_4X1000",
              direction: "EXPENSE",
              amount: newTax,
              paymentMethod: "NEQUI",
              registeredById: user.id,
              isSystemGenerated: true,
              sourceMovementId: movement.id,
            },
          });
        }
      } else if (taxChild) {
        await tx.movement.update({ where: { id: taxChild.id }, data: { deletedAt: new Date() } });
      }
    });

    revalidateAll();
    return { ok: true };
  } catch (e) {
    if (e instanceof z.ZodError) return { ok: false, error: e.issues[0]?.message ?? "Datos inválidos" };
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado" };
  }
}

export async function deleteMovement(id: string): Promise<ActionResult> {
  try {
    const user = await requireSession();

    const movement = await prisma.movement.findUnique({
      where: { id },
      include: { businessDay: true, derivedMovements: { where: { type: "IMPUESTO_4X1000", deletedAt: null } } },
    });
    if (!movement || movement.deletedAt) return { ok: false, error: "Movimiento no encontrado" };
    if (movement.isSystemGenerated) return { ok: false, error: "Los movimientos automáticos no se borran directamente" };

    if (user.role !== "ADMIN") {
      if (movement.registeredById !== user.id) return { ok: false, error: "Solo puedes borrar tus propios registros" };
      if (movement.businessDay.date !== todayBogota()) return { ok: false, error: "Solo puedes borrar registros del día actual" };
    }
    if (movement.businessDay.status === "CLOSED") {
      return { ok: false, error: "El día está cerrado. El administrador debe reabrirlo." };
    }

    const now = new Date();
    await prisma.$transaction(async (tx) => {
      await tx.movement.update({ where: { id: movement.id }, data: { deletedAt: now } });

      // Revertir el efecto del movimiento sobre el reparto de la base.
      await adjustBase(
        tx,
        -baseNequiFlow(
          movement.type as MovementType,
          movement.direction as Direction,
          movement.amount,
          movement.paymentMethod as PaymentMethod
        )
      );

      await tx.auditLog.create({
        data: {
          movementId: movement.id,
          businessDayId: movement.businessDayId,
          action: "DELETE",
          changedById: user.id,
          fieldChanges: JSON.stringify({
            monto: { before: movement.amount, after: null },
            tipo: { before: movement.type, after: null },
          }),
        },
      });
      for (const child of movement.derivedMovements) {
        await tx.movement.update({ where: { id: child.id }, data: { deletedAt: now } });
      }
    });

    revalidateAll();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado" };
  }
}

// Reclasificar un "Pendiente / Otro" (solo admin).
export async function reclassifyMovement(id: string, newType: MovementType): Promise<ActionResult> {
  try {
    const user = await requireSession();
    if (user.role !== "ADMIN") return { ok: false, error: "Solo el administrador puede reclasificar" };
    if (newType === "IMPUESTO_4X1000" || newType === "PENDIENTE_OTRO")
      return { ok: false, error: "Tipo de destino inválido" };

    const movement = await prisma.movement.findUnique({
      where: { id },
      include: { derivedMovements: { where: { type: "IMPUESTO_4X1000", deletedAt: null } } },
    });
    if (!movement || movement.deletedAt) return { ok: false, error: "Movimiento no encontrado" };
    if (movement.type !== "PENDIENTE_OTRO") return { ok: false, error: "Solo se reclasifican movimientos pendientes" };

    const direction = resolveDirection(newType);

    await prisma.$transaction(async (tx) => {
      await tx.movement.update({
        where: { id: movement.id },
        data: { type: newType, direction, needsReclassification: false },
      });

      // Si pasa a ser retiro/consignación, ahora sí desplaza el reparto de la base.
      await adjustBase(
        tx,
        baseNequiFlow(
          newType,
          direction as Direction,
          movement.amount,
          movement.paymentMethod as PaymentMethod
        )
      );

      await tx.auditLog.create({
        data: {
          movementId: movement.id,
          businessDayId: movement.businessDayId,
          action: "UPDATE",
          changedById: user.id,
          fieldChanges: JSON.stringify({ tipo: { before: "PENDIENTE_OTRO", after: newType } }),
        },
      });
      if (aplica4x1000(newType, movement.paymentMethod as PaymentMethod)) {
        await tx.movement.create({
          data: {
            businessDayId: movement.businessDayId,
            type: "IMPUESTO_4X1000",
            direction: "EXPENSE",
            amount: calcularImpuesto4x1000(movement.amount),
            paymentMethod: "NEQUI",
            registeredById: user.id,
            isSystemGenerated: true,
            sourceMovementId: movement.id,
          },
        });
      }
    });

    revalidateAll();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado" };
  }
}
