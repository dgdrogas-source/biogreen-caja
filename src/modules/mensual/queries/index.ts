import "server-only";
import { prisma } from "@/lib/db";

// El día con sus gastos (incluida la categoría) y sus diferencias. Es la forma que
// consume la página para armar el input del cálculo puro.
export type MensualDiaConItems = Awaited<ReturnType<typeof getMes>>[number];

// Todas las filas del mes ("YYYY-MM"). El filtro por rango de string funciona porque
// date es "YYYY-MM-DD" (orden lexicográfico = orden real). Ordenado por fecha asc.
export function getMes(month: string) {
  return prisma.mensualDia.findMany({
    where: { date: { gte: `${month}-01`, lte: `${month}-31` } },
    orderBy: { date: "asc" },
    include: {
      gastos: { include: { categoria: true }, orderBy: { createdAt: "asc" } },
      diferencias: { orderBy: { createdAt: "asc" } },
    },
  });
}

// Categorías activas del módulo mensual (para el selector de gastos).
export function getCategoriasMensual() {
  return prisma.mensualCategoriaGasto.findMany({
    where: { activa: true },
    orderBy: { nombre: "asc" },
  });
}

// Todas las categorías (activas e inactivas) para la pantalla de configuración.
export function getTodasCategoriasMensual() {
  return prisma.mensualCategoriaGasto.findMany({ orderBy: { nombre: "asc" } });
}

// Meses que ya tienen algún registro, más recientes primero ("YYYY-MM"). Para el
// selector de mes (poder saltar a meses anteriores ya cerrados).
export async function getMesesConDatos(): Promise<string[]> {
  const rows = await prisma.mensualDia.findMany({ select: { date: true } });
  return [...new Set(rows.map((r) => r.date.slice(0, 7)))].sort().reverse();
}
