-- Fase 2 del Cierre general (aditiva, idempotente). Ver scripts/ensure-columns.mjs, que
-- aplica el mismo SQL desde el build de Vercel (la máquina local no puede alcanzar Neon).

ALTER TABLE "CierreGeneral" ADD COLUMN IF NOT EXISTS "consignado" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS "BolsaGeneral" (
    "bucket" TEXT NOT NULL,
    "openingBalance" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BolsaGeneral_pkey" PRIMARY KEY ("bucket")
);

CREATE TABLE IF NOT EXISTS "CategoriaGasto" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CategoriaGasto_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "CategoriaGasto_nombre_key" ON "CategoriaGasto"("nombre");

CREATE TABLE IF NOT EXISTS "CierreGeneralGasto" (
    "id" TEXT NOT NULL,
    "cierreGeneralId" TEXT NOT NULL,
    "categoriaId" TEXT NOT NULL,
    "monto" INTEGER NOT NULL,
    "descripcion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CierreGeneralGasto_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "CierreGeneralGasto_cierreGeneralId_fkey" FOREIGN KEY ("cierreGeneralId") REFERENCES "CierreGeneral"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CierreGeneralGasto_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "CategoriaGasto"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "CierreGeneralGasto_cierreGeneralId_idx" ON "CierreGeneralGasto"("cierreGeneralId");

CREATE TABLE IF NOT EXISTS "CierreGeneralFactura" (
    "id" TEXT NOT NULL,
    "cierreGeneralId" TEXT NOT NULL,
    "proveedor" TEXT,
    "monto" INTEGER NOT NULL,
    "descripcion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CierreGeneralFactura_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "CierreGeneralFactura_cierreGeneralId_fkey" FOREIGN KEY ("cierreGeneralId") REFERENCES "CierreGeneral"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "CierreGeneralFactura_cierreGeneralId_idx" ON "CierreGeneralFactura"("cierreGeneralId");

CREATE TABLE IF NOT EXISTS "Cliente" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "telefono" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Cliente_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "VentaCredito" (
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
);
CREATE INDEX IF NOT EXISTS "VentaCredito_clienteId_idx" ON "VentaCredito"("clienteId");
CREATE INDEX IF NOT EXISTS "VentaCredito_date_idx" ON "VentaCredito"("date");

CREATE TABLE IF NOT EXISTS "AbonoCredito" (
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
);
CREATE INDEX IF NOT EXISTS "AbonoCredito_clienteId_idx" ON "AbonoCredito"("clienteId");
CREATE INDEX IF NOT EXISTS "AbonoCredito_date_idx" ON "AbonoCredito"("date");
