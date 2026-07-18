-- Resumen Cierre general: % de reposición dinámico (congelado por cierre) + config global.
-- Aditivo e idempotente (se aplica desde el build de Vercel vía scripts/ensure-columns.mjs).

-- Snapshot del % vigente al guardar cada cierre (congela el historial). DEFAULT 70 → los
-- cierres ya guardados (Fase 1/2) quedan en 70/30 sin tocarlos.
ALTER TABLE "CierreGeneral" ADD COLUMN IF NOT EXISTS "porcentajeReposicion" INTEGER NOT NULL DEFAULT 70;

-- Config global (una sola fila, id=1): % de reposición actual + punto de equilibrio diario.
CREATE TABLE IF NOT EXISTS "CierreGeneralConfig" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "porcentajeReposicion" INTEGER NOT NULL DEFAULT 70,
    "puntoEquilibrio" INTEGER NOT NULL DEFAULT 1100000,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CierreGeneralConfig_pkey" PRIMARY KEY ("id")
);

INSERT INTO "CierreGeneralConfig" ("id", "porcentajeReposicion", "puntoEquilibrio", "updatedAt")
VALUES (1, 70, 1100000, CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING;
