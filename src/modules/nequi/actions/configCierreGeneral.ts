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

// El reparto es de tres: reposición + tercero + gastos/utilidad = 100%. Gastos/utilidad es
// el complemento (100 − reposición − tercero) y no se guarda como campo — se limita
// reposición a 1..99 y tercero a 0..98 para que gastos/utilidad sea siempre ≥ 1 (nunca 0).
// El punto de equilibrio es la venta diaria mínima de referencia. Cambiar esto NO altera
// cierres ya guardados (cada uno congeló su %).
const schema = z
  .object({
    porcentajeReposicion: z
      .number()
      .int("El porcentaje debe ser un número entero")
      .min(1, "El porcentaje debe ser al menos 1")
      .max(99, "El porcentaje debe ser como máximo 99"),
    porcentajeTercero: z
      .number()
      .int("El porcentaje debe ser un número entero")
      .min(0, "El porcentaje no puede ser negativo")
      .max(98, "El porcentaje debe ser como máximo 98"),
    puntoEquilibrio: z.number().int().nonnegative("No puede ser negativo"),
  })
  .refine((d) => d.porcentajeReposicion + d.porcentajeTercero <= 99, {
    message: "Reposición + Tercero no puede pasar de 99% (gastos/utilidad quedaría en 0 o menos)",
    path: ["porcentajeTercero"],
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
        update: {
          porcentajeReposicion: d.porcentajeReposicion,
          porcentajeTercero: d.porcentajeTercero,
          puntoEquilibrio: d.puntoEquilibrio,
        },
        create: {
          id: 1,
          porcentajeReposicion: d.porcentajeReposicion,
          porcentajeTercero: d.porcentajeTercero,
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
            porcentajeTercero: { before: prev?.porcentajeTercero ?? 0, after: d.porcentajeTercero },
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
