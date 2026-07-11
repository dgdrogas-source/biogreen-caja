/**
 * Asegura columnas aditivas en la BD antes del build (idempotente).
 * Corre en el build de Vercel (que sí alcanza Neon), así el esquema queda listo
 * ANTES de publicar el código nuevo. Con IF NOT EXISTS es seguro correrlo siempre.
 * Si la BD no responde, el build falla y la web se queda en la versión anterior (sin romperse).
 */
import pg from "pg";

const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!url) {
  console.error("ensure-columns: falta DIRECT_URL/DATABASE_URL");
  process.exit(1);
}

const statements = [
  'ALTER TABLE "PocketBalance" ADD COLUMN IF NOT EXISTS "openingEfectivo" INTEGER NOT NULL DEFAULT 0;',
];

const client = new pg.Client({ connectionString: url });
try {
  await client.connect();
  for (const sql of statements) {
    await client.query(sql);
    console.log("ensure-columns ✓", sql);
  }
} catch (e) {
  console.error("ensure-columns FALLÓ:", e.message);
  process.exit(1); // el build falla → no se publica código que espere una columna inexistente
} finally {
  await client.end().catch(() => {});
}
