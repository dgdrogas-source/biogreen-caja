"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getOrCreateDay } from "@/modules/nequi/server/businessDay";
import { METODOS_PAGO_ITEM_MANUAL } from "@/modules/nequi/types";
import { assertEditable, fechaPermitida, requireSesion } from "../server/guards";
import type { ActionResult } from "../types";

// Acciones de la VENDEDORA sobre su parte de turno. Ninguna escribe en el módulo Nequi ni en
// CierreGeneral: el parte vive en sus propias tablas y no mueve un peso hasta que el admin lo
// aprueba (ver actions/aprobacion.ts).

const nonNeg = z.number().int().nonnegative("No puede ser negativo");

const turnoSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida"),
  shift: z.union([z.literal(1), z.literal(2)]),
});

const guardarSchema = turnoSchema.extend({
  ventaEfectivo: nonNeg,
  ventaNequi: nonNeg,
  ventaTarjeta: nonNeg,
  ventaDaviplata: nonNeg,
  ventaTransferencia: nonNeg,
  ventaCredito: nonNeg,
  ventaOtro: nonNeg,
  ventaSinFactura: nonNeg,
  retiroCierre: nonNeg,
  realEfectivo: z.number().int().nonnegative().nullable().optional(),
  nota: z.string().max(300).optional(),
});

export type GuardarParteInput = z.infer<typeof guardarSchema>;

// Crea o actualiza el parte del turno con lo copiado del recibo del POS.
export async function guardarParteTurno(input: GuardarParteInput): Promise<ActionResult> {
  try {
    const user = await requireSesion();
    const d = guardarSchema.parse(input);
    const date = fechaPermitida(user.role, d.date);
    const day = await getOrCreateDay(date, d.shift);

    const existente = await prisma.parteTurno.findUnique({
      where: { businessDayId: day.id },
      select: { estado: true },
    });
    if (existente) assertEditable(existente.estado);

    const data = {
      ventaEfectivo: d.ventaEfectivo,
      ventaNequi: d.ventaNequi,
      ventaTarjeta: d.ventaTarjeta,
      ventaDaviplata: d.ventaDaviplata,
      ventaTransferencia: d.ventaTransferencia,
      ventaCredito: d.ventaCredito,
      ventaOtro: d.ventaOtro,
      ventaSinFactura: d.ventaSinFactura,
      retiroCierre: d.retiroCierre,
      realEfectivo: d.realEfectivo ?? null,
      nota: d.nota ?? null,
    };

    await prisma.$transaction(async (tx) => {
      await tx.parteTurno.upsert({
        where: { businessDayId: day.id },
        update: data,
        create: { businessDayId: day.id, registradoById: user.id, ...data },
      });
      await tx.auditLog.create({
        data: {
          businessDayId: day.id,
          action: "PARTE_TURNO_GUARDAR",
          changedById: user.id,
          fieldChanges: JSON.stringify({
            turno: { before: null, after: `${date} · Turno ${d.shift}` },
            ventaTotal: {
              before: null,
              after:
                d.ventaEfectivo +
                d.ventaNequi +
                d.ventaTarjeta +
                d.ventaDaviplata +
                d.ventaTransferencia +
                d.ventaCredito +
                d.ventaOtro,
            },
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

// Crea el parte "cascarón" si aún no existe, para poder colgarle un gasto/factura antes de
// haber guardado las ventas (mismo patrón que ensureCierreGeneral).
async function ensureParte(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  businessDayId: string,
  registradoById: string
) {
  await tx.parteTurno.upsert({
    where: { businessDayId },
    update: {},
    create: { businessDayId, registradoById },
  });
  return tx.parteTurno.findUniqueOrThrow({ where: { businessDayId } });
}

// proveedorId y categoriaId son OBLIGATORIOS: la vendedora solo ELIGE de la lista (decisión
// del dueño 2026-07-29). No puede crear proveedores ni categorías.
const gastoSchema = turnoSchema.extend({
  categoriaId: z.string().min(1, "Elige una categoría"),
  proveedorId: z.string().min(1, "Elige un proveedor"),
  monto: z.number().int().positive("El monto debe ser mayor a cero"),
  descripcion: z.string().max(300).optional(),
  metodoPago: z.enum(METODOS_PAGO_ITEM_MANUAL).optional(),
});

export async function agregarGastoParte(
  input: z.infer<typeof gastoSchema>
): Promise<ActionResult> {
  try {
    const user = await requireSesion();
    const d = gastoSchema.parse(input);
    const date = fechaPermitida(user.role, d.date);
    const day = await getOrCreateDay(date, d.shift);

    const [categoria, proveedor] = await Promise.all([
      prisma.categoriaGasto.findUnique({ where: { id: d.categoriaId } }),
      prisma.proveedor.findUnique({ where: { id: d.proveedorId } }),
    ]);
    if (!categoria) return { ok: false, error: "Categoría no encontrada" };
    if (!proveedor) return { ok: false, error: "Proveedor no encontrado" };

    await prisma.$transaction(async (tx) => {
      const parte = await ensureParte(tx, day.id, user.id);
      assertEditable(parte.estado);
      await tx.parteTurnoGasto.create({
        data: {
          parteTurnoId: parte.id,
          categoriaId: d.categoriaId,
          proveedorId: d.proveedorId,
          monto: d.monto,
          descripcion: d.descripcion,
          metodoPago: d.metodoPago,
        },
      });
      await tx.auditLog.create({
        data: {
          businessDayId: day.id,
          action: "PARTE_TURNO_GASTO_ADD",
          changedById: user.id,
          fieldChanges: JSON.stringify({
            categoria: { before: null, after: categoria.nombre },
            monto: { before: null, after: d.monto },
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

export async function eliminarGastoParte(gastoId: string): Promise<ActionResult> {
  try {
    const user = await requireSesion();
    const gasto = await prisma.parteTurnoGasto.findUnique({
      where: { id: gastoId },
      include: {
        categoria: { select: { nombre: true } },
        parteTurno: { select: { estado: true, businessDayId: true } },
      },
    });
    if (!gasto) return { ok: false, error: "Gasto no encontrado" };
    assertEditable(gasto.parteTurno.estado);

    await prisma.$transaction([
      prisma.parteTurnoGasto.delete({ where: { id: gastoId } }),
      prisma.auditLog.create({
        data: {
          businessDayId: gasto.parteTurno.businessDayId,
          action: "PARTE_TURNO_GASTO_DELETE",
          changedById: user.id,
          fieldChanges: JSON.stringify({
            categoria: { before: gasto.categoria.nombre, after: null },
            monto: { before: gasto.monto, after: null },
          }),
        },
      }),
    ]);

    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado" };
  }
}

const facturaSchema = turnoSchema.extend({
  proveedorId: z.string().min(1, "Elige un proveedor"),
  monto: z.number().int().positive("El monto debe ser mayor a cero"),
  descripcion: z.string().max(300).optional(),
  metodoPago: z.enum(METODOS_PAGO_ITEM_MANUAL).optional(),
});

export async function agregarFacturaParte(
  input: z.infer<typeof facturaSchema>
): Promise<ActionResult> {
  try {
    const user = await requireSesion();
    const d = facturaSchema.parse(input);
    const date = fechaPermitida(user.role, d.date);
    const day = await getOrCreateDay(date, d.shift);

    const proveedor = await prisma.proveedor.findUnique({ where: { id: d.proveedorId } });
    if (!proveedor) return { ok: false, error: "Proveedor no encontrado" };

    await prisma.$transaction(async (tx) => {
      const parte = await ensureParte(tx, day.id, user.id);
      assertEditable(parte.estado);
      await tx.parteTurnoFactura.create({
        data: {
          parteTurnoId: parte.id,
          proveedorId: d.proveedorId,
          monto: d.monto,
          descripcion: d.descripcion,
          metodoPago: d.metodoPago,
        },
      });
      await tx.auditLog.create({
        data: {
          businessDayId: day.id,
          action: "PARTE_TURNO_FACTURA_ADD",
          changedById: user.id,
          fieldChanges: JSON.stringify({
            proveedor: { before: null, after: proveedor.nombre },
            monto: { before: null, after: d.monto },
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

export async function eliminarFacturaParte(facturaId: string): Promise<ActionResult> {
  try {
    const user = await requireSesion();
    const factura = await prisma.parteTurnoFactura.findUnique({
      where: { id: facturaId },
      include: {
        proveedorRef: { select: { nombre: true } },
        parteTurno: { select: { estado: true, businessDayId: true } },
      },
    });
    if (!factura) return { ok: false, error: "Factura no encontrada" };
    assertEditable(factura.parteTurno.estado);

    await prisma.$transaction([
      prisma.parteTurnoFactura.delete({ where: { id: facturaId } }),
      prisma.auditLog.create({
        data: {
          businessDayId: factura.parteTurno.businessDayId,
          action: "PARTE_TURNO_FACTURA_DELETE",
          changedById: user.id,
          fieldChanges: JSON.stringify({
            proveedor: { before: factura.proveedorRef.nombre, after: null },
            monto: { before: factura.monto, after: null },
          }),
        },
      }),
    ]);

    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado" };
  }
}

// La vendedora cierra su parte y se lo manda al administrador. A partir de aquí no lo puede
// tocar; si necesita corregir algo, el admin se lo devuelve.
export async function enviarParteTurno(
  input: z.infer<typeof turnoSchema>
): Promise<ActionResult> {
  try {
    const user = await requireSesion();
    const d = turnoSchema.parse(input);
    const date = fechaPermitida(user.role, d.date);

    const day = await prisma.businessDay.findUnique({
      where: { date_shift: { date, shift: d.shift } },
    });
    if (!day) return { ok: false, error: "Aún no has registrado nada en el parte" };

    const parte = await prisma.parteTurno.findUnique({ where: { businessDayId: day.id } });
    if (!parte) return { ok: false, error: "Aún no has registrado nada en el parte" };
    assertEditable(parte.estado);

    await prisma.$transaction([
      prisma.parteTurno.update({
        where: { id: parte.id },
        data: { estado: "ENVIADO", enviadoAt: new Date(), notaAdmin: null },
      }),
      prisma.auditLog.create({
        data: {
          businessDayId: day.id,
          action: "PARTE_TURNO_ENVIAR",
          changedById: user.id,
          fieldChanges: JSON.stringify({
            estado: { before: parte.estado, after: "ENVIADO" },
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
