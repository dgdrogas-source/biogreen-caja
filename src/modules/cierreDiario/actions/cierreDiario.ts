"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { todayBogota } from "@/lib/dates";
import { FRANQUICIAS } from "../types";

export type ActionResult = { ok: true; mensaje?: string } | { ok: false; error: string };

async function requireAdmin() {
  const session = await auth();
  if (!session?.user) throw new Error("No autorizado");
  if (session.user.role !== "ADMIN") throw new Error("Solo el administrador puede hacer esto");
  return session.user;
}

// Cualquier usuario con sesión (admin o vendedora). Solo lo usa registrarDatafono: el lote del
// datáfono lo cierra quien tiene el aparato físico, normalmente la cajera de la tarde
// (PROCESO-CIERRE-DIARIO.md §2 y §3, pasos 4-5). El resto del módulo sigue siendo solo admin.
async function requireUsuario() {
  const session = await auth();
  if (!session?.user) throw new Error("No autorizado");
  return session.user;
}

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida");

const confirmarSaldoSchema = z.object({
  date: dateSchema,
  saldoReal: z.number().int(),
});

const confirmarSaldoDaviplataSchema = z.object({
  date: dateSchema,
  shift: z.union([z.literal(1), z.literal(2)]),
  saldoReal: z.number().int(),
});

// Confirma el saldo real de Cuenta Corriente observado en el banco. Si ya había un saldo
// confirmado para este día, lo reemplaza (la administradora puede volver a mirar el banco y
// corregir). La nota del cierre se guarda aparte (guardarNotaCierre) — confirmar un saldo NO
// la toca.
export async function confirmarSaldoCuentaCorriente(
  input: z.infer<typeof confirmarSaldoSchema>
): Promise<ActionResult> {
  try {
    const user = await requireAdmin();
    const d = confirmarSaldoSchema.parse(input);

    await prisma.$transaction([
      prisma.cierreDiario.upsert({
        where: { date: d.date },
        update: { saldoRealCC: d.saldoReal, cerradoById: user.id, cerradoAt: new Date() },
        create: {
          date: d.date,
          saldoRealCC: d.saldoReal,
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

// Daviplata se confirma POR TURNO (2026-09-10), no por día como Cuenta Corriente — ver
// CierreDiarioDaviplataTurno en prisma/schema.prisma. Reemplaza el upsert viejo sobre
// CierreDiario.saldoRealDaviplata, que queda en la BD sin uso (nunca DROP).
export async function confirmarSaldoDaviplata(
  input: z.infer<typeof confirmarSaldoDaviplataSchema>
): Promise<ActionResult> {
  try {
    const user = await requireAdmin();
    const d = confirmarSaldoDaviplataSchema.parse(input);

    await prisma.$transaction([
      prisma.cierreDiarioDaviplataTurno.upsert({
        where: { date_shift: { date: d.date, shift: d.shift } },
        update: { saldoReal: d.saldoReal, confirmadoById: user.id, confirmadoAt: new Date() },
        create: {
          date: d.date,
          shift: d.shift,
          saldoReal: d.saldoReal,
          confirmadoById: user.id,
          confirmadoAt: new Date(),
        },
      }),
      prisma.auditLog.create({
        data: {
          action: "CIERRE_DIARIO_SALDO_DAVIPLATA",
          changedById: user.id,
          fieldChanges: JSON.stringify({
            dia: { before: null, after: d.date },
            turno: { before: null, after: d.shift },
            saldoReal: { before: null, after: d.saldoReal },
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

const notaSchema = z.object({
  date: dateSchema,
  nota: z.string().max(600),
});

// Nota del cierre del día (una sola, tarjeta propia en la pantalla). Se guarda en
// CierreDiario.notaCC. `notaDaviplata` queda en la BD sin uso (deprecada).
export async function guardarNotaCierre(input: z.infer<typeof notaSchema>): Promise<ActionResult> {
  try {
    const user = await requireAdmin();
    const d = notaSchema.parse(input);
    const nota = d.nota.trim() || null;

    await prisma.$transaction([
      prisma.cierreDiario.upsert({
        where: { date: d.date },
        update: { notaCC: nota },
        create: { date: d.date, notaCC: nota },
      }),
      prisma.auditLog.create({
        data: {
          action: "CIERRE_DIARIO_NOTA",
          changedById: user.id,
          fieldChanges: JSON.stringify({ dia: { before: null, after: d.date } }),
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
//
// La puede usar la VENDEDORA desde /parte (2026-09-10) además del admin desde /cierre/diario.
// La vendedora solo registra el día de HOY: la fecha que mande se ignora, igual que en
// parteturno/server/guards.ts (fechaPermitida). El admin puede indicar una fecha pasada.
export async function registrarDatafono(
  input: z.infer<typeof datafonoSchema>
): Promise<ActionResult> {
  try {
    const user = await requireUsuario();
    const d = datafonoSchema.parse(input);
    const hoy = todayBogota();
    const date = user.role === "ADMIN" && d.date <= hoy ? d.date : hoy;

    const existente = await prisma.cierreDiarioDatafono.findUnique({ where: { date } });
    if (existente) return { ok: false, error: "Ya se registró el datáfono de este día" };

    await prisma.$transaction(async (tx) => {
      await tx.cierreDiarioDatafono.create({
        data: {
          date,
          franquicias: {
            create: d.franquicias.map((f) => ({ franquicia: f.franquicia, montoVendido: f.montoVendido })),
          },
        },
      });

      const pendientes = d.franquicias.filter((f) => f.montoVendido > 0);
      if (pendientes.length > 0) {
        await tx.cierreDiarioPendienteTarjeta.createMany({
          data: pendientes.map((f) => ({
            dateOrigen: date,
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
            dia: { before: null, after: date },
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
