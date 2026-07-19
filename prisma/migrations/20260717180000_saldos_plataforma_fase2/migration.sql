-- Fase 2 de Saldos por plataforma (2026-07-17). Ver el diseño en CLAUDE.md.
-- No se aplica localmente (Neon inalcanzable): se aplica desde el build de Vercel vía
-- scripts/ensure-columns.mjs. IF NOT EXISTS para poder re-correrlo sin romper.

ALTER TABLE "Proveedor" ADD COLUMN IF NOT EXISTS "medioPagoHabitual" TEXT;

CREATE TABLE IF NOT EXISTS "TarjetaConfig" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "ajustePendienteInicial" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TarjetaConfig_pkey" PRIMARY KEY ("id")
);
INSERT INTO "TarjetaConfig" ("id", "ajustePendienteInicial", "updatedAt")
   VALUES (1, 0, CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING;

ALTER TABLE "PlataformaTransferencia" ADD COLUMN IF NOT EXISTS "gastoGeneradoId" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "PlataformaTransferencia_gastoGeneradoId_key" ON "PlataformaTransferencia"("gastoGeneradoId");
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'PlataformaTransferencia_gastoGeneradoId_fkey'
  ) THEN
    ALTER TABLE "PlataformaTransferencia"
      ADD CONSTRAINT "PlataformaTransferencia_gastoGeneradoId_fkey"
      FOREIGN KEY ("gastoGeneradoId") REFERENCES "CierreGeneralGasto"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
