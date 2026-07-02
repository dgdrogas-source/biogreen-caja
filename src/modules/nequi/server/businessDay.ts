import "server-only";
import { prisma } from "@/lib/db";
import { todayBogota } from "@/lib/dates";

// Devuelve el día de caja para una fecha, creándolo si no existe.
// El saldo inicial se hereda del saldo real del último día cerrado.
export async function getOrCreateDay(date?: string) {
  const target = date ?? todayBogota();
  const existing = await prisma.businessDay.findUnique({ where: { date: target } });
  if (existing) return existing;

  const lastClosed = await prisma.businessDay.findFirst({
    where: { status: "CLOSED", date: { lt: target } },
    orderBy: { date: "desc" },
  });

  return prisma.businessDay.create({
    data: {
      date: target,
      openingBalance: lastClosed?.closingRealBalance ?? null,
    },
  });
}
