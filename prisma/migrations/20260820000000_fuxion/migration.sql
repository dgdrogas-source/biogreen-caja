-- ---------------------------------------------------------------------------
-- MÓDULO FUXION (2026-08-20). Ver prisma/migrations/20260820000000_fuxion/.
-- Todo aditivo: tablas nuevas, no toca ninguna existente.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "FuxionProducto" (
  "id" TEXT NOT NULL,
  "nombre" TEXT NOT NULL,
  "precioVenta" INTEGER NOT NULL DEFAULT 0,
  "inventarioInicial" INTEGER NOT NULL DEFAULT 0,
  "stockMinimo" INTEGER NOT NULL DEFAULT 6,
  "activo" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FuxionProducto_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "FuxionProducto_nombre_key" ON "FuxionProducto"("nombre");

CREATE TABLE IF NOT EXISTS "FuxionCliente" (
  "id" TEXT NOT NULL,
  "nombre" TEXT NOT NULL,
  "telefono" TEXT,
  "activo" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FuxionCliente_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "FuxionCliente_nombre_key" ON "FuxionCliente"("nombre");

CREATE TABLE IF NOT EXISTS "FuxionCierre" (
  "id" TEXT NOT NULL,
  "date" TEXT NOT NULL,
  "ventasEfectivo" INTEGER NOT NULL DEFAULT 0,
  "ventasPlataforma" INTEGER NOT NULL DEFAULT 0,
  "ventasCredito" INTEGER NOT NULL DEFAULT 0,
  "abonosEfectivo" INTEGER NOT NULL DEFAULT 0,
  "abonosPlataforma" INTEGER NOT NULL DEFAULT 0,
  "comprasEfectivo" INTEGER NOT NULL DEFAULT 0,
  "comprasPlataforma" INTEGER NOT NULL DEFAULT 0,
  "pagosEfectivo" INTEGER NOT NULL DEFAULT 0,
  "pagosPlataforma" INTEGER NOT NULL DEFAULT 0,
  "efectivoEsperado" INTEGER NOT NULL DEFAULT 0,
  "efectivoContado" INTEGER NOT NULL DEFAULT 0,
  "diferencia" INTEGER NOT NULL DEFAULT 0,
  "nota" TEXT,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FuxionCierre_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "FuxionCierre_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "FuxionCierre_date_idx" ON "FuxionCierre"("date");

CREATE TABLE IF NOT EXISTS "FuxionCompra" (
  "id" TEXT NOT NULL,
  "productoId" TEXT NOT NULL,
  "date" TEXT NOT NULL,
  "cantidad" INTEGER NOT NULL DEFAULT 28,
  "valorTotal" INTEGER NOT NULL,
  "proveedor" TEXT,
  "descripcion" TEXT,
  "metodoPago" TEXT NOT NULL,
  "movementId" TEXT,
  "pagadaAt" TEXT,
  "pagoMetodoPago" TEXT,
  "pagoMovementId" TEXT,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deletedAt" TIMESTAMP(3),
  "fuxionCierreId" TEXT,
  CONSTRAINT "FuxionCompra_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "FuxionCompra_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "FuxionProducto"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "FuxionCompra_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "FuxionCompra_fuxionCierreId_fkey" FOREIGN KEY ("fuxionCierreId") REFERENCES "FuxionCierre"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "FuxionCompra_productoId_deletedAt_idx" ON "FuxionCompra"("productoId", "deletedAt");
CREATE INDEX IF NOT EXISTS "FuxionCompra_date_idx" ON "FuxionCompra"("date");
CREATE INDEX IF NOT EXISTS "FuxionCompra_fuxionCierreId_idx" ON "FuxionCompra"("fuxionCierreId");

CREATE TABLE IF NOT EXISTS "FuxionVenta" (
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
  "clienteId" TEXT,
  "fuxionCierreId" TEXT,
  CONSTRAINT "FuxionVenta_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "FuxionVenta_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "FuxionProducto"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "FuxionVenta_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "FuxionVenta_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "FuxionCliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "FuxionVenta_fuxionCierreId_fkey" FOREIGN KEY ("fuxionCierreId") REFERENCES "FuxionCierre"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "FuxionVenta_productoId_deletedAt_idx" ON "FuxionVenta"("productoId", "deletedAt");
CREATE INDEX IF NOT EXISTS "FuxionVenta_date_idx" ON "FuxionVenta"("date");
CREATE INDEX IF NOT EXISTS "FuxionVenta_clienteId_deletedAt_idx" ON "FuxionVenta"("clienteId", "deletedAt");
CREATE INDEX IF NOT EXISTS "FuxionVenta_fuxionCierreId_idx" ON "FuxionVenta"("fuxionCierreId");

CREATE TABLE IF NOT EXISTS "FuxionAbono" (
  "id" TEXT NOT NULL,
  "clienteId" TEXT NOT NULL,
  "date" TEXT NOT NULL,
  "monto" INTEGER NOT NULL,
  "medioPago" TEXT NOT NULL,
  "nota" TEXT,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deletedAt" TIMESTAMP(3),
  "fuxionCierreId" TEXT,
  CONSTRAINT "FuxionAbono_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "FuxionAbono_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "FuxionCliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "FuxionAbono_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "FuxionAbono_fuxionCierreId_fkey" FOREIGN KEY ("fuxionCierreId") REFERENCES "FuxionCierre"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "FuxionAbono_clienteId_deletedAt_idx" ON "FuxionAbono"("clienteId", "deletedAt");
CREATE INDEX IF NOT EXISTS "FuxionAbono_date_idx" ON "FuxionAbono"("date");
CREATE INDEX IF NOT EXISTS "FuxionAbono_fuxionCierreId_idx" ON "FuxionAbono"("fuxionCierreId");
