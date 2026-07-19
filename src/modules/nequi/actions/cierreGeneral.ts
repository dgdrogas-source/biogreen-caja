"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getOrCreateDay } from "../server/businessDay";
import {
  CATEGORIA_COMISION_TARJETA,
  COMISION_TARJETA,
  METODOS_PAGO_ITEM,
} from "../types";

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
  retiroCierre: nonNeg,
  descuadre: z.number().int().nullable().optional(), // puede ser negativo (falta)
  nota: z.string().max(300).optional(),
});

export type CierreGeneralInputAction = z.infer<typeof schema>;

// Guarda (crea o actualiza) el cierre general del turno. Solo admin, auditado.
// facturasPagadas/gastosVarios (Fase 1) ya NO se escriben aquí: Fase 2 los reemplaza por
// items itemizados (agregarGastoCierre/agregarFacturaCierre) — sus totales se calculan
// leyendo esos items (ver getCierreGeneralItems/sumarConFallback).
export async function guardarCierreGeneral(input: CierreGeneralInputAction): Promise<ActionResult> {
  try {
    const user = await requireAdmin();
    const d = schema.parse(input);
    const day = await getOrCreateDay(d.date, d.shift);

    // Congela el % de reposición vigente en este cierre (historial inmutable ante cambios
    // futuros del ajuste global). Re-guardar el turno re-snapshotea al % actual.
    const cfg = await prisma.cierreGeneralConfig.findUnique({ where: { id: 1 } });
    const porcentajeReposicion = cfg?.porcentajeReposicion ?? 70;

    const data = {
      porcentajeReposicion,
      ventaEfectivo: d.ventaEfectivo,
      ventaNequi: d.ventaNequi,
      ventaTarjeta: d.ventaTarjeta,
      ventaDaviplata: d.ventaDaviplata,
      ventaTransferencia: d.ventaTransferencia,
      ventaCredito: d.ventaCredito,
      ventaOtro: d.ventaOtro,
      ventaSinFactura: d.ventaSinFactura,
      realEfectivo: d.realEfectivo ?? null,
      retiroCierre: d.retiroCierre,
      descuadre: d.descuadre ?? null,
      nota: d.nota ?? null,
    };

    // Comisión del 4% de tarjeta como gasto AUTOMÁTICO (método DESCONTADO_ORIGEN: cuenta como
    // gasto pero no sale de ninguna plataforma). Se re-ajusta de forma determinista al re-guardar:
    // un único gasto autoGenerado por cierre, que se crea / actualiza / borra según la venta de
    // tarjeta. Por eso la transacción es interactiva (necesita el id del cierre).
    const montoComision = Math.round(d.ventaTarjeta * COMISION_TARJETA);

    await prisma.$transaction(async (tx) => {
      const cierre = await tx.cierreGeneral.upsert({
        where: { businessDayId: day.id },
        update: data,
        create: { businessDayId: day.id, createdById: user.id, ...data },
      });

      const autoExistente = await tx.cierreGeneralGasto.findFirst({
        where: { cierreGeneralId: cierre.id, autoGenerado: true },
      });

      if (montoComision > 0) {
        const categoria = await tx.categoriaGasto.upsert({
          where: { nombre: CATEGORIA_COMISION_TARJETA },
          update: {},
          create: { nombre: CATEGORIA_COMISION_TARJETA },
        });
        if (autoExistente) {
          await tx.cierreGeneralGasto.update({
            where: { id: autoExistente.id },
            data: { monto: montoComision, categoriaId: categoria.id, metodoPago: "DESCONTADO_ORIGEN" },
          });
        } else {
          await tx.cierreGeneralGasto.create({
            data: {
              cierreGeneralId: cierre.id,
              categoriaId: categoria.id,
              monto: montoComision,
              metodoPago: "DESCONTADO_ORIGEN",
              autoGenerado: true,
              descripcion: "4% de comisión sobre ventas con tarjeta (automático)",
            },
          });
        }
      } else if (autoExistente) {
        // Ya no hay venta de tarjeta: se retira el gasto automático.
        await tx.cierreGeneralGasto.delete({ where: { id: autoExistente.id } });
      }

      await tx.auditLog.create({
        data: {
          businessDayId: day.id,
          action: "CIERRE_GENERAL",
          changedById: user.id,
          fieldChanges: JSON.stringify({
            turno: { before: null, after: `${d.date} · Turno ${d.shift}` },
            comisionTarjeta: { before: null, after: montoComision },
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

const turnoSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida"),
  shift: z.union([z.literal(1), z.literal(2)]),
});

// Crea el CierreGeneral "cascarón" del turno si aún no existe (mismo upsert vacío que
// guardarCierreGeneral usa implícitamente), para poder colgarle un gasto/factura antes de
// haber guardado el resto del formulario.
async function ensureCierreGeneral(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  businessDayId: string,
  createdById: string
) {
  await tx.cierreGeneral.upsert({
    where: { businessDayId },
    update: {},
    create: { businessDayId, createdById },
  });
  return tx.cierreGeneral.findUniqueOrThrow({ where: { businessDayId } });
}

const agregarGastoSchema = turnoSchema.extend({
  categoriaId: z.string(),
  monto: z.number().int().positive("El monto debe ser mayor a cero"),
  descripcion: z.string().max(300).optional(),
  metodoPago: z.enum(METODOS_PAGO_ITEM).optional(),
  proveedorId: z.string().optional(),
});

// Agrega un gasto itemizado (categoría + monto) al cierre del turno. Reemplaza el input
// directo CierreGeneral.gastosVarios (deprecado). Solo admin, auditado.
export async function agregarGastoCierre(
  input: z.infer<typeof agregarGastoSchema>
): Promise<ActionResult> {
  try {
    const user = await requireAdmin();
    const d = agregarGastoSchema.parse(input);
    const day = await getOrCreateDay(d.date, d.shift);

    const categoria = await prisma.categoriaGasto.findUnique({ where: { id: d.categoriaId } });
    if (!categoria) return { ok: false, error: "Categoría no encontrada" };

    if (d.proveedorId) {
      const proveedor = await prisma.proveedor.findUnique({ where: { id: d.proveedorId } });
      if (!proveedor) return { ok: false, error: "Proveedor no encontrado" };
    }

    await prisma.$transaction(async (tx) => {
      const cierre = await ensureCierreGeneral(tx, day.id, user.id);
      await tx.cierreGeneralGasto.create({
        data: {
          cierreGeneralId: cierre.id,
          categoriaId: d.categoriaId,
          monto: d.monto,
          descripcion: d.descripcion,
          metodoPago: d.metodoPago,
          proveedorId: d.proveedorId,
        },
      });
      await tx.auditLog.create({
        data: {
          businessDayId: day.id,
          action: "CIERRE_GENERAL_GASTO_ADD",
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

export async function eliminarGastoCierre(gastoId: string): Promise<ActionResult> {
  try {
    const user = await requireAdmin();
    const gasto = await prisma.cierreGeneralGasto.findUnique({
      where: { id: gastoId },
      include: { categoria: true, cierreGeneral: { select: { businessDayId: true } } },
    });
    if (!gasto) return { ok: false, error: "Gasto no encontrado" };

    await prisma.$transaction([
      prisma.cierreGeneralGasto.delete({ where: { id: gastoId } }),
      prisma.auditLog.create({
        data: {
          businessDayId: gasto.cierreGeneral.businessDayId,
          action: "CIERRE_GENERAL_GASTO_DELETE",
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

const agregarFacturaSchema = turnoSchema.extend({
  proveedor: z.string().max(120).optional(), // @deprecated — legado de texto libre
  proveedorId: z.string().optional(),
  monto: z.number().int().positive("El monto debe ser mayor a cero"),
  descripcion: z.string().max(300).optional(),
  metodoPago: z.enum(METODOS_PAGO_ITEM).optional(),
});

// Agrega una factura de proveedor pagada (itemizada) al cierre del turno. Reemplaza el
// input directo CierreGeneral.facturasPagadas (deprecado). Solo admin, auditado.
export async function agregarFacturaCierre(
  input: z.infer<typeof agregarFacturaSchema>
): Promise<ActionResult> {
  try {
    const user = await requireAdmin();
    const d = agregarFacturaSchema.parse(input);
    const day = await getOrCreateDay(d.date, d.shift);

    if (d.proveedorId) {
      const proveedor = await prisma.proveedor.findUnique({ where: { id: d.proveedorId } });
      if (!proveedor) return { ok: false, error: "Proveedor no encontrado" };
    }

    await prisma.$transaction(async (tx) => {
      const cierre = await ensureCierreGeneral(tx, day.id, user.id);
      await tx.cierreGeneralFactura.create({
        data: {
          cierreGeneralId: cierre.id,
          proveedor: d.proveedor,
          proveedorId: d.proveedorId,
          monto: d.monto,
          descripcion: d.descripcion,
          metodoPago: d.metodoPago,
        },
      });
      await tx.auditLog.create({
        data: {
          businessDayId: day.id,
          action: "CIERRE_GENERAL_FACTURA_ADD",
          changedById: user.id,
          fieldChanges: JSON.stringify({
            proveedor: { before: null, after: d.proveedor ?? "—" },
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

export async function eliminarFacturaCierre(facturaId: string): Promise<ActionResult> {
  try {
    const user = await requireAdmin();
    const factura = await prisma.cierreGeneralFactura.findUnique({
      where: { id: facturaId },
      include: { cierreGeneral: { select: { businessDayId: true } } },
    });
    if (!factura) return { ok: false, error: "Factura no encontrada" };

    await prisma.$transaction([
      prisma.cierreGeneralFactura.delete({ where: { id: facturaId } }),
      prisma.auditLog.create({
        data: {
          businessDayId: factura.cierreGeneral.businessDayId,
          action: "CIERRE_GENERAL_FACTURA_DELETE",
          changedById: user.id,
          fieldChanges: JSON.stringify({
            proveedor: { before: factura.proveedor ?? "—", after: null },
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

const consignadoSchema = turnoSchema.extend({ consignado: z.boolean() });

// Marca/desmarca manualmente si ya se hizo la consignación pendiente del turno
// (alimenta la alerta PENDIENTE_CONSIGNAR). Solo admin, auditado.
export async function marcarConsignado(
  input: z.infer<typeof consignadoSchema>
): Promise<ActionResult> {
  try {
    const user = await requireAdmin();
    const d = consignadoSchema.parse(input);
    const day = await getOrCreateDay(d.date, d.shift);

    await prisma.$transaction(async (tx) => {
      await tx.cierreGeneral.upsert({
        where: { businessDayId: day.id },
        update: { consignado: d.consignado },
        create: { businessDayId: day.id, createdById: user.id, consignado: d.consignado },
      });
      await tx.auditLog.create({
        data: {
          businessDayId: day.id,
          action: "CIERRE_GENERAL_CONSIGNADO",
          changedById: user.id,
          fieldChanges: JSON.stringify({ consignado: { before: !d.consignado, after: d.consignado } }),
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
