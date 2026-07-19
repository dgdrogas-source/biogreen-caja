"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { todayBogota } from "@/lib/dates";
import { requireAdmin } from "@/lib/permissions";
import { calcularDiferencia, calcularTotalesCierre } from "../calculations/cierre";
import type { ActionResult } from "../types";

function revalidateAll() {
  revalidatePath("/", "layout");
}

const cierreSchema = z.object({
  efectivoContado: z.number().int().nonnegative("El efectivo contado no puede ser negativo"),
  nota: z.string().trim().max(300).optional(),
});

// Hacer un corte de licores. Es ESPORÁDICO: se lleva TODO lo que aún no se había cerrado
// (ventas, compras y abonos con licorCierreId = null) y lo marca con el id de este cierre,
// de modo que el siguiente corte no lo vuelva a contar.
//
// Se calcula dentro de la transacción, sobre las mismas filas que se van a marcar, para que
// una venta registrada a mitad del proceso no quede contada sin marcar (o al revés).
export async function crearCierreLicor(input: {
  efectivoContado: number;
  nota?: string;
}): Promise<ActionResult> {
  try {
    const user = await requireAdmin();
    const data = cierreSchema.parse(input);
    const date = todayBogota();

    const resultado = await prisma.$transaction(async (tx) => {
      const pendiente = { licorCierreId: null, deletedAt: null } as const;

      const [ventas, compras, abonos] = await Promise.all([
        tx.licorVenta.findMany({
          where: pendiente,
          select: { id: true, precioUnitario: true, cantidad: true, metodoPago: true },
        }),
        tx.licorCompra.findMany({
          where: pendiente,
          select: { id: true, valorTotal: true, metodoPago: true },
        }),
        tx.licorAbono.findMany({
          where: pendiente,
          select: { id: true, monto: true, medioPago: true },
        }),
      ]);

      if (ventas.length + compras.length + abonos.length === 0) {
        return { vacio: true as const };
      }

      const t = calcularTotalesCierre(ventas, compras, abonos);
      const { diferencia } = calcularDiferencia(t.efectivoEsperado, data.efectivoContado);

      const cierre = await tx.licorCierre.create({
        data: {
          date,
          ventasEfectivo: t.ventasEfectivo,
          ventasPlataforma: t.ventasPlataforma,
          ventasCredito: t.ventasCredito,
          abonosEfectivo: t.abonosEfectivo,
          abonosPlataforma: t.abonosPlataforma,
          comprasEfectivo: t.comprasEfectivo,
          comprasPlataforma: t.comprasPlataforma,
          efectivoEsperado: t.efectivoEsperado,
          efectivoContado: data.efectivoContado,
          diferencia,
          nota: data.nota || null,
          createdById: user.id,
        },
      });

      // Marcar exactamente las filas que se contaron (por id, no por filtro: si entró algo
      // nuevo mientras tanto, queda para el próximo corte).
      await Promise.all([
        tx.licorVenta.updateMany({
          where: { id: { in: ventas.map((v) => v.id) } },
          data: { licorCierreId: cierre.id },
        }),
        tx.licorCompra.updateMany({
          where: { id: { in: compras.map((c) => c.id) } },
          data: { licorCierreId: cierre.id },
        }),
        tx.licorAbono.updateMany({
          where: { id: { in: abonos.map((a) => a.id) } },
          data: { licorCierreId: cierre.id },
        }),
      ]);

      await tx.auditLog.create({
        data: {
          action: "LICOR_CIERRE_CREATE",
          changedById: user.id,
          fieldChanges: JSON.stringify({
            efectivoEsperado: { before: null, after: t.efectivoEsperado },
            efectivoContado: { before: null, after: data.efectivoContado },
            diferencia: { before: null, after: diferencia },
            movimientos: {
              before: null,
              after: `${ventas.length} ventas, ${compras.length} compras, ${abonos.length} abonos`,
            },
          }),
        },
      });

      return { vacio: false as const };
    });

    if (resultado.vacio) {
      return { ok: false, error: "No hay nada pendiente por cerrar desde el último corte." };
    }

    revalidateAll();
    return { ok: true };
  } catch (e) {
    if (e instanceof z.ZodError) return { ok: false, error: e.issues[0]?.message ?? "Datos inválidos" };
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado" };
  }
}

// Deshacer un corte: sus ventas/compras/abonos vuelven a quedar pendientes para el próximo.
// Solo se permite sobre el ÚLTIMO cierre — deshacer uno viejo mezclaría sus movimientos con
// los de los cortes posteriores y los números dejarían de significar nada.
export async function eliminarCierreLicor(id: string): Promise<ActionResult> {
  try {
    const user = await requireAdmin();

    const [cierre, ultimo] = await Promise.all([
      prisma.licorCierre.findUnique({ where: { id } }),
      prisma.licorCierre.findFirst({ orderBy: [{ date: "desc" }, { createdAt: "desc" }] }),
    ]);
    if (!cierre) return { ok: false, error: "Cierre no encontrado" };
    if (!ultimo || ultimo.id !== cierre.id) {
      return { ok: false, error: "Solo se puede deshacer el último cierre de licores." };
    }

    await prisma.$transaction(async (tx) => {
      // Al soltar la marca, esos movimientos vuelven a la bolsa de "pendiente por cerrar".
      await Promise.all([
        tx.licorVenta.updateMany({ where: { licorCierreId: id }, data: { licorCierreId: null } }),
        tx.licorCompra.updateMany({ where: { licorCierreId: id }, data: { licorCierreId: null } }),
        tx.licorAbono.updateMany({ where: { licorCierreId: id }, data: { licorCierreId: null } }),
      ]);
      await tx.licorCierre.delete({ where: { id } });
      await tx.auditLog.create({
        data: {
          action: "LICOR_CIERRE_DELETE",
          changedById: user.id,
          fieldChanges: JSON.stringify({
            cierre: {
              before: `${cierre.date} · esperado $${cierre.efectivoEsperado.toLocaleString("es-CO")} · contado $${cierre.efectivoContado.toLocaleString("es-CO")}`,
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
