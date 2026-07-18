"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export type ActionResult = { ok: true } | { ok: false; error: string };

async function requireAdmin() {
  const session = await auth();
  if (!session?.user) throw new Error("No autorizado");
  if (session.user.role !== "ADMIN") throw new Error("Solo el administrador puede hacer esto");
  return session.user;
}

// El % de reposición es complementario: gastos/utilidad = 100 − este. Se limita a 1..99 para
// que ambos lados sean > 0 (siempre suman 100%). El punto de equilibrio es la venta diaria
// mínima de referencia. Cambiar esto NO altera cierres ya guardados (cada uno congeló su %).
const schema = z.object({
  porcentajeReposicion: z
    .number()
    .int("El porcentaje debe ser un número entero")
    .min(1, "El porcentaje debe ser al menos 1")
    .max(99, "El porcentaje debe ser como máximo 99"),
  puntoEquilibrio: z.number().int().nonnegative("No puede ser negativo"),
});

export async function ajustarConfigCierreGeneral(
  input: z.infer<typeof schema>
): Promise<ActionResult> {
  try {
    const user = await requireAdmin();
    const d = schema.parse(input);

    const prev = await prisma.cierreGeneralConfig.findUnique({ where: { id: 1 } });

    await prisma.$transaction([
      prisma.cierreGeneralConfig.upsert({
        where: { id: 1 },
        update: { porcentajeReposicion: d.porcentajeReposicion, puntoEquilibrio: d.puntoEquilibrio },
        create: {
          id: 1,
          porcentajeReposicion: d.porcentajeReposicion,
          puntoEquilibrio: d.puntoEquilibrio,
        },
      }),
      prisma.auditLog.create({
        data: {
          action: "SET_CONFIG_CIERRE_GENERAL",
          changedById: user.id,
          fieldChanges: JSON.stringify({
            porcentajeReposicion: {
              before: prev?.porcentajeReposicion ?? 70,
              after: d.porcentajeReposicion,
            },
            puntoEquilibrio: { before: prev?.puntoEquilibrio ?? 1_100_000, after: d.puntoEquilibrio },
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
