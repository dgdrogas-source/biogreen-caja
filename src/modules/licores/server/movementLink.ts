import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  aplica4x1000,
  calcularImpuesto4x1000,
} from "@/modules/nequi/calculations/impuesto4x1000";
import { getOrCreateDay } from "@/modules/nequi/server/businessDay";
import type { Shift } from "@/modules/nequi/types";

// ---------------------------------------------------------------------------
// Puente Licores ↔ Nequi. ÚNICA regla que importa (pedido explícito del dueño, 2026-07-19):
// una compra/venta de cerveza pagada en NEQUI o EFECTIVO ya movió plata de la caja, así que
// el módulo crea AQUÍ su Movement — el dueño NO debe registrarlo otra vez a mano, o la
// misma plata se contaría dos veces. Los demás medios (tarjeta, Daviplata, transferencia,
// crédito) no pasan por la caja Nequi y por eso no generan nada.
//
// El vínculo es una columna suelta `movementId` (sin relación Prisma): el módulo Nequi se
// mantiene sin tocar, y Movement usa soft-delete, así que no hay FK que mantener.
// ---------------------------------------------------------------------------

// Verifica que el turno destino exista y esté abierto ANTES de tocar nada. Devuelve el
// businessDayId, o un mensaje de error para mostrarle a quien registra.
export async function resolverTurnoAbierto(
  date: string,
  shift: Shift
): Promise<{ ok: true; businessDayId: string } | { ok: false; error: string }> {
  const day = await getOrCreateDay(date, shift);
  if (day.status === "CLOSED") {
    return {
      ok: false,
      error: `El turno ${shift} del ${date} ya está cerrado. Pide al administrador que lo reabra.`,
    };
  }
  return { ok: true, businessDayId: day.id };
}

export interface MovementLigadoInput {
  businessDayId: string;
  type: "VENTA_LICORES_JHOANN" | "GASTO_FARMACIA";
  direction: "INCOME" | "EXPENSE";
  amount: number;
  paymentMethod: "NEQUI" | "EFECTIVO";
  pettyCashBucket: string | null;
  note: string;
  userId: string;
}

// Crea el Movement ligado (+ su 4x1000 automático si aplica) dentro de la transacción que
// ya está guardando la compra/venta. Devuelve el id para guardarlo en `movementId`.
export async function crearMovementLigado(
  tx: Prisma.TransactionClient,
  input: MovementLigadoInput
): Promise<string> {
  const movement = await tx.movement.create({
    data: {
      businessDayId: input.businessDayId,
      type: input.type,
      direction: input.direction,
      amount: input.amount,
      paymentMethod: input.paymentMethod,
      note: input.note,
      registeredById: input.userId,
      pettyCashBucket: input.pettyCashBucket,
    },
  });

  await tx.auditLog.create({
    data: {
      movementId: movement.id,
      businessDayId: input.businessDayId,
      action: "CREATE",
      changedById: input.userId,
      fieldChanges: JSON.stringify({
        origen: { before: null, after: "Módulo Licores (registro único)" },
      }),
    },
  });

  // 4x1000: solo lo dispara la plata que SALE por Nequi (una compra pagada por Nequi).
  if (aplica4x1000(input.type, input.paymentMethod)) {
    await tx.movement.create({
      data: {
        businessDayId: input.businessDayId,
        type: "IMPUESTO_4X1000",
        direction: "EXPENSE",
        amount: calcularImpuesto4x1000(input.amount),
        paymentMethod: "NEQUI",
        registeredById: input.userId,
        isSystemGenerated: true,
        sourceMovementId: movement.id,
        pettyCashBucket: "COMISION",
      },
    });
  }

  return movement.id;
}

// Borra (soft) el Movement ligado y su 4x1000 hijo. Se llama al eliminar o al editar una
// compra/venta: sin esto, el cuadre Nequi conservaría plata de un registro que ya no existe.
export async function borrarMovementLigado(
  tx: Prisma.TransactionClient,
  movementId: string | null,
  userId: string
): Promise<void> {
  if (!movementId) return;
  const movement = await tx.movement.findUnique({ where: { id: movementId } });
  if (!movement || movement.deletedAt) return;

  const now = new Date();
  await tx.movement.update({ where: { id: movementId }, data: { deletedAt: now } });
  await tx.movement.updateMany({
    where: { sourceMovementId: movementId, type: "IMPUESTO_4X1000", deletedAt: null },
    data: { deletedAt: now },
  });
  await tx.auditLog.create({
    data: {
      movementId,
      businessDayId: movement.businessDayId,
      action: "DELETE",
      changedById: userId,
      fieldChanges: JSON.stringify({
        origen: { before: "Módulo Licores", after: null },
        monto: { before: movement.amount, after: null },
      }),
    },
  });
}

// ---------------------------------------------------------------------------
// Dirección INVERSA del puente: Nequi → Licores.
// Cuando la vendedora borra un movimiento desde "Mis movimientos de hoy" (o el admin desde
// el Historial), ese movimiento puede ser el que creó una venta/compra de cerveza. Si solo
// se borrara el Movement, la venta seguiría viva en Licores y el inventario NUNCA se
// reajustaría (bug reportado por el dueño el 2026-07-19). Estas dos funciones cierran ese
// hueco desde `actions/movements.ts` del módulo Nequi.
// ---------------------------------------------------------------------------

export interface LicorLigado {
  tipo: "venta" | "compra";
  descripcion: string;
  yaCerrado: boolean; // pertenece a un cierre de licores ya hecho
}

// ¿Este Movement lo creó el módulo Licores? null si es un movimiento normal de Nequi.
export async function licorLigadoAMovement(movementId: string): Promise<LicorLigado | null> {
  const [venta, compra] = await Promise.all([
    prisma.licorVenta.findFirst({
      where: { movementId, deletedAt: null },
      include: { producto: { select: { nombre: true } } },
    }),
    prisma.licorCompra.findFirst({
      where: { movementId, deletedAt: null },
      include: { producto: { select: { nombre: true } } },
    }),
  ]);

  if (venta)
    return {
      tipo: "venta",
      descripcion: `${venta.cantidad} × ${venta.producto.nombre}`,
      yaCerrado: venta.licorCierreId !== null,
    };
  if (compra)
    return {
      tipo: "compra",
      descripcion: `${compra.cantidad} × ${compra.producto.nombre}`,
      yaCerrado: compra.licorCierreId !== null,
    };
  return null;
}

// Borra (soft) la venta/compra de licor ligada al Movement que se está borrando, para que el
// inventario vuelva a su sitio. Se llama DENTRO de la transacción de `deleteMovement`.
export async function borrarLicorLigadoAMovement(
  tx: Prisma.TransactionClient,
  movementId: string,
  userId: string
): Promise<void> {
  const now = new Date();

  const venta = await tx.licorVenta.findFirst({
    where: { movementId, deletedAt: null },
    include: { producto: { select: { nombre: true } } },
  });
  if (venta) {
    await tx.licorVenta.update({ where: { id: venta.id }, data: { deletedAt: now } });
    await tx.auditLog.create({
      data: {
        action: "LICOR_VENTA_DELETE",
        changedById: userId,
        fieldChanges: JSON.stringify({
          venta: { before: `${venta.cantidad} × ${venta.producto.nombre}`, after: null },
          origen: { before: "Se borró el movimiento en Nequi", after: null },
        }),
      },
    });
    return;
  }

  const compra = await tx.licorCompra.findFirst({
    where: { movementId, deletedAt: null },
    include: { producto: { select: { nombre: true } } },
  });
  if (compra) {
    await tx.licorCompra.update({ where: { id: compra.id }, data: { deletedAt: now } });
    await tx.auditLog.create({
      data: {
        action: "LICOR_COMPRA_DELETE",
        changedById: userId,
        fieldChanges: JSON.stringify({
          compra: { before: `${compra.cantidad} × ${compra.producto.nombre}`, after: null },
          origen: { before: "Se borró el movimiento en Nequi", after: null },
        }),
      },
    });
  }
}

// ¿El turno del Movement ligado sigue abierto? Editar/borrar un registro cuyo turno ya cerró
// dejaría el cuadre de ese turno descuadrado, así que se bloquea (misma regla que Nequi).
export async function turnoDelMovementAbierto(movementId: string | null): Promise<boolean> {
  if (!movementId) return true;
  const movement = await prisma.movement.findUnique({
    where: { id: movementId },
    include: { businessDay: { select: { status: true } } },
  });
  return !movement || movement.businessDay.status !== "CLOSED";
}
