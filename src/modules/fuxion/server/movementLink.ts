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
// Puente Fuxion <-> Nequi. Copia del de Licores, misma regla dura: una venta/compra pagada
// en NEQUI o EFECTIVO ya movió plata de la caja, así que el módulo crea AQUÍ su Movement —
// la vendedora NO debe registrarlo otra vez a mano, o la misma plata se contaría dos veces.
// Los demás medios (tarjeta, Daviplata, transferencia, crédito) no pasan por la caja Nequi
// y por eso no generan nada.
//
// Diferencia con Licores: aquí una COMPRA puede ser a CRÉDITO. En ese caso no se crea nada
// al comprar; el Movement de salida se crea después, cuando se le paga la bolsa al proveedor.
//
// El vínculo es una columna suelta `movementId` (sin relación Prisma): el módulo Nequi se
// mantiene sin tocar, y Movement usa soft-delete, así que no hay FK que mantener.
// ---------------------------------------------------------------------------

// Verifica que el turno destino exista y esté abierto ANTES de tocar nada.
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
  type: "VENTA_FUXION" | "GASTO_FARMACIA";
  direction: "INCOME" | "EXPENSE";
  amount: number;
  paymentMethod: "NEQUI" | "EFECTIVO";
  pettyCashBucket: string | null;
  note: string;
  userId: string;
}

// Crea el Movement ligado (+ su 4x1000 automático si aplica) dentro de la transacción que ya
// está guardando la compra/venta. Devuelve el id para guardarlo en `movementId`.
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
        origen: { before: null, after: "Módulo Fuxion (registro único)" },
      }),
    },
  });

  // 4x1000: solo lo dispara la plata que SALE por Nequi (una compra o un pago por Nequi).
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

// Borra (soft) el Movement ligado y su 4x1000 hijo. Sin esto, el cuadre Nequi conservaría
// plata de un registro que ya no existe.
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
        origen: { before: "Módulo Fuxion", after: null },
        monto: { before: movement.amount, after: null },
      }),
    },
  });
}

// ---------------------------------------------------------------------------
// Dirección INVERSA del puente: Nequi -> Fuxion.
// Cuando la vendedora borra un movimiento desde "Mis movimientos de hoy" (o el admin desde
// el Historial), ese movimiento puede ser el que creó una venta/compra de Fuxion. Si solo se
// borrara el Movement, la venta seguiría viva y el inventario NUNCA se reajustaría (es el
// mismo bug que el dueño reportó en Licores el 2026-07-19).
// ---------------------------------------------------------------------------

export interface FuxionLigado {
  tipo: "venta" | "compra" | "pago";
  descripcion: string;
  yaCerrado: boolean; // pertenece a un cierre de Fuxion ya hecho
}

// ¿Este Movement lo creó el módulo Fuxion? null si es un movimiento normal de Nequi.
export async function fuxionLigadoAMovement(movementId: string): Promise<FuxionLigado | null> {
  const [venta, compra, pago] = await Promise.all([
    prisma.fuxionVenta.findFirst({
      where: { movementId, deletedAt: null },
      include: { producto: { select: { nombre: true } } },
    }),
    prisma.fuxionCompra.findFirst({
      where: { movementId, deletedAt: null },
      include: { producto: { select: { nombre: true } } },
    }),
    prisma.fuxionCompra.findFirst({
      where: { pagoMovementId: movementId, deletedAt: null },
      include: { producto: { select: { nombre: true } } },
    }),
  ]);

  if (venta)
    return {
      tipo: "venta",
      descripcion: `${venta.cantidad} × ${venta.producto.nombre}`,
      yaCerrado: venta.fuxionCierreId !== null,
    };
  if (compra)
    return {
      tipo: "compra",
      descripcion: `${compra.cantidad} × ${compra.producto.nombre}`,
      yaCerrado: compra.fuxionCierreId !== null,
    };
  // El pago al proveedor es un Movement aparte de la compra: borrarlo debe DESHACER el pago,
  // no borrar la compra (la bolsa sigue existiendo, solo vuelve a quedar debiéndose).
  if (pago)
    return {
      tipo: "pago",
      descripcion: `pago de ${pago.cantidad} × ${pago.producto.nombre}`,
      yaCerrado: pago.fuxionCierreId !== null,
    };
  return null;
}

// Deshace lo que el Movement había creado en Fuxion, para que el inventario y la deuda
// vuelvan a su sitio. Se llama DENTRO de la transacción de `deleteMovement`.
export async function borrarFuxionLigadoAMovement(
  tx: Prisma.TransactionClient,
  movementId: string,
  userId: string
): Promise<void> {
  const now = new Date();

  const venta = await tx.fuxionVenta.findFirst({
    where: { movementId, deletedAt: null },
    include: { producto: { select: { nombre: true } } },
  });
  if (venta) {
    await tx.fuxionVenta.update({ where: { id: venta.id }, data: { deletedAt: now } });
    await tx.auditLog.create({
      data: {
        action: "FUXION_VENTA_DELETE",
        changedById: userId,
        fieldChanges: JSON.stringify({
          venta: { before: `${venta.cantidad} × ${venta.producto.nombre}`, after: null },
          origen: { before: "Se borró el movimiento en Nequi", after: null },
        }),
      },
    });
    return;
  }

  const compra = await tx.fuxionCompra.findFirst({
    where: { movementId, deletedAt: null },
    include: { producto: { select: { nombre: true } } },
  });
  if (compra) {
    await tx.fuxionCompra.update({ where: { id: compra.id }, data: { deletedAt: now } });
    await tx.auditLog.create({
      data: {
        action: "FUXION_COMPRA_DELETE",
        changedById: userId,
        fieldChanges: JSON.stringify({
          compra: { before: `${compra.cantidad} × ${compra.producto.nombre}`, after: null },
          origen: { before: "Se borró el movimiento en Nequi", after: null },
        }),
      },
    });
    return;
  }

  // Borrar el Movement de un pago al proveedor = deshacer ese pago: la bolsa vuelve a quedar
  // debiéndose. La compra NO se toca.
  const pagada = await tx.fuxionCompra.findFirst({
    where: { pagoMovementId: movementId, deletedAt: null },
    include: { producto: { select: { nombre: true } } },
  });
  if (pagada) {
    await tx.fuxionCompra.update({
      where: { id: pagada.id },
      data: { pagadaAt: null, pagoMetodoPago: null, pagoMovementId: null },
    });
    await tx.auditLog.create({
      data: {
        action: "FUXION_PAGO_PROVEEDOR_DELETE",
        changedById: userId,
        fieldChanges: JSON.stringify({
          pago: {
            before: `${pagada.cantidad} × ${pagada.producto.nombre} por ${pagada.valorTotal}`,
            after: null,
          },
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
