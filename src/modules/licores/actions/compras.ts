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
import { LICOR_MEDIOS_PAGO_COMPRA, type ActionResult } from "../types";

const compraSchema = z.object({
  productoId: z.string().min(1, "Elige la cerveza"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida"),
  cantidad: z.number().int().positive("La cantidad debe ser mayor a cero"),
  valorTotal: z.number().int().positive("El valor pagado debe ser mayor a cero"),
  proveedor: z.string().trim().max(80).optional(),
  descripcion: z.string().trim().max(300).optional(),
  metodoPago: z.enum(LICOR_MEDIOS_PAGO_COMPRA), // solo EFECTIVO | NEQUI
  // ¿El gasto sale del bolsillo "Licores Jhoann"? Solo aplica pagando por NEQUI: el bolsillo
  // es un acumulado sobre la plata de Nequi, así que una compra pagada en efectivo no debe
  // descontarlo (aclaración del dueño, 2026-07-19).
  descontarDelBolsillo: z.boolean().default(true),
});

export type CompraLicorInput = z.input<typeof compraSchema>;

function revalidateAll() {
  revalidatePath("/", "layout");
}

// Registra una compra al proveedor (solo admin). Como solo se paga en efectivo o por Nequi,
// TODA compra crea ADEMÁS su gasto en el cuadre Nequi — una sola vez, ligado a esta compra.
export async function registrarCompraLicor(input: CompraLicorInput): Promise<ActionResult> {
  try {
    const user = await requireAdmin();
    const data = compraSchema.parse(input);

    if (data.date > todayBogota()) return { ok: false, error: "No se puede registrar en el futuro" };

    const producto = await prisma.licorProducto.findUnique({ where: { id: data.productoId } });
    if (!producto) return { ok: false, error: "Cerveza no encontrada" };

    // Toda compra mueve plata real, así que el turno destino debe estar abierto ANTES de
    // guardar nada (si no, el gasto no podría entrar al cuadre y quedaría descuadrado).
    const turno = await resolverTurnoAbierto(data.date, await getCurrentShift());
    if (!turno.ok) return turno;

    await prisma.$transaction(async (tx) => {
      const movementId = await crearMovementLigado(tx, {
        businessDayId: turno.businessDayId,
        type: "GASTO_FARMACIA",
        direction: "EXPENSE",
        amount: data.valorTotal,
        paymentMethod: data.metodoPago,
        pettyCashBucket:
          data.descontarDelBolsillo && data.metodoPago === "NEQUI" ? "LICORES_JHOANN" : null,
        note: `Compra ${data.cantidad} × ${producto.nombre}${data.proveedor ? ` — ${data.proveedor}` : ""}`,
        userId: user.id,
      });

      const compra = await tx.licorCompra.create({
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
          action: "LICOR_COMPRA_CREATE",
          changedById: user.id,
          fieldChanges: JSON.stringify({
            compra: {
              before: null,
              after: `${data.cantidad} × ${producto.nombre} por $${data.valorTotal.toLocaleString("es-CO")}`,
            },
            medioPago: { before: null, after: data.metodoPago },
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
export async function eliminarCompraLicor(id: string): Promise<ActionResult> {
  try {
    const user = await requireAdmin();

    const compra = await prisma.licorCompra.findUnique({
      where: { id },
      include: { producto: { select: { nombre: true } } },
    });
    if (!compra || compra.deletedAt) return { ok: false, error: "Compra no encontrada" };
    if (compra.licorCierreId)
      return {
        ok: false,
        error: "Esa compra ya entró en un cierre de licores. Deshaz el cierre para poder borrarla.",
      };

    if (!(await turnoDelMovementAbierto(compra.movementId))) {
      return {
        ok: false,
        error: "El turno donde se registró el gasto en Nequi está cerrado. Reábrelo primero.",
      };
    }

    await prisma.$transaction(async (tx) => {
      await tx.licorCompra.update({ where: { id }, data: { deletedAt: new Date() } });
      await borrarMovementLigado(tx, compra.movementId, user.id);
      await tx.auditLog.create({
        data: {
          action: "LICOR_COMPRA_DELETE",
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
