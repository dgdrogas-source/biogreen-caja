-- Saldos por plataforma (Cierre general, 2026-07-17). Ver el diseño en CLAUDE.md.
-- No se aplica localmente (Neon inalcanzable): se aplica desde el build de Vercel vía
-- scripts/ensure-columns.mjs. IF NOT EXISTS para poder re-correrlo sin romper.

ALTER TABLE "CierreGeneralGasto" ADD COLUMN IF NOT EXISTS "autoGenerado" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS "PlataformaSaldoInicial" (
    "plataforma" TEXT NOT NULL,
    "openingBalance" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PlataformaSaldoInicial_pkey" PRIMARY KEY ("plataforma")
);

CREATE TABLE IF NOT EXISTS "TarjetaAbono" (
    "id" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "monto" INTEGER NOT NULL,
    "nota" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TarjetaAbono_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "TarjetaAbono_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "TarjetaAbono_date_idx" ON "TarjetaAbono"("date");

CREATE TABLE IF NOT EXISTS "PlataformaTransferencia" (
    "id" TEXT NOT NULL,
    "fromPlataforma" TEXT NOT NULL,
    "toPlataforma" TEXT NOT NULL,
    "monto" INTEGER NOT NULL,
    "impuesto4x1000" INTEGER NOT NULL DEFAULT 0,
    "nota" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PlataformaTransferencia_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "PlataformaTransferencia_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "PlataformaTransferencia_createdAt_idx" ON "PlataformaTransferencia"("createdAt");
