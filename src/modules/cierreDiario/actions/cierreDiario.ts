"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { FRANQUICIAS } from "../types";

export type ActionResult = { ok: true; mensaje?: string } | { ok: false; error: string };

async function requireAdmin() {
  const session = await auth();
  if (!session?.user) throw new Error("No autorizado");
  if (session.user.role !== "ADMIN") throw new Error("Solo el administrador puede hacer esto");
  return session.user;
}

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida");

const confirmarSaldoSchema = z.object({
  date: dateSchema,
  saldoReal: z.number().int(),
  nota: z.string().max(300).optional(),
});

// Confirma el saldo real de Cuenta Corriente observado en el banco. Si ya había un saldo
// confirmado para este día, lo reemplaza (la administradora puede volver a mirar el banco y
// corregir).
export async function confirmarSaldoCuentaCorriente(
  input: z.infer<typeof confirmarSaldoSchema>
): Promise<ActionResult> {
  try {
    const user = await requireAdmin();
    const d = confirmarSaldoSchema.parse(input);

    await prisma.$transaction([
      prisma.cierreDiario.upsert({
        where: { date: d.date },
        update: { saldoRealCC: d.saldoReal, notaCC: d.nota ?? null, cerradoById: user.id, cerradoAt: new Date() },
        create: {
          date: d.date,
          saldoRealCC: d.saldoReal,
          notaCC: d.nota ?? null,
          cerradoById: user.id,
          cerradoAt: new Date(),
        },
      }),
      prisma.auditLog.create({
        data: {
          action: "CIERRE_DIARIO_SALDO_CC",
          changedById: user.id,
          fieldChanges: JSON.stringify({ dia: { before: null, after: d.date }, saldoReal: { before: null, after: d.saldoReal } }),
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

export async function confirmarSaldoDaviplata(
  input: z.infer<typeof confirmarSaldoSchema>
): Promise<ActionResult> {
  try {
    const user = await requireAdmin();
    const d = confirmarSaldoSchema.parse(input);

    await prisma.$transaction([
      prisma.cierreDiario.upsert({
        where: { date: d.date },
        update: { saldoRealDaviplata: d.saldoReal, notaDaviplata: d.nota ?? null },
        create: { date: d.date, saldoRealDaviplata: d.saldoReal, notaDaviplata: d.nota ?? null },
      }),
      prisma.auditLog.create({
        data: {
          action: "CIERRE_DIARIO_SALDO_DAVIPLATA",
          changedById: user.id,
          fieldChanges: JSON.stringify({ dia: { before: null, after: d.date }, saldoReal: { before: null, after: d.saldoReal } }),
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

const franquiciaSchema = z.object({
  franquicia: z.enum(FRANQUICIAS),
  montoVendido: z.number().int().nonnegative(),
});

const datafonoSchema = z.object({
  date: dateSchema,
  franquicias: z.array(franquiciaSchema).min(1, "Agrega al menos una franquicia"),
});

// Registra el cierre de lote del datáfono del día (una vez al día): el desglose de tarjeta
// por franquicia. Cada franquicia con venta > 0 crea también su pendiente por consignar.
export async function registrarDatafono(
  input: z.infer<typeof datafonoSchema>
): Promise<ActionResult> {
  try {
    const user = await requireAdmin();
    const d = datafonoSchema.parse(input);

    const existente = await prisma.cierreDiarioDatafono.findUnique({ where: { date: d.date } });
    if (existente) return { ok: false, error: "Ya se registró el datáfono de este día" };

    await prisma.$transaction(async (tx) => {
      await tx.cierreDiarioDatafono.create({
        data: {
          date: d.date,
          franquicias: {
            create: d.franquicias.map((f) => ({ franquicia: f.franquicia, montoVendido: f.montoVendido })),
          },
        },
      });

      const pendientes = d.franquicias.filter((f) => f.montoVendido > 0);
      if (pendientes.length > 0) {
        await tx.cierreDiarioPendienteTarjeta.createMany({
          data: pendientes.map((f) => ({
            dateOrigen: d.date,
            franquicia: f.franquicia,
            montoVendido: f.montoVendido,
          })),
        });
      }

      await tx.auditLog.create({
        data: {
          action: "CIERRE_DIARIO_DATAFONO",
          changedById: user.id,
          fieldChanges: JSON.stringify({
            dia: { before: null, after: d.date },
            franquicias: { before: null, after: d.franquicias.length },
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

const calceSchema = z.object({
  pendienteId: z.string().min(1),
  montoConsignado: z.number().int().positive("El monto debe ser mayor a cero"),
  fechaConsignado: dateSchema,
});

// Confirma que llegó la consignación de un pendiente de tarjeta (calce tolerante, nunca
// exacto — ver calculations/calceTarjeta.ts). El admin ve la diferencia antes de confirmar y
// puede ajustar el monto si no coincide con lo que ve en el banco.
//
// ⚠️ Límite del modelo de cadena: si `fechaConsignado` cae ANTES o EN el día de la última
// confirmación de Cuenta Corriente, ese dinero no entra en ningún `getTarjetaLlegadaRango`
// futuro (el rango arranca el día siguiente a la última confirmación) → queda como sesgo
// silencioso en el esperado. En la práctica el banco consigna dentro de 1-2 días hábiles y la
// mamá confirma a diario, así que rara vez pasa; si pasa, se corrige re-confirmando el saldo.
export async function confirmarCalceTarjeta(
  input: z.infer<typeof calceSchema>
): Promise<ActionResult> {
  try {
    const user = await requireAdmin();
    const d = calceSchema.parse(input);

    const pendiente = await prisma.cierreDiarioPendienteTarjeta.findUnique({ where: { id: d.pendienteId } });
    if (!pendiente) return { ok: false, error: "Pendiente no encontrado" };
    if (pendiente.resuelto) return { ok: false, error: "Este pendiente ya se marcó resuelto" };

    await prisma.$transaction([
      prisma.cierreDiarioPendienteTarjeta.update({
        where: { id: d.pendienteId },
        data: { montoConsignado: d.montoConsignado, fechaConsignado: d.fechaConsignado, resuelto: true },
      }),
      prisma.auditLog.create({
        data: {
          action: "CIERRE_DIARIO_CALCE_TARJETA",
          changedById: user.id,
          fieldChanges: JSON.stringify({
            franquicia: { before: pendiente.franquicia, after: pendiente.franquicia },
            montoConsignado: { before: null, after: d.montoConsignado },
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
