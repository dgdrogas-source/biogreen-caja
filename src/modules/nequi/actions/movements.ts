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
import { calcularApartadoEnBolsillos, calcularDisponible } from "../calculations/pockets";
import {
  ADMIN_TYPES,
  DAILY_TOTAL_TYPES,
  MOVEMENT_DIRECTIONS,
  MOVEMENT_TYPES,
  POCKET_BUCKETS,
  TRANSFER_BUCKETS,
  TRANSFER_BUCKET_LABELS,
  WORKER_TYPES,
  type Direction,
  type MovementType,
  type PaymentMethod,
  type PocketBucket,
  type TransferBucket,
} from "../types";
import {
  borrarLicorLigadoAMovement,
  licorLigadoAMovement,
} from "@/modules/licores/server/movementLink";
import { getOrCreateDay } from "../server/businessDay";
import { getBaseFund, getCurrentShift, getDaySummary, getPockets } from "../queries";

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
  pettyCashBucket: z.enum(POCKET_BUCKETS).optional(), // solo para GASTO_FARMACIA / PAGO_FACTURA
  shift: z.union([z.literal(1), z.literal(2)]).optional(), // turno elegido; sin él, se deduce de la hora
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida").optional(), // solo admin; sin ella = hoy
});

// Solo gastos y facturas eligen bolsillo al registrarse (los demás se auto-asignan o se
// etiquetan después desde el historial).
function canChooseBucket(type: MovementType): boolean {
  return type === "GASTO_FARMACIA" || type === "PAGO_FACTURA";
}

// Ingreso automático: el tipo alimenta su propio bolsillo sin que nadie lo elija.
function autoPocketBucket(type: MovementType): PocketBucket | null {
  if (type === "COMISION") return "COMISION";
  if (type === "VENTA_LICORES_JHOANN") return "LICORES_JHOANN";
  if (type === "VENTA_FUXION") return "FUXION";
  return null;
}

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
  if (type === "PENDIENTE_OTRO" || type === "OTRO")
    return direction === "EXPENSE" ? "EXPENSE" : "INCOME";
  return MOVEMENT_DIRECTIONS[type as Exclude<MovementType, "PENDIENTE_OTRO" | "OTRO">];
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

    const shift = data.shift ?? (await getCurrentShift());
    // La fecha solo la puede fijar el ADMIN (registrar un día anterior que no se cerró).
    // Se ignora una fecha futura o de un no-admin: en esos casos se usa hoy.
    const hoy = todayBogota();
    const targetDate = data.date && user.role === "ADMIN" && data.date <= hoy ? data.date : hoy;
    const day = await getOrCreateDay(targetDate, shift);
    if (day.status === "CLOSED") {
      return {
        ok: false,
        error:
          targetDate === hoy
            ? `El turno ${shift} ya fue cerrado. Pide al administrador que lo reabra.`
            : `El turno ${shift} del ${targetDate} está cerrado. Reábrelo desde el Cierre para registrar ahí.`,
      };
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
          pettyCashBucket:
            autoPocketBucket(data.type) ??
            (canChooseBucket(data.type) ? (data.pettyCashBucket ?? null) : null),
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
            pettyCashBucket: "COMISION",
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
  // Edición completa (solo admin, desde el Historial). Si no vienen, se conservan.
  type: z
    .enum(MOVEMENT_TYPES.filter((t) => t !== "IMPUESTO_4X1000") as [MovementType, ...MovementType[]])
    .optional(),
  direction: z.enum(["INCOME", "EXPENSE"]).optional(), // solo para PENDIENTE_OTRO / OTRO
  pettyCashBucket: z.enum(POCKET_BUCKETS).nullable().optional(), // null = quitar bolsillo
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

    // Un movimiento creado desde Licores lleva pegada una venta/compra con su cantidad y su
    // producto. Editar aquí solo el monto los dejaría diciendo cosas distintas, así que se
    // bloquea: se borra y se vuelve a registrar desde el pop-up de cerveza.
    const licorEnEdicion = await licorLigadoAMovement(movement.id);
    if (licorEnEdicion) {
      return {
        ok: false,
        error: `Esta ${licorEnEdicion.tipo} de cerveza (${licorEnEdicion.descripcion}) se registró en Licores. Bórrala y vuelve a registrarla para corregirla.`,
      };
    }

    if (user.role !== "ADMIN") {
      if (movement.registeredById !== user.id) return { ok: false, error: "Solo puedes editar tus propios registros" };
      if (movement.businessDay.date !== todayBogota()) return { ok: false, error: "Solo puedes editar registros del día actual" };
      if (data.type !== undefined || data.pettyCashBucket !== undefined)
        return { ok: false, error: "Solo el administrador puede cambiar el tipo o el bolsillo" };
    }
    if (movement.businessDay.status === "CLOSED") {
      return { ok: false, error: "El turno está cerrado. El administrador debe reabrirlo para editar." };
    }

    const newType = data.type ?? (movement.type as MovementType);
    if (newType !== movement.type) {
      // Ventas farmacia y abonos viven como UN total del turno; convertir hacia o
      // desde ellos duplicaría/rompería ese total. Se editan desde "Movimientos".
      if (DAILY_TOTAL_TYPES.includes(newType) || DAILY_TOTAL_TYPES.includes(movement.type as MovementType)) {
        return {
          ok: false,
          error: "Las ventas de farmacia y los abonos se manejan como un total del turno; ese tipo no se cambia desde aquí",
        };
      }
    }
    const newDirection = resolveDirection(newType, data.direction ?? movement.direction) as Direction;
    const newBucket =
      data.pettyCashBucket !== undefined
        ? data.pettyCashBucket
        : newType !== movement.type
          ? (autoPocketBucket(newType) ?? movement.pettyCashBucket)
          : movement.pettyCashBucket;

    const changes: Record<string, { before: unknown; after: unknown }> = {};
    if (movement.type !== newType) changes.tipo = { before: movement.type, after: newType };
    if (movement.direction !== newDirection)
      changes.direccion = { before: movement.direction, after: newDirection };
    if (movement.amount !== data.amount) changes.monto = { before: movement.amount, after: data.amount };
    if (movement.paymentMethod !== data.paymentMethod)
      changes.medioPago = { before: movement.paymentMethod, after: data.paymentMethod };
    if ((movement.note ?? "") !== (data.note ?? "")) changes.nota = { before: movement.note, after: data.note };
    if ((movement.pettyCashBucket ?? null) !== (newBucket ?? null))
      changes.bolsillo = { before: movement.pettyCashBucket, after: newBucket };
    if (Object.keys(changes).length === 0) return { ok: true };

    await prisma.$transaction(async (tx) => {
      await tx.movement.update({
        where: { id: movement.id },
        data: {
          type: newType,
          direction: newDirection,
          amount: data.amount,
          paymentMethod: data.paymentMethod,
          note: data.note,
          pettyCashBucket: newBucket,
          needsReclassification: newType === "PENDIENTE_OTRO",
        },
      });

      // Ajustar el reparto de la base por la diferencia (viejo → nuevo), ahora
      // también cuando cambia el tipo (p. ej. deja de ser retiro/consignación).
      const oldFlow = baseNequiFlow(
        movement.type as MovementType,
        movement.direction as Direction,
        movement.amount,
        movement.paymentMethod as PaymentMethod
      );
      const newFlow = baseNequiFlow(newType, newDirection, data.amount, data.paymentMethod as PaymentMethod);
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

      // Recalcular el 4x1000 ligado según el TIPO y MEDIO nuevos: se crea si ahora
      // aplica, se recalcula si cambió el monto, o se borra si dejó de aplicar.
      const taxChild = movement.derivedMovements[0];
      const shouldHaveTax = aplica4x1000(newType, data.paymentMethod as PaymentMethod);
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
              pettyCashBucket: "COMISION",
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
      return { ok: false, error: "El turno está cerrado. El administrador debe reabrirlo." };
    }

    // Si este movimiento lo creó el módulo Licores, borrarlo también tiene que devolver la
    // cerveza al inventario. Lo único que no se puede es tocarlo si ya entró a un cierre de
    // licores: eso descuadraría ese corte.
    const licor = await licorLigadoAMovement(movement.id);
    if (licor?.yaCerrado) {
      return {
        ok: false,
        error: `Esta ${licor.tipo} de licor (${licor.descripcion}) ya entró a un cierre de licores. Deshaz ese cierre antes de borrarla.`,
      };
    }

    const now = new Date();
    await prisma.$transaction(async (tx) => {
      await tx.movement.update({ where: { id: movement.id }, data: { deletedAt: now } });

      // Arrastra la venta/compra de cerveza para que el inventario se reajuste.
      await borrarLicorLigadoAMovement(tx, movement.id, user.id);

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

    // Para OTRO no hay dirección fija: se conserva la que ya tenía el movimiento.
    const direction = resolveDirection(newType, movement.direction);

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
            pettyCashBucket: "COMISION",
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

// Asignar/quitar el bolsillo de un movimiento (solo admin). Permite marcar gastos/facturas
// como pagados desde un bolsillo, y también etiquetar entradas manuales (ej. un "Otro"
// reclasificado) como ingreso de Licores/Fuxion/Base.
export async function setPettyCashBucket(
  id: string,
  bucket: PocketBucket | null
): Promise<ActionResult> {
  try {
    const user = await requireSession();
    if (user.role !== "ADMIN")
      return { ok: false, error: "Solo el administrador puede asignar bolsillos" };

    const movement = await prisma.movement.findUnique({ where: { id } });
    if (!movement || movement.deletedAt) return { ok: false, error: "Movimiento no encontrado" };
    if (movement.isSystemGenerated)
      return { ok: false, error: "El 4x1000 automático siempre se paga desde Comisiones" };
    if (movement.pettyCashBucket === bucket) return { ok: true };

    await prisma.$transaction([
      prisma.movement.update({ where: { id }, data: { pettyCashBucket: bucket } }),
      prisma.auditLog.create({
        data: {
          movementId: id,
          businessDayId: movement.businessDayId,
          action: "POCKET",
          changedById: user.id,
          fieldChanges: JSON.stringify({
            bolsillo: { before: movement.pettyCashBucket, after: bucket },
          }),
        },
      }),
    ]);

    revalidateAll();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado" };
  }
}

const transferSchema = z
  .object({
    fromBucket: z.enum(TRANSFER_BUCKETS),
    toBucket: z.enum(TRANSFER_BUCKETS),
    amount: z.number().int("El monto debe ser un número entero").positive("El monto debe ser mayor a cero"),
  })
  .refine((d) => d.fromBucket !== d.toBucket, { message: "Elige dos bolsillos distintos" });

// Transferir dinero entre bolsillos (o desde/hacia el Disponible). Es una reclasificación
// interna: no crea un movimiento real ni afecta el cuadre de Nequi. Solo admin. Comisiones
// no participa — nunca aparece como origen ni destino.
export async function transferPocketFunds(
  fromBucket: TransferBucket,
  toBucket: TransferBucket,
  amount: number
): Promise<ActionResult> {
  try {
    const user = await requireSession();
    if (user.role !== "ADMIN")
      return { ok: false, error: "Solo el administrador puede transferir entre bolsillos" };

    const data = transferSchema.parse({ fromBucket, toBucket, amount });

    const [pockets, { saldoEsperado }, baseFund] = await Promise.all([
      getPockets(),
      getDaySummary(),
      getBaseFund(),
    ]);

    const disponibleOrigen =
      data.fromBucket === "DISPONIBLE"
        ? calcularDisponible(
            saldoEsperado ?? 0,
            calcularApartadoEnBolsillos(pockets).totalApartado,
            baseFund.nequiPortion
          )
        : pockets[data.fromBucket].disponible;

    if (data.amount > disponibleOrigen) {
      return {
        ok: false,
        error: `No hay suficiente en ${TRANSFER_BUCKET_LABELS[data.fromBucket]} (disponible: $${disponibleOrigen.toLocaleString("es-CO")})`,
      };
    }

    await prisma.$transaction(async (tx) => {
      await tx.pocketTransfer.create({
        data: {
          fromBucket: data.fromBucket,
          toBucket: data.toBucket,
          amount: data.amount,
          createdById: user.id,
        },
      });
      await tx.auditLog.create({
        data: {
          action: "TRANSFER_POCKETS",
          changedById: user.id,
          fieldChanges: JSON.stringify({
            transferencia: {
              before: TRANSFER_BUCKET_LABELS[data.fromBucket],
              after: `${TRANSFER_BUCKET_LABELS[data.toBucket]}: $${data.amount.toLocaleString("es-CO")}`,
            },
          }),
        },
      });
    });

    revalidateAll();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado" };
  }
}
