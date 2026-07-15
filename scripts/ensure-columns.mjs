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

  // Fase 2 del Cierre general (aditivo). Ver prisma/migrations/20260715000000_cierre_general_fase2/.
  'ALTER TABLE "CierreGeneral" ADD COLUMN IF NOT EXISTS "consignado" BOOLEAN NOT NULL DEFAULT false;',

  `CREATE TABLE IF NOT EXISTS "BolsaGeneral" (
    "bucket" TEXT NOT NULL,
    "openingBalance" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BolsaGeneral_pkey" PRIMARY KEY ("bucket")
  );`,

  `CREATE TABLE IF NOT EXISTS "CategoriaGasto" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CategoriaGasto_pkey" PRIMARY KEY ("id")
  );`,
  'CREATE UNIQUE INDEX IF NOT EXISTS "CategoriaGasto_nombre_key" ON "CategoriaGasto"("nombre");',

  `CREATE TABLE IF NOT EXISTS "CierreGeneralGasto" (
    "id" TEXT NOT NULL,
    "cierreGeneralId" TEXT NOT NULL,
    "categoriaId" TEXT NOT NULL,
    "monto" INTEGER NOT NULL,
    "descripcion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CierreGeneralGasto_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "CierreGeneralGasto_cierreGeneralId_fkey" FOREIGN KEY ("cierreGeneralId") REFERENCES "CierreGeneral"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CierreGeneralGasto_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "CategoriaGasto"("id") ON DELETE RESTRICT ON UPDATE CASCADE
  );`,
  'CREATE INDEX IF NOT EXISTS "CierreGeneralGasto_cierreGeneralId_idx" ON "CierreGeneralGasto"("cierreGeneralId");',

  `CREATE TABLE IF NOT EXISTS "CierreGeneralFactura" (
    "id" TEXT NOT NULL,
    "cierreGeneralId" TEXT NOT NULL,
    "proveedor" TEXT,
    "monto" INTEGER NOT NULL,
    "descripcion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CierreGeneralFactura_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "CierreGeneralFactura_cierreGeneralId_fkey" FOREIGN KEY ("cierreGeneralId") REFERENCES "CierreGeneral"("id") ON DELETE CASCADE ON UPDATE CASCADE
  );`,
  'CREATE INDEX IF NOT EXISTS "CierreGeneralFactura_cierreGeneralId_idx" ON "CierreGeneralFactura"("cierreGeneralId");',

  `CREATE TABLE IF NOT EXISTS "Cliente" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "telefono" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Cliente_pkey" PRIMARY KEY ("id")
  );`,

  `CREATE TABLE IF NOT EXISTS "VentaCredito" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "monto" INTEGER NOT NULL,
    "date" TEXT NOT NULL,
    "shift" INTEGER NOT NULL,
    "nota" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "VentaCredito_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "VentaCredito_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "VentaCredito_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
  );`,
  'CREATE INDEX IF NOT EXISTS "VentaCredito_clienteId_idx" ON "VentaCredito"("clienteId");',
  'CREATE INDEX IF NOT EXISTS "VentaCredito_date_idx" ON "VentaCredito"("date");',

  `CREATE TABLE IF NOT EXISTS "AbonoCredito" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "monto" INTEGER NOT NULL,
    "medioPago" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "shift" INTEGER NOT NULL,
    "nota" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "AbonoCredito_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "AbonoCredito_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AbonoCredito_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
  );`,
  'CREATE INDEX IF NOT EXISTS "AbonoCredito_clienteId_idx" ON "AbonoCredito"("clienteId");',
  'CREATE INDEX IF NOT EXISTS "AbonoCredito_date_idx" ON "AbonoCredito"("date");',

  // Métodos de pago para gastos y facturas (Fase 3 — registro de diferencias)
  'ALTER TABLE "CierreGeneralGasto" ADD COLUMN IF NOT EXISTS "metodoPago" TEXT;',
  'ALTER TABLE "CierreGeneralFactura" ADD COLUMN IF NOT EXISTS "metodoPago" TEXT;',

  // Registro de sobrante/faltante
  `CREATE TABLE IF NOT EXISTS "ClosureDifference" (
    "id" TEXT NOT NULL,
    "cierreGeneralId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "monto" INTEGER NOT NULL,
    "razonProbable" TEXT NOT NULL,
    "descripcion" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'PENDIENTE_RESOLUCION',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ClosureDifference_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ClosureDifference_cierreGeneralId_fkey" FOREIGN KEY ("cierreGeneralId") REFERENCES "CierreGeneral"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ClosureDifference_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
  );`,
  'CREATE INDEX IF NOT EXISTS "ClosureDifference_cierreGeneralId_idx" ON "ClosureDifference"("cierreGeneralId");',

  // Resoluciones de diferencias
  `CREATE TABLE IF NOT EXISTS "ClosureDifferenceResolution" (
    "id" TEXT NOT NULL,
    "differenciaId" TEXT NOT NULL,
    "tipoAjuste" TEXT NOT NULL,
    "detalles" TEXT,
    "monto" INTEGER NOT NULL,
    "confirmado" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ClosureDifferenceResolution_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ClosureDifferenceResolution_differenciaId_fkey" FOREIGN KEY ("differenciaId") REFERENCES "ClosureDifference"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ClosureDifferenceResolution_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
  );`,
  'CREATE INDEX IF NOT EXISTS "ClosureDifferenceResolution_differenciaId_idx" ON "ClosureDifferenceResolution"("differenciaId");',
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
