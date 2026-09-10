"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { todayBogota } from "@/lib/dates";
import { getUltimaConfirmacionCC } from "@/modules/cierreDiario/queries";
import { yaSeDescartaronPartesViejos } from "../queries";
import { requireAdminAction } from "../server/guards";
import type { ActionResult } from "../types";

// EL PUNTO DE CONTROL. Hasta aquí, nada de lo que registró la vendedora ha movido un peso ni
// afectado ninguna cuenta — el parte vive en sus propias tablas (ParteTurno). Aprobar solo
// LOCK-ea el parte (ya no se puede editar ni devolver) y deja constancia en el AuditLog.
//
// Aprobar NO vuelca nada a ningún otro lado: Cierre Diario lee directo de los ParteTurno del
// día (ver cierreDiario/queries → getVentasDelDia), no necesita que "aprobar" le escriba nada
// aparte.
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

      const parte = await tx.parteTurno.findUniqueOrThrow({ where: { id: parteId } });

      await tx.auditLog.create({
        data: {
          businessDayId: parte.businessDayId,
          action: "PARTE_TURNO_APROBAR",
          changedById: user.id,
          fieldChanges: JSON.stringify({
            estado: { before: "ENVIADO", after: "APROBADO" },
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

// Limpieza inicial: borra TODOS los partes de turno con fecha anterior a hoy, de cualquier
// estado (pendientes, borradores y aprobados del flujo viejo con Cierre General). Sus
// gastos/facturas se van en cascada (onDelete: Cascade). Pensado para usarse UNA vez, antes de
// que Cierre Diario entre en firme — el dueño no quiere arrastrar cierres mal reportados de
// antes. NO toca BusinessDay, Movimientos de Nequi, ni el AuditLog (el historial de quién
// registró qué se conserva). Doble confirmación en la UI; solo admin.
//
// DOS guardias en servidor (además del gate de la UI), porque un botón de una pestaña vieja o
// del bfcache podría dispararla otro día:
//  1. si ya se corrió una vez (AuditLog PARTE_TURNO_LIMPIEZA) → no se repite.
//  2. si ya hay una confirmación de saldo de Cuenta Corriente de un día anterior → NO se corre:
//     borrar partes dentro de la cadena del esperado de CC la corrompería en silencio
//     (sub-contaría ventaTransferencia). La limpieza es solo para ANTES de empezar a conciliar.
export async function descartarPartesAnteriores(): Promise<ActionResult> {
  try {
    const user = await requireAdminAction();
    const hoy = todayBogota();

    if (await yaSeDescartaronPartesViejos()) {
      return { ok: false, error: "La limpieza inicial ya se hizo una vez" };
    }
    if (await getUltimaConfirmacionCC(hoy)) {
      return {
        ok: false,
        error:
          "Ya hay saldos de Cuenta Corriente confirmados: la limpieza solo se puede hacer antes de empezar a conciliar.",
      };
    }

    await prisma.$transaction(async (tx) => {
      // Re-chequeo dentro de la transacción: si otro clic casi simultáneo ya la corrió, no
      // se vuelve a borrar ni se escribe un 2º log.
      if ((await tx.auditLog.count({ where: { action: "PARTE_TURNO_LIMPIEZA" } })) > 0) return;

      const viejos = await tx.parteTurno.findMany({
        where: { businessDay: { date: { lt: hoy } } },
        select: { id: true, businessDay: { select: { date: true, shift: true } } },
      });
      if (viejos.length === 0) return;

      const borrados = await tx.parteTurno.deleteMany({
        where: { id: { in: viejos.map((p) => p.id) } },
      });

      await tx.auditLog.create({
        data: {
          action: "PARTE_TURNO_LIMPIEZA",
          changedById: user.id,
          fieldChanges: JSON.stringify({
            partesBorrados: { before: `${borrados.count} partes`, after: "ninguno" },
            alcance: { before: null, after: `partes con fecha anterior a ${hoy}` },
            turnos: {
              before: viejos
                .map((p) => `${p.businessDay.date} T${p.businessDay.shift}`)
                .join(", ")
                .slice(0, 500),
              after: null,
            },
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
