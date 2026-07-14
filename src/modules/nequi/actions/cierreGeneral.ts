"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getOrCreateDay } from "../server/businessDay";

export type ActionResult = { ok: true } | { ok: false; error: string };

async function requireAdmin() {
  const session = await auth();
  if (!session?.user) throw new Error("No autorizado");
  if (session.user.role !== "ADMIN") throw new Error("Solo el administrador puede hacer esto");
  return session.user;
}

const nonNeg = z.number().int().nonnegative("No puede ser negativo");

const schema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida"),
  shift: z.union([z.literal(1), z.literal(2)]),
  ventaEfectivo: nonNeg,
  ventaNequi: nonNeg,
  ventaTarjeta: nonNeg,
  ventaDaviplata: nonNeg,
  ventaTransferencia: nonNeg,
  ventaCredito: nonNeg,
  ventaOtro: nonNeg,
  ventaSinFactura: nonNeg,
  realEfectivo: z.number().int().nonnegative().nullable().optional(),
  facturasPagadas: nonNeg,
  gastosVarios: nonNeg,
  retiroCierre: nonNeg,
  descuadre: z.number().int().nullable().optional(), // puede ser negativo (falta)
  nota: z.string().max(300).optional(),
});

export type CierreGeneralInputAction = z.infer<typeof schema>;

// Guarda (crea o actualiza) el cierre general del turno. Solo admin, auditado.
export async function guardarCierreGeneral(input: CierreGeneralInputAction): Promise<ActionResult> {
  try {
    const user = await requireAdmin();
    const d = schema.parse(input);
    const day = await getOrCreateDay(d.date, d.shift);

    const data = {
      ventaEfectivo: d.ventaEfectivo,
      ventaNequi: d.ventaNequi,
      ventaTarjeta: d.ventaTarjeta,
      ventaDaviplata: d.ventaDaviplata,
      ventaTransferencia: d.ventaTransferencia,
      ventaCredito: d.ventaCredito,
      ventaOtro: d.ventaOtro,
      ventaSinFactura: d.ventaSinFactura,
      realEfectivo: d.realEfectivo ?? null,
      facturasPagadas: d.facturasPagadas,
      gastosVarios: d.gastosVarios,
      retiroCierre: d.retiroCierre,
      descuadre: d.descuadre ?? null,
      nota: d.nota ?? null,
    };

    await prisma.$transaction([
      prisma.cierreGeneral.upsert({
        where: { businessDayId: day.id },
        update: data,
        create: { businessDayId: day.id, createdById: user.id, ...data },
      }),
      prisma.auditLog.create({
        data: {
          businessDayId: day.id,
          action: "CIERRE_GENERAL",
          changedById: user.id,
          fieldChanges: JSON.stringify({
            turno: { before: null, after: `${d.date} · Turno ${d.shift}` },
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

// Botón de emergencia: borra TODOS los cierres generales guardados (red de seguridad para
// lanzar sin pruebas). NO toca movimientos, ni Nequi, ni bolsillos. Solo admin, auditado.
export async function reiniciarCierreGeneral(): Promise<ActionResult> {
  try {
    const user = await requireAdmin();
    const { count } = await prisma.cierreGeneral.deleteMany({});
    await prisma.auditLog.create({
      data: {
        action: "RESET_CIERRE_GENERAL",
        changedById: user.id,
        fieldChanges: JSON.stringify({ cierresBorrados: { before: count, after: 0 } }),
      },
    });
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado" };
  }
}
