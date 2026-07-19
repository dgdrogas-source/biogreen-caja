"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { todayBogota } from "@/lib/dates";
import { prisma } from "@/lib/db";
import { ensureCierreGeneral } from "./cierreGeneral";
import { getCurrentShift, getSaldosPorPlataforma } from "../queries";
import { getOrCreateDay } from "../server/businessDay";
import { CATEGORIA_4X1000_INTERNO, PLATAFORMAS } from "../types";

export type ActionResult = { ok: true } | { ok: false; error: string };

async function requireAdmin() {
  const session = await auth();
  if (!session?.user) throw new Error("No autorizado");
  if (session.user.role !== "ADMIN") throw new Error("Solo el administrador puede hacer esto");
  return session.user;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// ---- Ajustar saldo inicial de una plataforma (mismo patrón que ajustarBolsaGeneral) ----
const saldoInicialSchema = z.object({
  plataforma: z.enum(PLATAFORMAS),
  amount: z.number().int("El saldo debe ser un número entero"), // puede ser negativo
});

export async function ajustarSaldoInicialPlataforma(
  plataforma: string,
  amount: number
): Promise<ActionResult> {
  try {
    const user = await requireAdmin();
    const d = saldoInicialSchema.parse({ plataforma, amount });

    const current = await prisma.plataformaSaldoInicial.findUnique({
      where: { plataforma: d.plataforma },
    });
    if ((current?.openingBalance ?? 0) === d.amount) return { ok: true };

    await prisma.$transaction([
      prisma.plataformaSaldoInicial.upsert({
        where: { plataforma: d.plataforma },
        update: { openingBalance: d.amount },
        create: { plataforma: d.plataforma, openingBalance: d.amount },
      }),
      prisma.auditLog.create({
        data: {
          action: "SET_SALDO_PLATAFORMA",
          changedById: user.id,
          fieldChanges: JSON.stringify({
            plataforma: { before: d.plataforma, after: d.plataforma },
            saldoInicial: { before: current?.openingBalance ?? 0, after: d.amount },
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

// ---- Ajustar el "pendiente inicial" de tarjeta (corrige la alarma falsa del día 1) ----
const ajustePendienteSchema = z.object({ amount: z.number().int().nonnegative() });

export async function ajustarPendienteInicialTarjeta(amount: number): Promise<ActionResult> {
  try {
    const user = await requireAdmin();
    const d = ajustePendienteSchema.parse({ amount });

    const current = await prisma.tarjetaConfig.findUnique({ where: { id: 1 } });
    if ((current?.ajustePendienteInicial ?? 0) === d.amount) return { ok: true };

    await prisma.$transaction([
      prisma.tarjetaConfig.upsert({
        where: { id: 1 },
        update: { ajustePendienteInicial: d.amount },
        create: { id: 1, ajustePendienteInicial: d.amount },
      }),
      prisma.auditLog.create({
        data: {
          action: "SET_AJUSTE_PENDIENTE_TARJETA",
          changedById: user.id,
          fieldChanges: JSON.stringify({
            ajustePendienteInicial: { before: current?.ajustePendienteInicial ?? 0, after: d.amount },
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

// ---- Confirmar un abono de tarjeta (el banco abonó, en neto; puede ser parcial) ----
const abonoSchema = z.object({
  date: z.string().regex(DATE_RE, "Fecha inválida"),
  monto: z.number().int().positive("El monto debe ser mayor a cero"),
  nota: z.string().max(300).optional(),
});

export async function confirmarAbonoTarjeta(
  input: z.infer<typeof abonoSchema>
): Promise<ActionResult> {
  try {
    const user = await requireAdmin();
    const d = abonoSchema.parse(input);

    // No dejar confirmar más de lo que el banco tiene pendiente por abonar.
    const { tarjetaPendiente } = await getSaldosPorPlataforma();
    if (d.monto > tarjetaPendiente) {
      return {
        ok: false,
        error: `Solo hay $${tarjetaPendiente.toLocaleString("es-CO")} pendientes de abono de tarjeta.`,
      };
    }

    await prisma.$transaction([
      prisma.tarjetaAbono.create({
        data: { date: d.date, monto: d.monto, nota: d.nota ?? null, createdById: user.id },
      }),
      prisma.auditLog.create({
        data: {
          action: "TARJETA_ABONO",
          changedById: user.id,
          fieldChanges: JSON.stringify({ abono: { before: null, after: d.monto } }),
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

export async function eliminarAbonoTarjeta(id: string): Promise<ActionResult> {
  try {
    const user = await requireAdmin();
    const abono = await prisma.tarjetaAbono.findUnique({ where: { id } });
    if (!abono) return { ok: false, error: "Abono no encontrado" };

    await prisma.$transaction([
      prisma.tarjetaAbono.delete({ where: { id } }),
      prisma.auditLog.create({
        data: {
          action: "TARJETA_ABONO_DELETE",
          changedById: user.id,
          fieldChanges: JSON.stringify({ abono: { before: abono.monto, after: null } }),
        },
      }),
    ]);

    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado" };
  }
}

// ---- Registrar un movimiento real entre plataformas (ej. Banco → Nequi) ----
// date/shift son opcionales: si hay 4x1000, se necesitan para colgar el gasto automático de
// ese impuesto en el cierre del turno; si no se dan, se usa hoy + el turno actual.
const transferenciaSchema = z
  .object({
    fromPlataforma: z.enum(PLATAFORMAS),
    toPlataforma: z.enum(PLATAFORMAS),
    monto: z.number().int().positive("El monto debe ser mayor a cero"),
    impuesto4x1000: z.number().int().nonnegative().optional(),
    nota: z.string().max(300).optional(),
    date: z.string().regex(DATE_RE, "Fecha inválida").optional(),
    shift: z.union([z.literal(1), z.literal(2)]).optional(),
  })
  .refine((d) => d.fromPlataforma !== d.toPlataforma, {
    message: "El origen y el destino no pueden ser la misma plataforma",
  });

export async function registrarTransferenciaPlataforma(
  input: z.infer<typeof transferenciaSchema>
): Promise<ActionResult> {
  try {
    const user = await requireAdmin();
    const d = transferenciaSchema.parse(input);
    const impuesto = d.impuesto4x1000 ?? 0;

    await prisma.$transaction(async (tx) => {
      let gastoGeneradoId: string | null = null;

      // El 4x1000 SÍ reduce la plataforma origen (eso ya lo hace calcularSaldosPlataforma
      // con impuesto4x1000), pero además debe bajar la bolsa de gastos: se crea un gasto
      // DESCONTADO_ORIGEN (no vuelve a restar de ninguna plataforma) ligado a este movimiento.
      if (impuesto > 0) {
        const date = d.date ?? todayBogota();
        const shift = d.shift ?? (await getCurrentShift());
        const day = await getOrCreateDay(date, shift);
        const cierre = await ensureCierreGeneral(tx, day.id, user.id);
        const categoria = await tx.categoriaGasto.upsert({
          where: { nombre: CATEGORIA_4X1000_INTERNO },
          update: {},
          create: { nombre: CATEGORIA_4X1000_INTERNO },
        });
        const gasto = await tx.cierreGeneralGasto.create({
          data: {
            cierreGeneralId: cierre.id,
            categoriaId: categoria.id,
            monto: impuesto,
            metodoPago: "DESCONTADO_ORIGEN",
            autoGenerado: true,
            descripcion: `4x1000 de mover ${d.fromPlataforma} → ${d.toPlataforma} (automático)`,
          },
        });
        gastoGeneradoId = gasto.id;
      }

      await tx.plataformaTransferencia.create({
        data: {
          fromPlataforma: d.fromPlataforma,
          toPlataforma: d.toPlataforma,
          monto: d.monto,
          impuesto4x1000: impuesto,
          nota: d.nota ?? null,
          createdById: user.id,
          gastoGeneradoId,
        },
      });

      await tx.auditLog.create({
        data: {
          action: "PLATAFORMA_TRANSFERENCIA",
          changedById: user.id,
          fieldChanges: JSON.stringify({
            movimiento: { before: null, after: `${d.fromPlataforma} → ${d.toPlataforma}` },
            monto: { before: null, after: d.monto },
            impuesto4x1000: { before: null, after: impuesto },
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

export async function eliminarTransferenciaPlataforma(id: string): Promise<ActionResult> {
  try {
    const user = await requireAdmin();
    const t = await prisma.plataformaTransferencia.findUnique({ where: { id } });
    if (!t) return { ok: false, error: "Movimiento no encontrado" };

    await prisma.$transaction(async (tx) => {
      // Se borra primero el gasto ligado (si lo hay); el FK en PlataformaTransferencia es
      // ON DELETE SET NULL hacia el gasto, así que hay que borrarlo explícito, no confiar
      // en cascada. Se borra la transferencia después, no antes (evita violar el FK).
      if (t.gastoGeneradoId) {
        await tx.plataformaTransferencia.update({
          where: { id },
          data: { gastoGeneradoId: null },
        });
        await tx.cierreGeneralGasto.delete({ where: { id: t.gastoGeneradoId } });
      }
      await tx.plataformaTransferencia.delete({ where: { id } });
      await tx.auditLog.create({
        data: {
          action: "PLATAFORMA_TRANSFERENCIA_DELETE",
          changedById: user.id,
          fieldChanges: JSON.stringify({
            movimiento: { before: `${t.fromPlataforma} → ${t.toPlataforma}`, after: null },
            monto: { before: t.monto, after: null },
          }),
        },
      });
    });

    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado" };
  }
}
