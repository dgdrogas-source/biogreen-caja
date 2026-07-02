"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export type ActionResult = { ok: true } | { ok: false; error: string };

const nameSchema = z.string().trim().min(1, "El nombre no puede estar vacío").max(40);
const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "El usuario debe tener al menos 3 caracteres")
  .max(30)
  .regex(/^[a-z0-9._-]+$/, "Solo letras, números, punto, guion y guion bajo (sin espacios)");
const passwordSchema = z.string().min(4, "La contraseña debe tener al menos 4 caracteres").max(72);

// Devuelve el id del administrador en sesión, o null si no está autorizado.
async function getAdminId(): Promise<string | null> {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") return null;
  return session.user.id;
}

export async function saveSellerProfile(
  userId: string,
  name: string,
  username: string,
  isActive: boolean
): Promise<ActionResult> {
  try {
    const adminId = await getAdminId();
    if (!adminId) return { ok: false, error: "Solo el administrador puede gestionar usuarios" };

    // Solo se pueden gestionar vendedoras (WORKER), no otros administradores.
    const seller = await prisma.user.findUnique({ where: { id: userId } });
    if (!seller || seller.role !== "WORKER")
      return { ok: false, error: "Vendedora no encontrada" };

    const newName = nameSchema.parse(name);
    const newUsername = usernameSchema.parse(username);

    const clash = await prisma.user.findUnique({ where: { username: newUsername } });
    if (clash && clash.id !== userId)
      return { ok: false, error: `El usuario "${newUsername}" ya está en uso` };

    const changes: Record<string, { before: unknown; after: unknown }> = {};
    if (seller.name !== newName) changes.nombre = { before: seller.name, after: newName };
    if (seller.username !== newUsername)
      changes.usuario = { before: seller.username, after: newUsername };
    if (seller.isActive !== isActive)
      changes.acceso = {
        before: seller.isActive ? "activo" : "inactivo",
        after: isActive ? "activo" : "inactivo",
      };

    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: { name: newName, username: newUsername, isActive },
      }),
      prisma.auditLog.create({
        data: {
          action: "USER_PROFILE",
          changedById: adminId,
          fieldChanges: JSON.stringify({ vendedora: newName, ...changes }),
        },
      }),
    ]);

    revalidatePath("/usuarios");
    return { ok: true };
  } catch (e) {
    if (e instanceof z.ZodError) return { ok: false, error: e.issues[0]?.message ?? "Datos inválidos" };
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado" };
  }
}

export async function resetSellerPassword(
  userId: string,
  password: string
): Promise<ActionResult> {
  try {
    const adminId = await getAdminId();
    if (!adminId) return { ok: false, error: "Solo el administrador puede gestionar usuarios" };

    const seller = await prisma.user.findUnique({ where: { id: userId } });
    if (!seller || seller.role !== "WORKER")
      return { ok: false, error: "Vendedora no encontrada" };

    const newPassword = passwordSchema.parse(password);
    const passwordHash = await bcrypt.hash(newPassword, 10);

    await prisma.$transaction([
      prisma.user.update({ where: { id: userId }, data: { passwordHash } }),
      prisma.auditLog.create({
        data: {
          action: "USER_PASSWORD",
          changedById: adminId,
          // Nunca se guarda la contraseña, solo el hecho del cambio.
          fieldChanges: JSON.stringify({ vendedora: seller.name, contraseña: "cambiada" }),
        },
      }),
    ]);

    revalidatePath("/usuarios");
    return { ok: true };
  } catch (e) {
    if (e instanceof z.ZodError) return { ok: false, error: e.issues[0]?.message ?? "Datos inválidos" };
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado" };
  }
}
