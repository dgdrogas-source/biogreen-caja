"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { SHIFT_LABELS, type Shift } from "../types";

export type ActionResult = { ok: true } | { ok: false; error: string };

const timeRe = /^([01]\d|2[0-3]):[0-5]\d$/;
const schema = z
  .object({
    shift: z.union([z.literal(1), z.literal(2)]),
    startTime: z.string().regex(timeRe, "Hora de inicio inválida (usa HH:MM)"),
    endTime: z.string().regex(timeRe, "Hora de fin inválida (usa HH:MM)"),
  })
  .refine((d) => d.startTime < d.endTime, {
    message: "La hora de inicio debe ser anterior a la de fin",
  });

// Cambio #6 — horarios de turnos editables. Solo definen el turno POR DEFECTO al
// registrar movimientos nuevos; no re-asignan movimientos ya guardados. Auditado.
export async function setShiftConfig(
  shift: Shift,
  startTime: string,
  endTime: string
): Promise<ActionResult> {
  try {
    const session = await auth();
    if (!session?.user) return { ok: false, error: "No autorizado" };
    if (session.user.role !== "ADMIN")
      return { ok: false, error: "Solo el administrador puede cambiar los horarios" };

    const data = schema.parse({ shift, startTime, endTime });

    const current = await prisma.shiftConfig.findUnique({ where: { shift: data.shift } });
    if (current && current.startTime === data.startTime && current.endTime === data.endTime)
      return { ok: true };

    await prisma.$transaction([
      prisma.shiftConfig.upsert({
        where: { shift: data.shift },
        update: { startTime: data.startTime, endTime: data.endTime },
        create: { shift: data.shift, startTime: data.startTime, endTime: data.endTime },
      }),
      prisma.auditLog.create({
        data: {
          action: "SET_SHIFT_CONFIG",
          changedById: session.user.id,
          fieldChanges: JSON.stringify({
            turno: { before: SHIFT_LABELS[data.shift], after: SHIFT_LABELS[data.shift] },
            horario: {
              before: current ? `${current.startTime} – ${current.endTime}` : null,
              after: `${data.startTime} – ${data.endTime}`,
            },
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
