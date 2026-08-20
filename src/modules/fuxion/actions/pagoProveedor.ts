"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { todayBogota } from "@/lib/dates";
import { requireAdmin } from "@/lib/permissions";
import { getCurrentShift } from "@/modules/nequi/queries";
import {
  borrarMovementLigado,
  crearMovementLigado,
  resolverTurnoAbierto,
  turnoDelMovementAbierto,
} from "../server/movementLink";
import { FUXION_MEDIOS_PAGO_PROVEEDOR, type ActionResult } from "../types";

// ---------------------------------------------------------------------------
// Pago al proveedor de una bolsa que se llevó a CRÉDITO.
// Decisión del dueño (2026-08-20): la bolsa se paga COMPLETA, de una sola vez, cuando se
// termina de vender. Por eso no hay abonos parciales: se "marca pagada" y listo.
// El pago SÍ saca plata de la caja, así que crea su gasto ligado en el cuadre Nequi.
// ---------------------------------------------------------------------------

const pagoSchema = z.object({
  compraId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida"),
  metodoPago: z.enum(FUXION_MEDIOS_PAGO_PROVEEDOR), // EFECTIVO | NEQUI
  // ¿Sale del bolsillo "Fuxion"? Igual que en las compras: el bolsillo acumula plata de
  // Nequi, así que un pago en efectivo no lo descuenta.
  descontarDelBolsillo: z.boolean().default(true),
});

export type PagoProveedorInput = z.input<typeof pagoSchema>;

function revalidateAll() {
  revalidatePath("/", "layout");
}

// Marca una bolsa como pagada al proveedor y registra la salida de plata.
export async function marcarCompraPagada(input: PagoProveedorInput): Promise<ActionResult> {
  try {
    const user = await requireAdmin();
    const data = pagoSchema.parse(input);

    if (data.date > todayBogota()) return { ok: false, error: "No se puede registrar en el futuro" };

    const compra = await prisma.fuxionCompra.findUnique({
      where: { id: data.compraId },
      include: { producto: { select: { nombre: true } } },
    });
    if (!compra || compra.deletedAt) return { ok: false, error: "Compra no encontrada" };
    if (compra.metodoPago !== "CREDITO") {
      return { ok: false, error: "Esa compra no quedó a crédito: ya se había pagado al comprarla." };
    }
    if (compra.pagadaAt) return { ok: false, error: "Esa bolsa ya está marcada como pagada." };

    const turno = await resolverTurnoAbierto(data.date, await getCurrentShift());
    if (!turno.ok) return turno;

    await prisma.$transaction(async (tx) => {
      const pagoMovementId = await crearMovementLigado(tx, {
        businessDayId: turno.businessDayId,
        type: "GASTO_FARMACIA",
        direction: "EXPENSE",
        amount: compra.valorTotal,
        paymentMethod: data.metodoPago,
        pettyCashBucket:
          data.descontarDelBolsillo && data.metodoPago === "NEQUI" ? "FUXION" : null,
        note: `Pago proveedor Fuxion — ${compra.cantidad} × ${compra.producto.nombre}${compra.proveedor ? ` (${compra.proveedor})` : ""}`,
        userId: user.id,
      });

      await tx.fuxionCompra.update({
        where: { id: compra.id },
        data: { pagadaAt: data.date, pagoMetodoPago: data.metodoPago, pagoMovementId },
      });

      await tx.auditLog.create({
        data: {
          action: "FUXION_PAGO_PROVEEDOR_CREATE",
          changedById: user.id,
          fieldChanges: JSON.stringify({
            pago: {
              before: null,
              after: `${compra.cantidad} × ${compra.producto.nombre} por $${compra.valorTotal.toLocaleString("es-CO")}`,
            },
            medioPago: { before: null, after: data.metodoPago },
            compraId: { before: null, after: compra.id },
          }),
        },
      });
    });

    revalidateAll();
    return { ok: true };
  } catch (e) {
    if (e instanceof z.ZodError) return { ok: false, error: e.issues[0]?.message ?? "Datos inválidos" };
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado" };
  }
}

// Deshace el pago: la bolsa vuelve a quedar debiéndose y se borra la salida de plata.
export async function deshacerPagoCompra(compraId: string): Promise<ActionResult> {
  try {
    const user = await requireAdmin();

    const compra = await prisma.fuxionCompra.findUnique({
      where: { id: compraId },
      include: { producto: { select: { nombre: true } } },
    });
    if (!compra || compra.deletedAt) return { ok: false, error: "Compra no encontrada" };
    if (!compra.pagadaAt) return { ok: false, error: "Esa bolsa no está marcada como pagada." };
    if (compra.fuxionCierreId) {
      return {
        ok: false,
        error: "Esa compra ya entró en un cierre de Fuxion. Deshaz el cierre primero.",
      };
    }

    if (!(await turnoDelMovementAbierto(compra.pagoMovementId))) {
      return {
        ok: false,
        error: "El turno donde se registró el pago en Nequi está cerrado. Reábrelo primero.",
      };
    }

    await prisma.$transaction(async (tx) => {
      await borrarMovementLigado(tx, compra.pagoMovementId, user.id);
      await tx.fuxionCompra.update({
        where: { id: compraId },
        data: { pagadaAt: null, pagoMetodoPago: null, pagoMovementId: null },
      });
      await tx.auditLog.create({
        data: {
          action: "FUXION_PAGO_PROVEEDOR_DELETE",
          changedById: user.id,
          fieldChanges: JSON.stringify({
            pago: {
              before: `${compra.cantidad} × ${compra.producto.nombre} por $${compra.valorTotal.toLocaleString("es-CO")} (pagado el ${compra.pagadaAt})`,
              after: null,
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
