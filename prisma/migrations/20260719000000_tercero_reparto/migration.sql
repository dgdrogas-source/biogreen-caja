-- Tercer bucket del reparto del Cierre general. Default 0: no cambia ningún número hasta
-- que se active desde Ajustes. Aplicado desde el build de Vercel vía ensure-columns.mjs.

ALTER TABLE "CierreGeneralConfig" ADD COLUMN IF NOT EXISTS "porcentajeTercero" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "CierreGeneral" ADD COLUMN IF NOT EXISTS "porcentajeTercero" INTEGER NOT NULL DEFAULT 0;
