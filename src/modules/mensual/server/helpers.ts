import "server-only";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

// requireAdmin para SERVER ACTIONS: lanza error (no redirige, como sí hace el de
// lib/permissions usado en páginas). Mismo patrón que actions/cierreGeneral.ts.
export async function requireAdminAction() {
  const session = await auth();
  if (!session?.user) throw new Error("No autorizado");
  if (session.user.role !== "ADMIN") throw new Error("Solo el administrador puede hacer esto");
  return session.user;
}

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

// Crea (si no existe) la fila del día por fecha, para poder colgarle gastos/diferencias
// antes de haber guardado los totales del día. Mismo patrón que ensureCierreGeneral.
export async function ensureMensualDia(tx: Tx, date: string, createdById: string) {
  await tx.mensualDia.upsert({
    where: { date },
    update: {},
    create: { date, createdById },
  });
  return tx.mensualDia.findUniqueOrThrow({ where: { date } });
}
