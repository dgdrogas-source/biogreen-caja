import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function hash(pw: string) {
  return bcrypt.hash(pw, 10);
}

async function main() {
  // Administrador (dueño). Se actualiza el nombre por si venía como "Dueño".
  await prisma.user.upsert({
    where: { username: "admin" },
    update: { name: "Administrador", role: "ADMIN" },
    create: {
      username: "admin",
      name: "Administrador",
      passwordHash: await hash("admin2026"),
      role: "ADMIN",
    },
  });

  // Migrar las trabajadoras antiguas a la nueva nomenclatura de vendedoras.
  const renames: Array<[string, string, string]> = [
    ["trabajadora1", "vendedora1", "Vendedora 1"],
    ["trabajadora2", "vendedora2", "Vendedora 2"],
  ];
  for (const [oldUser, newUser, newName] of renames) {
    const existing = await prisma.user.findUnique({ where: { username: oldUser } });
    if (existing && !(await prisma.user.findUnique({ where: { username: newUser } }))) {
      await prisma.user.update({
        where: { id: existing.id },
        data: { username: newUser, name: newName },
      });
    }
  }

  // 4 vendedoras (contraseñas provisionales; el administrador las cambia desde el gestor de usuarios).
  for (let i = 1; i <= 4; i++) {
    await prisma.user.upsert({
      where: { username: `vendedora${i}` },
      update: {},
      create: {
        username: `vendedora${i}`,
        name: `Vendedora ${i}`,
        passwordHash: await hash(`ventas${i}`),
        role: "WORKER",
      },
    });
  }

  // Base de trabajo inicial: todo del lado Nequi (el administrador la reajusta luego).
  await prisma.baseFund.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, cashPortion: 0, nequiPortion: 1_110_000 },
  });

  // Saldo inicial real del bolsillo Comisiones (ajuste puntual del dueño, no un movimiento).
  // update: {} para no pisar un ajuste posterior hecho manualmente.
  await prisma.pocketBalance.upsert({
    where: { bucket: "COMISION" },
    update: {},
    create: { bucket: "COMISION", openingBalance: 42_960 },
  });

  // Horarios por defecto de los 2 turnos (editables desde Configuración).
  // update: {} para no pisar horarios ya ajustados por el administrador.
  await prisma.shiftConfig.upsert({
    where: { shift: 1 },
    update: {},
    create: { shift: 1, startTime: "06:00", endTime: "13:00" },
  });
  await prisma.shiftConfig.upsert({
    where: { shift: 2 },
    update: {},
    create: { shift: 2, startTime: "13:00", endTime: "20:00" },
  });

  console.log("Seed listo: administrador + vendedora1..4 + base $1.110.000 + horarios de turnos");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
