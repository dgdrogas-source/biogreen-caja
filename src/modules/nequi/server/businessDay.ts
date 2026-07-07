import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { todayBogota } from "@/lib/dates";
import type { Shift } from "../types";

// Devuelve el turno de caja para una fecha+turno, creándolo si no existe.
// El saldo inicial se hereda del saldo real del último turno CERRADO anterior
// en el calendario (…T2 de ayer → T1 de hoy → T2 de hoy…).
// Si el turno anterior aún no está cerrado al crearse este, closeDay propaga
// el cierre real al sucesor (ver actions/day.ts), así la herencia no se pierde.
export async function getOrCreateDay(date?: string, shift: Shift = 1) {
  const target = date ?? todayBogota();
  const existing = await prisma.businessDay.findUnique({
    where: { date_shift: { date: target, shift } },
  });
  if (existing) return existing;

  const lastClosed = await prisma.businessDay.findFirst({
    where: {
      status: "CLOSED",
      OR: [{ date: { lt: target } }, { date: target, shift: { lt: shift } }],
    },
    orderBy: [{ date: "desc" }, { shift: "desc" }],
  });

  try {
    return await prisma.businessDay.create({
      data: {
        date: target,
        shift,
        openingBalance: lastClosed?.closingRealBalance ?? null,
      },
    });
  } catch (e) {
    // Otra petición concurrente pudo crear el mismo turno: reusarlo.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const created = await prisma.businessDay.findUnique({
        where: { date_shift: { date: target, shift } },
      });
      if (created) return created;
    }
    throw e;
  }
}
