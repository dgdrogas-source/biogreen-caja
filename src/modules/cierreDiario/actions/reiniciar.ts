"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export type ActionResult = { ok: true; mensaje?: string } | { ok: false; error: string };

async function requireAdmin() {
  const session = await auth();
  if (!session?.user) throw new Error("No autorizado");
  if (session.user.role !== "ADMIN") throw new Error("Solo el administrador puede hacer esto");
  return session.user;
}

// Botón de emergencia / modo prueba: borra TODOS los datos del módulo Cierre Diario (saldos
// confirmados, datáfonos, pendientes de tarjeta, movimientos manuales). NO toca Parte de
// Turno, Nequi, ni ningún otro módulo — son tablas separadas. Mismo patrón que
// reiniciarModuloMensual (mensual/actions/dia.ts).
export async function reiniciarCierreDiario(): Promise<ActionResult> {
  try {
    const user = await requireAdmin();

    const [cierres, datafonos, pendientes, movimientos] = await prisma.$transaction([
      prisma.cierreDiario.deleteMany({}),
      prisma.cierreDiarioDatafono.deleteMany({}), // arrastra franquicias por cascade
      prisma.cierreDiarioPendienteTarjeta.deleteMany({}),
      prisma.cierreDiarioMovimientoManual.deleteMany({}),
    ]);

    await prisma.auditLog.create({
      data: {
        action: "CIERRE_DIARIO_RESET",
        changedById: user.id,
        fieldChanges: JSON.stringify({
          cierresBorrados: { before: cierres.count, after: 0 },
          datafonosBorrados: { before: datafonos.count, after: 0 },
          pendientesBorrados: { before: pendientes.count, after: 0 },
          movimientosBorrados: { before: movimientos.count, after: 0 },
        }),
      },
    });

    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado" };
  }
}
