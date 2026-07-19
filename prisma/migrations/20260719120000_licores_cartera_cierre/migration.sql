-- Licores: cartera propia + cierre esporadico (2026-07-19). Aditivo e idempotente.

CREATE TABLE IF NOT EXISTS "LicorCliente" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "telefono" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LicorCliente_pkey" PRIMARY KEY ("id")
  );

CREATE UNIQUE INDEX IF NOT EXISTS "LicorCliente_nombre_key" ON "LicorCliente"("nombre");

CREATE TABLE IF NOT EXISTS "LicorCierre" (
    "id" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "ventasEfectivo" INTEGER NOT NULL DEFAULT 0,
    "ventasPlataforma" INTEGER NOT NULL DEFAULT 0,
    "ventasCredito" INTEGER NOT NULL DEFAULT 0,
    "abonosEfectivo" INTEGER NOT NULL DEFAULT 0,
    "abonosPlataforma" INTEGER NOT NULL DEFAULT 0,
    "comprasEfectivo" INTEGER NOT NULL DEFAULT 0,
    "comprasPlataforma" INTEGER NOT NULL DEFAULT 0,
    "efectivoEsperado" INTEGER NOT NULL DEFAULT 0,
    "efectivoContado" INTEGER NOT NULL DEFAULT 0,
    "diferencia" INTEGER NOT NULL DEFAULT 0,
    "nota" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LicorCierre_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "LicorCierre_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
  );

CREATE INDEX IF NOT EXISTS "LicorCierre_date_idx" ON "LicorCierre"("date");

CREATE TABLE IF NOT EXISTS "LicorAbono" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "monto" INTEGER NOT NULL,
    "medioPago" TEXT NOT NULL,
    "nota" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),
    "licorCierreId" TEXT,
    CONSTRAINT "LicorAbono_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "LicorAbono_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "LicorCliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "LicorAbono_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "LicorAbono_licorCierreId_fkey" FOREIGN KEY ("licorCierreId") REFERENCES "LicorCierre"("id") ON DELETE SET NULL ON UPDATE CASCADE
  );

CREATE INDEX IF NOT EXISTS "LicorAbono_clienteId_deletedAt_idx" ON "LicorAbono"("clienteId", "deletedAt");

CREATE INDEX IF NOT EXISTS "LicorAbono_date_idx" ON "LicorAbono"("date");

CREATE INDEX IF NOT EXISTS "LicorAbono_licorCierreId_idx" ON "LicorAbono"("licorCierreId");

ALTER TABLE "LicorVenta" ADD COLUMN IF NOT EXISTS "clienteId" TEXT;

ALTER TABLE "LicorVenta" ADD COLUMN IF NOT EXISTS "licorCierreId" TEXT;

ALTER TABLE "LicorCompra" ADD COLUMN IF NOT EXISTS "licorCierreId" TEXT;

CREATE INDEX IF NOT EXISTS "LicorVenta_clienteId_deletedAt_idx" ON "LicorVenta"("clienteId", "deletedAt");

CREATE INDEX IF NOT EXISTS "LicorVenta_licorCierreId_idx" ON "LicorVenta"("licorCierreId");

CREATE INDEX IF NOT EXISTS "LicorCompra_licorCierreId_idx" ON "LicorCompra"("licorCierreId");

DO $$
  BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'LicorVenta_clienteId_fkey') THEN
      ALTER TABLE "LicorVenta" ADD CONSTRAINT "LicorVenta_clienteId_fkey"
        FOREIGN KEY ("clienteId") REFERENCES "LicorCliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'LicorVenta_licorCierreId_fkey') THEN
      ALTER TABLE "LicorVenta" ADD CONSTRAINT "LicorVenta_licorCierreId_fkey"
        FOREIGN KEY ("licorCierreId") REFERENCES "LicorCierre"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'LicorCompra_licorCierreId_fkey') THEN
      ALTER TABLE "LicorCompra" ADD CONSTRAINT "LicorCompra_licorCierreId_fkey"
        FOREIGN KEY ("licorCierreId") REFERENCES "LicorCierre"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
  END $$;
