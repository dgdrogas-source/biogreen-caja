"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { cuadreDelParte } from "../calculations/parteTurno";
import { requireAdminAction } from "../server/guards";
import type { ActionResult } from "../types";

// EL PUNTO DE CONTROL. Hasta aquí, nada de lo que registró la vendedora ha movido un peso ni
// afectado ninguna cuenta — el parte vive en sus propias tablas (ParteTurno/ParteTurnoGasto/
// ParteTurnoFactura). Aprobar solo LOCK-ea el parte (ya no se puede editar ni devolver) y dejar
// constancia en el AuditLog.
//
// Desde 2026-09-09 (retiro de Cierre General) aprobar NO vuelca nada a ningún otro lado: los
// gastos/facturas del turno YA son filas reales desde que la vendedora los agregó
// (agregarGastoParte/agregarFacturaParte, con assertEditable) — no hay nada que copiar. Cierre
// Diario lee directo de los ParteTurno del día (ver cierreDiario/queries → getVentasDelDia),
// no necesita que "aprobar" le escriba nada aparte.
//
// Sigue sin tocarse el módulo Nequi: no se crea ni un Movement.

export async function aprobarParteTurno(parteId: string): Promise<ActionResult> {
  try {
    const user = await requireAdminAction();

    await prisma.$transaction(async (tx) => {
      // El CANDADO va primero, y es un update CONDICIONAL: solo pasa a APROBADO si todavía
      // está en ENVIADO. Leer el estado y actualizarlo después no bastaría —entre las dos
      // consultas otra aprobación podría colarse (aislamiento read committed) y el parte se
      // aprobaría dos veces—. Con el update condicional, la segunda transacción espera al
      // commit de la primera, vuelve a evaluar el WHERE y no afecta ninguna fila.
      const marcado = await tx.parteTurno.updateMany({
        where: { id: parteId, estado: "ENVIADO" },
        data: { estado: "APROBADO", aprobadoById: user.id, aprobadoAt: new Date() },
      });
      if (marcado.count === 0) {
        throw new Error("Este parte ya no está pendiente de aprobar");
      }

      const parte = await tx.parteTurno.findUniqueOrThrow({
        where: { id: parteId },
        include: { gastoItems: true, facturaItems: true },
      });

      // El descuadre se calcula con la MISMA fórmula que ve la vendedora en su resumen
      // (función pura testeada), no se copia de un campo que hubiera podido teclear.
      const cuadre = cuadreDelParte(parte);

      await tx.auditLog.create({
        data: {
          businessDayId: parte.businessDayId,
          action: "PARTE_TURNO_APROBAR",
          changedById: user.id,
          fieldChanges: JSON.stringify({
            estado: { before: "ENVIADO", after: "APROBADO" },
            descuadre: { before: null, after: cuadre.descuadre },
          }),
        },
      });
    });

    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado" };
  }
}

// Reabre un parte ya ENVIADO o APROBADO y lo regresa a BORRADOR para corregir un error de
// digitación (un typo en un medio de pago, casi siempre). Solo el admin. Distinto de
// "devolver": no es para que la vendedora lo rehaga —puede ser un parte de hace días, con la
// vendedora fuera de turno— sino para que el admin corrija el dato desde
// /cierre/diario/partes/[id] y lo vuelva a mandar a aprobar. Limpia los sellos de envío y
// aprobación para que el ciclo BORRADOR→ENVIADO→APROBADO vuelva a empezar limpio.
export async function reabrirParteTurno(parteId: string): Promise<ActionResult> {
  try {
    const user = await requireAdminAction();

    const parte = await prisma.parteTurno.findUnique({ where: { id: parteId } });
    if (!parte) return { ok: false, error: "Parte no encontrado" };
    if (parte.estado === "BORRADOR") {
      return { ok: false, error: "Este parte ya está en borrador, se puede corregir directamente" };
    }

    await prisma.$transaction([
      prisma.parteTurno.update({
        where: { id: parteId },
        data: {
          estado: "BORRADOR",
          enviadoAt: null,
          aprobadoAt: null,
          aprobadoById: null,
          notaAdmin: "Reabierto para corregir. Ajusta el dato y vuélvelo a mandar a aprobar.",
        },
      }),
      prisma.auditLog.create({
        data: {
          businessDayId: parte.businessDayId,
          action: "PARTE_TURNO_REABRIR",
          changedById: user.id,
          fieldChanges: JSON.stringify({
            estado: { before: parte.estado, after: "BORRADOR" },
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

const devolverSchema = z.object({
  parteId: z.string().min(1),
  notaAdmin: z.string().max(300).optional(),
});

// Devuelve el parte a BORRADOR para que la vendedora lo corrija. Solo desde ENVIADO: un parte
// ya APROBADO es histórico de solo lectura — deshacer una aprobación sería corregir dos sitios
// a la vez y es justo donde se pierden los datos.
export async function devolverParteTurno(
  input: z.infer<typeof devolverSchema>
): Promise<ActionResult> {
  try {
    const user = await requireAdminAction();
    const d = devolverSchema.parse(input);

    const parte = await prisma.parteTurno.findUnique({ where: { id: d.parteId } });
    if (!parte) return { ok: false, error: "Parte no encontrado" };
    if (parte.estado !== "ENVIADO") {
      return {
        ok: false,
        error:
          parte.estado === "APROBADO"
            ? "Este parte ya fue aprobado y no se puede modificar."
            : "Este parte todavía está en borrador",
      };
    }

    await prisma.$transaction([
      prisma.parteTurno.update({
        where: { id: parte.id },
        data: { estado: "BORRADOR", enviadoAt: null, notaAdmin: d.notaAdmin ?? null },
      }),
      prisma.auditLog.create({
        data: {
          businessDayId: parte.businessDayId,
          action: "PARTE_TURNO_DEVOLVER",
          changedById: user.id,
          fieldChanges: JSON.stringify({
            estado: { before: "ENVIADO", after: "BORRADOR" },
            notaAdmin: { before: null, after: d.notaAdmin ?? "—" },
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
