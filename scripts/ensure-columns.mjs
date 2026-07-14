/**
 * Asegura columnas aditivas en la BD antes del build (idempotente).
 * Corre en el build de Vercel (que sí alcanza Neon), así el esquema queda listo
 * ANTES de publicar el código nuevo. Con IF NOT EXISTS es seguro correrlo siempre.
 * Si la BD no responde, el build falla y la web se queda en la versión anterior (sin romperse).
 */
import pg from "pg";

// Intenta la conexión directa (mejor para DDL) y, si no responde, la pooled
// (la que la web usa con éxito). Así el build aplica la columna por el endpoint
// que esté disponible desde la red de Vercel.
const candidatos = [process.env.DIRECT_URL, process.env.DATABASE_URL].filter(Boolean);
if (candidatos.length === 0) {
  console.error("ensure-columns: falta DIRECT_URL/DATABASE_URL");
  process.exit(1);
}

const statements = [
  'ALTER TABLE "PocketBalance" ADD COLUMN IF NOT EXISTS "openingEfectivo" INTEGER NOT NULL DEFAULT 0;',
  // Tabla del Cierre general (idempotente: IF NOT EXISTS + FKs inline).
  `CREATE TABLE IF NOT EXISTS "CierreGeneral" (
    "id" TEXT NOT NULL,
    "businessDayId" TEXT NOT NULL,
    "ventaEfectivo" INTEGER NOT NULL DEFAULT 0,
    "ventaNequi" INTEGER NOT NULL DEFAULT 0,
    "ventaTarjeta" INTEGER NOT NULL DEFAULT 0,
    "ventaDaviplata" INTEGER NOT NULL DEFAULT 0,
    "ventaTransferencia" INTEGER NOT NULL DEFAULT 0,
    "ventaCredito" INTEGER NOT NULL DEFAULT 0,
    "ventaOtro" INTEGER NOT NULL DEFAULT 0,
    "ventaSinFactura" INTEGER NOT NULL DEFAULT 0,
    "realEfectivo" INTEGER,
    "facturasPagadas" INTEGER NOT NULL DEFAULT 0,
    "gastosVarios" INTEGER NOT NULL DEFAULT 0,
    "retiroCierre" INTEGER NOT NULL DEFAULT 0,
    "descuadre" INTEGER,
    "nota" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CierreGeneral_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "CierreGeneral_businessDayId_fkey" FOREIGN KEY ("businessDayId") REFERENCES "BusinessDay"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CierreGeneral_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
  );`,
  'CREATE UNIQUE INDEX IF NOT EXISTS "CierreGeneral_businessDayId_key" ON "CierreGeneral"("businessDayId");',
];

let aplicado = false;
let ultimoError = null;
for (const url of candidatos) {
  const client = new pg.Client({ connectionString: url });
  try {
    await client.connect();
    for (const sql of statements) await client.query(sql);
    console.log("ensure-columns ✓ vía", url.includes("-pooler") ? "pooled" : "directa");
    aplicado = true;
    await client.end().catch(() => {});
    break;
  } catch (e) {
    ultimoError = e;
    console.warn("ensure-columns: falló un endpoint, probando el siguiente…", e.message);
    await client.end().catch(() => {});
  }
}

if (!aplicado) {
  console.error("ensure-columns FALLÓ en todos los endpoints:", ultimoError?.message);
  process.exit(1); // el build falla → no se publica código que espere una columna inexistente
}
