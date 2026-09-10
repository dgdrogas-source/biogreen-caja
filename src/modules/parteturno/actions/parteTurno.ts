"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getOrCreateDay } from "@/modules/nequi/server/businessDay";
import { assertEditable, fechaPermitida, requireSesion } from "../server/guards";
import type { ActionResult } from "../types";

// Acciones de la VENDEDORA sobre su parte de turno. Ninguna escribe en el módulo Nequi: el
// parte vive en sus propias tablas y no afecta Cierre Diario hasta que el admin lo aprueba
// (ver actions/aprobacion.ts) — aprobar solo bloquea el parte, no vuelca nada a otro lado.

const nonNeg = z.number().int().nonnegative("No puede ser negativo");

const turnoSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida"),
  shift: z.union([z.literal(1), z.literal(2)]),
});

const guardarSchema = turnoSchema.extend({
  ventaEfectivo: nonNeg,
  ventaNequi: nonNeg,
  ventaTarjeta: nonNeg,
  ventaTarjetaDebito: nonNeg,
  ventaDaviplata: nonNeg,
  ventaTransferencia: nonNeg,
  ventaCredito: nonNeg,
  ventaOtro: nonNeg,
  // ventaSinFactura, retiroCierre, realEfectivo y nota ya no se reciben (retirados del parte
  // el 2026-09-09, ver calculations/parteTurno.ts). Sus columnas quedan en su valor por
  // defecto y no se tocan.
});

export type GuardarParteInput = z.infer<typeof guardarSchema>;

// Crea o actualiza el parte del turno con lo copiado del recibo del POS.
export async function guardarParteTurno(input: GuardarParteInput): Promise<ActionResult> {
  try {
    const user = await requireSesion();
    const d = guardarSchema.parse(input);
    const date = fechaPermitida(user.role, d.date);
    const day = await getOrCreateDay(date, d.shift);

    const existente = await prisma.parteTurno.findUnique({
      where: { businessDayId: day.id },
      select: { estado: true },
    });
    if (existente) assertEditable(existente.estado);

    const data = {
      ventaEfectivo: d.ventaEfectivo,
      ventaNequi: d.ventaNequi,
      ventaTarjeta: d.ventaTarjeta,
      ventaTarjetaDebito: d.ventaTarjetaDebito,
      ventaDaviplata: d.ventaDaviplata,
      ventaTransferencia: d.ventaTransferencia,
      ventaCredito: d.ventaCredito,
      ventaOtro: d.ventaOtro,
    };

    await prisma.$transaction(async (tx) => {
      await tx.parteTurno.upsert({
        where: { businessDayId: day.id },
        update: data,
        create: { businessDayId: day.id, registradoById: user.id, ...data },
      });
      await tx.auditLog.create({
        data: {
          businessDayId: day.id,
          action: "PARTE_TURNO_GUARDAR",
          changedById: user.id,
          fieldChanges: JSON.stringify({
            turno: { before: null, after: `${date} · Turno ${d.shift}` },
            ventaTotal: {
              before: null,
              after:
                d.ventaEfectivo +
                d.ventaNequi +
                d.ventaTarjeta +
                d.ventaTarjetaDebito +
                d.ventaDaviplata +
                d.ventaTransferencia +
                d.ventaCredito +
                d.ventaOtro,
            },
          }),
        },
      });
    });

    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    if (e instanceof z.ZodError) return { ok: false, error: e.issues[0]?.message ?? "Datos inválidos" };
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado" };
  }
}

// La vendedora cierra su parte y se lo manda al administrador. A partir de aquí no lo puede
// tocar; si necesita corregir algo, el admin se lo devuelve.
export async function enviarParteTurno(
  input: z.infer<typeof turnoSchema>
): Promise<ActionResult> {
  try {
    const user = await requireSesion();
    const d = turnoSchema.parse(input);
    const date = fechaPermitida(user.role, d.date);

    const day = await prisma.businessDay.findUnique({
      where: { date_shift: { date, shift: d.shift } },
    });
    if (!day) return { ok: false, error: "Aún no has registrado nada en el parte" };

    const parte = await prisma.parteTurno.findUnique({ where: { businessDayId: day.id } });
    if (!parte) return { ok: false, error: "Aún no has registrado nada en el parte" };
    assertEditable(parte.estado);

    await prisma.$transaction([
      prisma.parteTurno.update({
        where: { id: parte.id },
        data: { estado: "ENVIADO", enviadoAt: new Date(), notaAdmin: null },
      }),
      prisma.auditLog.create({
        data: {
          businessDayId: day.id,
          action: "PARTE_TURNO_ENVIAR",
          changedById: user.id,
          fieldChanges: JSON.stringify({
            estado: { before: parte.estado, after: "ENVIADO" },
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
