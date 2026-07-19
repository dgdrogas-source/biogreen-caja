"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { todayBogota } from "@/lib/dates";
import { requireUser } from "@/lib/permissions";
import { calcularStock, costoUnitarioPromedio, puedeVender } from "../calculations/inventario";
import {
  borrarMovementLigado,
  crearMovementLigado,
  resolverTurnoAbierto,
  turnoDelMovementAbierto,
} from "../server/movementLink";
import { afectaCuadreNequi, LICOR_MEDIOS_PAGO, type ActionResult } from "../types";

const ventaSchema = z.object({
  productoId: z.string().min(1, "Elige la cerveza"),
  cantidad: z.number().int().positive("La cantidad debe ser mayor a cero"),
  precioUnitario: z.number().int().positive("El precio debe ser mayor a cero"),
  metodoPago: z.enum(LICOR_MEDIOS_PAGO),
  shift: z.union([z.literal(1), z.literal(2)]),
  nota: z.string().trim().max(300).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida").optional(), // solo admin
  // Obligatorio solo si se fía: hay que saber a quién cobrarle (cartera propia de licores).
  clienteId: z.string().optional(),
});

export type VentaLicorInput = z.infer<typeof ventaSchema>;

function revalidateAll() {
  revalidatePath("/", "layout");
}

// Stock y costo unitario vigentes de un producto (mismas fuentes que usa la página del admin).
async function estadoActual(productoId: string) {
  const [compras, ventas] = await Promise.all([
    prisma.licorCompra.findMany({
      where: { productoId, deletedAt: null },
      select: { cantidad: true, valorTotal: true },
    }),
    prisma.licorVenta.findMany({
      where: { productoId, deletedAt: null },
      select: { cantidad: true, precioUnitario: true, costoUnitario: true, metodoPago: true },
    }),
  ]);
  return {
    stock: calcularStock(
      compras,
      ventas.map((v) => ({ ...v, esCredito: v.metodoPago === "CREDITO" }))
    ),
    costoUnitario: costoUnitarioPromedio(compras),
  };
}

// Registra una venta de cerveza (vendedora o admin), desde el pop-up de "Venta Licores Jhoann".
// Si se cobró por Nequi o Efectivo, crea ADEMÁS el ingreso en el cuadre Nequi — una sola vez.
// Con tarjeta/Daviplata/transferencia/crédito la plata no pasa por la caja Nequi: solo Licores.
export async function registrarVentaLicor(input: VentaLicorInput): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const data = ventaSchema.parse(input);

    const hoy = todayBogota();
    // La fecha solo la puede fijar el admin (cargar una venta de un día anterior).
    const date = data.date && user.role === "ADMIN" && data.date <= hoy ? data.date : hoy;

    const producto = await prisma.licorProducto.findUnique({ where: { id: data.productoId } });
    if (!producto) return { ok: false, error: "Cerveza no encontrada" };
    if (!producto.activo) return { ok: false, error: `"${producto.nombre}" ya no está disponible` };

    // Fiar sin cliente dejaría una deuda que nadie sabe a quién cobrar.
    if (data.metodoPago === "CREDITO") {
      if (!data.clienteId) return { ok: false, error: "Elige a quién le estás fiando" };
      const cliente = await prisma.licorCliente.findUnique({ where: { id: data.clienteId } });
      if (!cliente || !cliente.activo) return { ok: false, error: "Cliente no encontrado" };
    }

    // Regla dura del dueño: si no hay stock, NO se vende.
    const { stock, costoUnitario } = await estadoActual(data.productoId);
    if (!puedeVender(stock, data.cantidad)) {
      return {
        ok: false,
        error:
          stock <= 0
            ? `No queda stock de ${producto.nombre}. Registra una compra antes de vender.`
            : `Solo quedan ${stock} unidades de ${producto.nombre}.`,
      };
    }

    let businessDayId: string | null = null;
    if (afectaCuadreNequi(data.metodoPago)) {
      const turno = await resolverTurnoAbierto(date, data.shift);
      if (!turno.ok) return turno;
      businessDayId = turno.businessDayId;
    }

    const total = data.precioUnitario * data.cantidad;
    const conDescuento = data.precioUnitario !== producto.precioVenta;

    await prisma.$transaction(async (tx) => {
      const movementId = businessDayId
        ? await crearMovementLigado(tx, {
            businessDayId,
            type: "VENTA_LICORES_JHOANN",
            direction: "INCOME",
            amount: total,
            paymentMethod: data.metodoPago as "NEQUI" | "EFECTIVO",
            // Igual que hoy: una venta de licor alimenta su bolsillo automáticamente.
            pettyCashBucket: "LICORES_JHOANN",
            note: `${data.cantidad} × ${producto.nombre}`,
            userId: user.id,
          })
        : null;

      const venta = await tx.licorVenta.create({
        data: {
          productoId: data.productoId,
          date,
          shift: data.shift,
          cantidad: data.cantidad,
          precioUnitario: data.precioUnitario,
          costoUnitario, // congelado: el margen histórico no cambia si después sube el costo
          metodoPago: data.metodoPago,
          descuento: conDescuento,
          movementId,
          clienteId: data.metodoPago === "CREDITO" ? data.clienteId : null,
          nota: data.nota || null,
          createdById: user.id,
        },
      });

      await tx.auditLog.create({
        data: {
          action: "LICOR_VENTA_CREATE",
          changedById: user.id,
          fieldChanges: JSON.stringify({
            venta: {
              before: null,
              after: `${data.cantidad} × ${producto.nombre} a $${data.precioUnitario.toLocaleString("es-CO")} c/u`,
            },
            medioPago: { before: null, after: data.metodoPago },
            ...(conDescuento
              ? { precioAjustado: { before: producto.precioVenta, after: data.precioUnitario } }
              : {}),
            ligadoACuadreNequi: { before: null, after: movementId ? "sí" : "no" },
            id: { before: null, after: venta.id },
          }),
        },
      });
    });

    revalidateAll();
    return { ok: true };
  } catch (e) {
    if (e instanceof z.ZodError) return { ok: false, error: e.issues[0]?.message ?? "Datos inválidos" };
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado" };
  }
}

// Borra una venta y su ingreso ligado en el cuadre Nequi. Permisos (confirmados 2026-07-19,
// mismo patrón que los movimientos de Nequi): el admin borra cualquiera, cualquier día; la
// vendedora solo las suyas y solo del día de hoy.
export async function eliminarVentaLicor(id: string): Promise<ActionResult> {
  try {
    const user = await requireUser();

    const venta = await prisma.licorVenta.findUnique({
      where: { id },
      include: { producto: { select: { nombre: true } } },
    });
    if (!venta || venta.deletedAt) return { ok: false, error: "Venta no encontrada" };
    if (venta.licorCierreId)
      return {
        ok: false,
        error: "Esa venta ya entró en un cierre de licores. Deshaz el cierre para poder borrarla.",
      };

    if (user.role !== "ADMIN") {
      if (venta.createdById !== user.id)
        return { ok: false, error: "Solo puedes borrar tus propias ventas" };
      if (venta.date !== todayBogota())
        return { ok: false, error: "Solo puedes borrar ventas del día de hoy" };
    }

    if (!(await turnoDelMovementAbierto(venta.movementId))) {
      return {
        ok: false,
        error: "El turno donde se registró esta venta en Nequi está cerrado. Reábrelo primero.",
      };
    }

    await prisma.$transaction(async (tx) => {
      await tx.licorVenta.update({ where: { id }, data: { deletedAt: new Date() } });
      await borrarMovementLigado(tx, venta.movementId, user.id);
      await tx.auditLog.create({
        data: {
          action: "LICOR_VENTA_DELETE",
          changedById: user.id,
          fieldChanges: JSON.stringify({
            venta: {
              before: `${venta.cantidad} × ${venta.producto.nombre} a $${venta.precioUnitario.toLocaleString("es-CO")} c/u`,
              after: null,
            },
          }),
        },
      });
    });

    revalidateAll();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado" };
  }
}
