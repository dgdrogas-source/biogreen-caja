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
import { FUXION_MEDIOS_PAGO_COMPRA, type ActionResult } from "../types";

const compraSchema = z.object({
  productoId: z.string().min(1, "Elige el producto"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida"),
  cantidad: z.number().int().positive("La cantidad debe ser mayor a cero"),
  // Lo que se le paga al proveedor por TODA la bolsa. Se DIGITA (decisión del dueño,
  // 2026-08-20): puede subir con el tiempo, así que nunca es una constante.
  valorTotal: z.number().int().positive("El valor pagado debe ser mayor a cero"),
  proveedor: z.string().trim().max(80).optional(),
  descripcion: z.string().trim().max(300).optional(),
  metodoPago: z.enum(FUXION_MEDIOS_PAGO_COMPRA), // EFECTIVO | NEQUI | CREDITO
  // ¿El gasto sale del bolsillo "Fuxion"? Solo aplica pagando por NEQUI: el bolsillo es un
  // acumulado sobre plata de Nequi (mismo criterio que el módulo Licores).
  descontarDelBolsillo: z.boolean().default(true),
});

export type CompraFuxionInput = z.input<typeof compraSchema>;

function revalidateAll() {
  revalidatePath("/", "layout");
}

// Registra una compra al proveedor (solo admin).
// - EFECTIVO / NEQUI: la plata sale YA, así que crea su gasto ligado en el cuadre Nequi.
// - CREDITO: no sale plata todavía. No se crea Movement; queda como deuda y el gasto se
//   registra después, al marcar la bolsa como pagada (ver actions/pagoProveedor.ts).
export async function registrarCompraFuxion(input: CompraFuxionInput): Promise<ActionResult> {
  try {
    const user = await requireAdmin();
    const data = compraSchema.parse(input);

    if (data.date > todayBogota()) return { ok: false, error: "No se puede registrar en el futuro" };

    const producto = await prisma.fuxionProducto.findUnique({ where: { id: data.productoId } });
    if (!producto) return { ok: false, error: "Producto no encontrado" };

    const esCredito = data.metodoPago === "CREDITO";

    // Solo si la plata sale ya hay que exigir turno abierto: sin turno, el gasto no podría
    // entrar al cuadre y ese turno quedaría descuadrado.
    let businessDayId: string | null = null;
    if (!esCredito) {
      const turno = await resolverTurnoAbierto(data.date, await getCurrentShift());
      if (!turno.ok) return turno;
      businessDayId = turno.businessDayId;
    }

    await prisma.$transaction(async (tx) => {
      const movementId = businessDayId
        ? await crearMovementLigado(tx, {
            businessDayId,
            type: "GASTO_FARMACIA",
            direction: "EXPENSE",
            amount: data.valorTotal,
            paymentMethod: data.metodoPago as "NEQUI" | "EFECTIVO",
            pettyCashBucket:
              data.descontarDelBolsillo && data.metodoPago === "NEQUI" ? "FUXION" : null,
            note: `Compra ${data.cantidad} × ${producto.nombre}${data.proveedor ? ` — ${data.proveedor}` : ""}`,
            userId: user.id,
          })
        : null;

      const compra = await tx.fuxionCompra.create({
        data: {
          productoId: data.productoId,
          date: data.date,
          cantidad: data.cantidad,
          valorTotal: data.valorTotal,
          proveedor: data.proveedor || null,
          descripcion: data.descripcion || null,
          metodoPago: data.metodoPago,
          movementId,
          createdById: user.id,
        },
      });

      await tx.auditLog.create({
        data: {
          action: "FUXION_COMPRA_CREATE",
          changedById: user.id,
          fieldChanges: JSON.stringify({
            compra: {
              before: null,
              after: `${data.cantidad} × ${producto.nombre} por $${data.valorTotal.toLocaleString("es-CO")}`,
            },
            medioPago: { before: null, after: data.metodoPago },
            quedaDebiendo: { before: null, after: esCredito ? "sí" : "no" },
            ligadoACuadreNequi: { before: null, after: movementId ? "sí" : "no" },
            id: { before: null, after: compra.id },
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

// Borra una compra (solo admin, cualquier día) y su gasto ligado en el cuadre Nequi.
// Si la bolsa ya se había pagado al proveedor, primero hay que deshacer ese pago: borrarla
// de una dejaría vivo el Movement del pago, apuntando a una compra que ya no existe.
export async function eliminarCompraFuxion(id: string): Promise<ActionResult> {
  try {
    const user = await requireAdmin();

    const compra = await prisma.fuxionCompra.findUnique({
      where: { id },
      include: { producto: { select: { nombre: true } } },
    });
    if (!compra || compra.deletedAt) return { ok: false, error: "Compra no encontrada" };
    if (compra.fuxionCierreId)
      return {
        ok: false,
        error: "Esa compra ya entró en un cierre de Fuxion. Deshaz el cierre para poder borrarla.",
      };
    if (compra.pagadaAt) {
      return {
        ok: false,
        error: "Esta bolsa ya se le pagó al proveedor. Deshaz el pago antes de borrar la compra.",
      };
    }

    if (!(await turnoDelMovementAbierto(compra.movementId))) {
      return {
        ok: false,
        error: "El turno donde se registró el gasto en Nequi está cerrado. Reábrelo primero.",
      };
    }

    await prisma.$transaction(async (tx) => {
      await tx.fuxionCompra.update({ where: { id }, data: { deletedAt: new Date() } });
      await borrarMovementLigado(tx, compra.movementId, user.id);
      await tx.auditLog.create({
        data: {
          action: "FUXION_COMPRA_DELETE",
          changedById: user.id,
          fieldChanges: JSON.stringify({
            compra: {
              before: `${compra.cantidad} × ${compra.producto.nombre} por $${compra.valorTotal.toLocaleString("es-CO")}`,
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
