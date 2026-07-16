-- Módulo Cierre Mensual (aditivo, aislado de Nequi y Cierre general).
-- Nota: en este proyecto las migraciones NO se aplican localmente (Neon inalcanzable
-- desde la máquina local); se aplican desde el build de Vercel vía scripts/ensure-columns.mjs.
-- Este archivo es el historial fiel del esquema. Se usa IF NOT EXISTS para poder re-correrlo
-- sin romper (misma política que el resto del proyecto).

CREATE TABLE IF NOT EXISTS "MensualCategoriaGasto" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MensualCategoriaGasto_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "MensualCategoriaGasto_nombre_key" ON "MensualCategoriaGasto"("nombre");

CREATE TABLE IF NOT EXISTS "MensualDia" (
    "id" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "ventaDia" INTEGER NOT NULL DEFAULT 0,
    "comisionTarjeta" INTEGER NOT NULL DEFAULT 0,
    "impuesto4x1000" INTEGER NOT NULL DEFAULT 0,
    "carteraTotal" INTEGER NOT NULL DEFAULT 0,
    "nota" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MensualDia_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "MensualDia_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "MensualDia_date_key" ON "MensualDia"("date");
CREATE INDEX IF NOT EXISTS "MensualDia_date_idx" ON "MensualDia"("date");

CREATE TABLE IF NOT EXISTS "MensualGasto" (
    "id" TEXT NOT NULL,
    "mensualDiaId" TEXT NOT NULL,
    "categoriaId" TEXT NOT NULL,
    "monto" INTEGER NOT NULL,
    "descripcion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MensualGasto_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "MensualGasto_mensualDiaId_fkey" FOREIGN KEY ("mensualDiaId") REFERENCES "MensualDia"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MensualGasto_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "MensualCategoriaGasto"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "MensualGasto_mensualDiaId_idx" ON "MensualGasto"("mensualDiaId");

CREATE TABLE IF NOT EXISTS "MensualDiferencia" (
    "id" TEXT NOT NULL,
    "mensualDiaId" TEXT NOT NULL,
    "cierre" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "monto" INTEGER NOT NULL,
    "disposicion" TEXT,
    "nota" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MensualDiferencia_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "MensualDiferencia_mensualDiaId_fkey" FOREIGN KEY ("mensualDiaId") REFERENCES "MensualDia"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "MensualDiferencia_mensualDiaId_idx" ON "MensualDiferencia"("mensualDiaId");
