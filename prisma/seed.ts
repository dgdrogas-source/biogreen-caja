import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// Usuarios iniciales — contraseñas provisionales, cambiarlas tras el primer ingreso.
const users = [
  { username: "admin", name: "Dueño", password: "admin2026", role: "ADMIN" },
  { username: "trabajadora1", name: "Trabajadora 1", password: "farmacia1", role: "WORKER" },
  { username: "trabajadora2", name: "Trabajadora 2", password: "farmacia2", role: "WORKER" },
];

async function main() {
  for (const u of users) {
    await prisma.user.upsert({
      where: { username: u.username },
      update: {},
      create: {
        username: u.username,
        name: u.name,
        passwordHash: await bcrypt.hash(u.password, 10),
        role: u.role,
      },
    });
  }
  console.log("Seed listo: admin, trabajadora1, trabajadora2");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
