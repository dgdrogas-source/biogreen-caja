"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { METODOS_PAGO_ITEM_MANUAL, PROVEEDOR_TIPOS, type MetodoPagoItem, type ProveedorTipo } from "../types";

export type ActionResult = { ok: true; mensaje?: string } | { ok: false; error: string };

async function requireAdmin() {
  const session = await auth();
  if (!session?.user) throw new Error("No autorizado");
  if (session.user.role !== "ADMIN") throw new Error("Solo el administrador puede hacer esto");
  return session.user;
}

const nombreSchema = z.string().trim().min(1, "Escribe un nombre").max(80, "Máximo 80 caracteres");
const tipoSchema = z.enum(PROVEEDOR_TIPOS);
// z.enum necesita una tupla literal (no un array filtrado); se valida contra el set real
// con .refine para no duplicar la lista de METODOS_PAGO_ITEM_MANUAL.
const medioPagoHabitualSchema = z
  .string()
  .nullable()
  .refine((m) => m === null || (METODOS_PAGO_ITEM_MANUAL as readonly string[]).includes(m), {
    message: "Método de pago inválido",
  });

// Crea un proveedor (nombre + tipo + medio de pago habitual opcional). Si existe uno
// desactivado con el mismo nombre+tipo, lo reactiva en vez de duplicar (mismo patrón que
// CategoriaGasto).
export async function crearProveedor(input: {
  nombre: string;
  tipo: ProveedorTipo;
  medioPagoHabitual?: string | null;
}): Promise<ActionResult> {
  try {
    const user = await requireAdmin();
    const nombre = nombreSchema.parse(input.nombre);
    const tipo = tipoSchema.parse(input.tipo);
    const medioPagoHabitual = medioPagoHabitualSchema.parse(input.medioPagoHabitual ?? null);

    const existing = await prisma.proveedor.findUnique({ where: { nombre_tipo: { nombre, tipo } } });
    if (existing?.activa) return { ok: false, error: "Ese proveedor ya existe" };

    if (existing) {
      await prisma.$transaction([
        prisma.proveedor.update({
          where: { id: existing.id },
          data: { activa: true, medioPagoHabitual },
        }),
        prisma.auditLog.create({
          data: {
            action: "PROVEEDOR_CREATE",
            changedById: user.id,
            fieldChanges: JSON.stringify({ proveedor: { before: null, after: `${nombre} (${tipo})` } }),
          },
        }),
      ]);
      revalidatePath("/", "layout");
      return { ok: true };
    }

    await prisma.$transaction([
      prisma.proveedor.create({ data: { nombre, tipo, medioPagoHabitual } }),
      prisma.auditLog.create({
        data: {
          action: "PROVEEDOR_CREATE",
          changedById: user.id,
          fieldChanges: JSON.stringify({ proveedor: { before: null, after: `${nombre} (${tipo})` } }),
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

// Cambia el medio de pago habitual de un proveedor ya existente (null = sin definir, no
// pre-selecciona nada al registrar un gasto/factura de ese proveedor).
export async function ajustarMedioPagoProveedor(
  id: string,
  medioPagoHabitual: MetodoPagoItem | null
): Promise<ActionResult> {
  try {
    const user = await requireAdmin();
    const medio = medioPagoHabitualSchema.parse(medioPagoHabitual);

    const proveedor = await prisma.proveedor.findUnique({ where: { id } });
    if (!proveedor) return { ok: false, error: "Proveedor no encontrado" };

    await prisma.$transaction([
      prisma.proveedor.update({ where: { id }, data: { medioPagoHabitual: medio } }),
      prisma.auditLog.create({
        data: {
          action: "PROVEEDOR_MEDIO_PAGO",
          changedById: user.id,
          fieldChanges: JSON.stringify({
            medioPagoHabitual: { before: proveedor.medioPagoHabitual, after: medio },
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

// Renombra un proveedor existente (mismo tipo). Rechaza si el nuevo nombre ya está en uso
// por otro proveedor activo del mismo tipo.
export async function renombrarProveedor(id: string, nombre: string): Promise<ActionResult> {
  try {
    const user = await requireAdmin();
    const nuevoNombre = nombreSchema.parse(nombre);

    const proveedor = await prisma.proveedor.findUnique({ where: { id } });
    if (!proveedor) return { ok: false, error: "Proveedor no encontrado" };

    const duplicado = await prisma.proveedor.findUnique({
      where: { nombre_tipo: { nombre: nuevoNombre, tipo: proveedor.tipo } },
    });
    if (duplicado && duplicado.id !== id && duplicado.activa) {
      return { ok: false, error: "Ya existe un proveedor con ese nombre" };
    }

    await prisma.$transaction([
      prisma.proveedor.update({ where: { id }, data: { nombre: nuevoNombre } }),
      prisma.auditLog.create({
        data: {
          action: "PROVEEDOR_RENAME",
          changedById: user.id,
          fieldChanges: JSON.stringify({ nombre: { before: proveedor.nombre, after: nuevoNombre } }),
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

// "Eliminar" desactiva si el proveedor ya tiene facturas/gastos asociados (protege el
// histórico); se borra físicamente solo si nunca se usó.
export async function eliminarProveedor(id: string): Promise<ActionResult> {
  try {
    const user = await requireAdmin();

    const proveedor = await prisma.proveedor.findUnique({ where: { id } });
    if (!proveedor) return { ok: false, error: "Proveedor no encontrado" };

    const [enFacturas, enGastos] = await Promise.all([
      prisma.cierreGeneralFactura.count({ where: { proveedorId: id } }),
      prisma.cierreGeneralGasto.count({ where: { proveedorId: id } }),
    ]);
    const enUso = enFacturas + enGastos;

    if (enUso > 0) {
      await prisma.$transaction([
        prisma.proveedor.update({ where: { id }, data: { activa: false } }),
        prisma.auditLog.create({
          data: {
            action: "PROVEEDOR_DEACTIVATE",
            changedById: user.id,
            fieldChanges: JSON.stringify({ proveedor: { before: proveedor.nombre, after: null } }),
          },
        }),
      ]);
      revalidatePath("/", "layout");
      return { ok: true, mensaje: "Tiene facturas o gastos registrados: se desactivó en vez de borrarse" };
    }

    await prisma.$transaction([
      prisma.proveedor.delete({ where: { id } }),
      prisma.auditLog.create({
        data: {
          action: "PROVEEDOR_DELETE",
          changedById: user.id,
          fieldChanges: JSON.stringify({ proveedor: { before: proveedor.nombre, after: null } }),
        },
      }),
    ]);

    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado" };
  }
}
