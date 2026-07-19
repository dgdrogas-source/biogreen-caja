-- Módulo Licores (2026-07-19). Aditivo e idempotente.
-- Se aplica desde el build de Vercel vía scripts/ensure-columns.mjs.

CREATE TABLE IF NOT EXISTS "LicorProducto" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "precioVenta" INTEGER NOT NULL DEFAULT 0,
    "stockMinimo" INTEGER NOT NULL DEFAULT 6,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LicorProducto_pkey" PRIMARY KEY ("id")
  );

CREATE UNIQUE INDEX IF NOT EXISTS "LicorProducto_nombre_key" ON "LicorProducto"("nombre");

CREATE TABLE IF NOT EXISTS "LicorCompra" (
    "id" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "valorTotal" INTEGER NOT NULL,
    "proveedor" TEXT,
    "descripcion" TEXT,
    "metodoPago" TEXT NOT NULL,
    "movementId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "LicorCompra_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "LicorCompra_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "LicorProducto"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "LicorCompra_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
  );

CREATE INDEX IF NOT EXISTS "LicorCompra_productoId_deletedAt_idx" ON "LicorCompra"("productoId", "deletedAt");

CREATE INDEX IF NOT EXISTS "LicorCompra_date_idx" ON "LicorCompra"("date");

CREATE TABLE IF NOT EXISTS "LicorVenta" (
    "id" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "shift" INTEGER NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "precioUnitario" INTEGER NOT NULL,
    "costoUnitario" INTEGER NOT NULL,
    "metodoPago" TEXT NOT NULL,
    "descuento" BOOLEAN NOT NULL DEFAULT false,
    "movementId" TEXT,
    "nota" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "LicorVenta_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "LicorVenta_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "LicorProducto"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "LicorVenta_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
  );

CREATE INDEX IF NOT EXISTS "LicorVenta_productoId_deletedAt_idx" ON "LicorVenta"("productoId", "deletedAt");

CREATE INDEX IF NOT EXISTS "LicorVenta_date_idx" ON "LicorVenta"("date");
