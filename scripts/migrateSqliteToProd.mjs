/**
 * Copia los datos REALES desde el SQLite local (prisma/dev.db) a Postgres PROD (Neon).
 * Uso:
 *   PROD_URL="postgresql://..." node --experimental-sqlite scripts/migrateSqliteToProd.mjs
 *
 * SQLite (Prisma) guarda:
 *   - booleanos como 0/1  → se convierten a true/false
 *   - fechas como epoch ms (entero) → se convierten a ISO UTC (string) para el timestamp de Postgres
 * Preserva IDs, fechas y relaciones. Inserta en orden de dependencias (padres → hijos);
 * los movimientos se insertan topológicamente por su auto-referencia (4x1000 / comisión).
 */

import { DatabaseSync } from "node:sqlite";
import pg from "pg";

const PROD_URL = process.env.PROD_URL;
if (!PROD_URL) {
  console.error("❌ Falta PROD_URL. Uso: PROD_URL='postgresql://...' node --experimental-sqlite scripts/migrateSqliteToProd.mjs");
  process.exit(1);
}

// epoch ms (int) → ISO UTC string (o null). Postgres timestamp interpreta el ISO como UTC,
// igual que la convención de Prisma; así se preserva el instante exacto sin desfase horario.
const toISO = (ms) => (ms === null || ms === undefined ? null : new Date(Number(ms)).toISOString());
// SQLite guarda booleanos como 0/1; Postgres necesita boolean real.
const toBool = (v) => v === 1 || v === true;

async function main() {
  console.log("🔄 Copiando datos REALES: SQLite (prisma/dev.db) → PROD (Neon)...\n");

  const sqlite = new DatabaseSync("prisma/dev.db");
  const prod = new pg.Pool({ connectionString: PROD_URL });

  const readAll = (table) => sqlite.prepare(`SELECT * FROM "${table}"`).all();

  try {
    // 1. Limpiar PROD en orden hijos → padres (sin desactivar triggers; Neon no lo permite).
    console.log("🗑️  Limpiando PROD (orden hijos → padres)...");
    for (const t of ["AuditLog", "Movement", "PocketTransfer", "BusinessDay", "PocketBalance", "BaseFund", "User"]) {
      await prod.query(`DELETE FROM "${t}"`);
    }

    // 2. User
    const users = readAll("User");
    console.log(`\n📤 Insertando en PROD:`);
    console.log(`  → ${users.length} usuarios`);
    for (const u of users) {
      await prod.query(
        `INSERT INTO "User" (id, username, name, "passwordHash", role, "isActive", "createdAt")
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [u.id, u.username, u.name, u.passwordHash, u.role, toBool(u.isActive), toISO(u.createdAt)]
      );
    }

    // 3. BaseFund
    const baseFunds = readAll("BaseFund");
    console.log(`  → ${baseFunds.length} BaseFund`);
    for (const b of baseFunds) {
      await prod.query(
        `INSERT INTO "BaseFund" (id, "cashPortion", "nequiPortion", "updatedAt")
         VALUES ($1,$2,$3,$4)`,
        [b.id, b.cashPortion, b.nequiPortion, toISO(b.updatedAt)]
      );
    }

    // 4. PocketBalance
    const pocketBalances = readAll("PocketBalance");
    console.log(`  → ${pocketBalances.length} saldos iniciales de bolsillos`);
    for (const p of pocketBalances) {
      await prod.query(
        `INSERT INTO "PocketBalance" (bucket, "openingBalance", "updatedAt")
         VALUES ($1,$2,$3)`,
        [p.bucket, p.openingBalance, toISO(p.updatedAt)]
      );
    }

    // 5. BusinessDay
    const businessDays = readAll("BusinessDay");
    console.log(`  → ${businessDays.length} días de negocio`);
    for (const d of businessDays) {
      await prod.query(
        `INSERT INTO "BusinessDay" (id, date, "openingBalance", "closingRealBalance", status, "closedAt", "closedById", "createdAt", "updatedAt")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [d.id, d.date, d.openingBalance, d.closingRealBalance, d.status, toISO(d.closedAt), d.closedById, toISO(d.createdAt), toISO(d.updatedAt)]
      );
    }

    // 6. Movement — orden topológico por sourceMovementId (padre antes que hijo).
    const movements = readAll("Movement");
    console.log(`  → ${movements.length} movimientos`);
    const inserted = new Set();
    const insertMovement = async (m) => {
      await prod.query(
        `INSERT INTO "Movement" (id, "businessDayId", type, direction, amount, "paymentMethod", note, "registeredById", "registeredAt", "isSystemGenerated", "sourceMovementId", "needsReclassification", "pettyCashBucket", "deletedAt", "createdAt", "updatedAt")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
        [
          m.id, m.businessDayId, m.type, m.direction, m.amount, m.paymentMethod, m.note,
          m.registeredById, toISO(m.registeredAt), toBool(m.isSystemGenerated), m.sourceMovementId,
          toBool(m.needsReclassification), m.pettyCashBucket, toISO(m.deletedAt), toISO(m.createdAt), toISO(m.updatedAt),
        ]
      );
      inserted.add(m.id);
    };
    let pending = [...movements];
    let guard = 0;
    while (pending.length > 0) {
      const ready = pending.filter((m) => m.sourceMovementId === null || inserted.has(m.sourceMovementId));
      if (ready.length === 0) {
        // Padres fuera del set (datos huérfanos): insertar el resto tal cual para no bloquear.
        console.log(`  ⚠️  ${pending.length} movimientos con padre no encontrado; se insertan igual.`);
        for (const m of pending) await insertMovement(m);
        break;
      }
      for (const m of ready) await insertMovement(m);
      pending = pending.filter((m) => !inserted.has(m.id));
      if (++guard > 10000) throw new Error("Bucle topológico excedido");
    }

    // 7. PocketTransfer
    const transfers = readAll("PocketTransfer");
    console.log(`  → ${transfers.length} transferencias entre bolsillos`);
    for (const t of transfers) {
      await prod.query(
        `INSERT INTO "PocketTransfer" (id, "fromBucket", "toBucket", amount, "createdById", "createdAt")
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [t.id, t.fromBucket, t.toBucket, t.amount, t.createdById, toISO(t.createdAt)]
      );
    }

    // 8. AuditLog
    const auditLogs = readAll("AuditLog");
    console.log(`  → ${auditLogs.length} registros de auditoría`);
    for (const a of auditLogs) {
      await prod.query(
        `INSERT INTO "AuditLog" (id, "movementId", "businessDayId", action, "changedById", "changedAt", "fieldChanges")
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [a.id, a.movementId, a.businessDayId, a.action, a.changedById, toISO(a.changedAt), a.fieldChanges]
      );
    }

    console.log("\n🎉 Migración completada. Los datos REALES están ahora en PROD.");
    console.log("   ⚠️  Haz un 'Redeploy' en Vercel para verlos en la web.");
  } catch (error) {
    console.error("\n❌ Error durante la migración:", error);
    process.exitCode = 1;
  } finally {
    sqlite.close();
    await prod.end();
  }
}

main();
