-- Saldo inicial en efectivo por bolsillo (hoy solo lo usa Comisiones).
-- Aditivo y seguro: las filas existentes quedan en 0, el código previo lo ignora.
-- IF NOT EXISTS: idempotente (el build también lo asegura vía scripts/ensure-columns.mjs).
ALTER TABLE "PocketBalance" ADD COLUMN IF NOT EXISTS "openingEfectivo" INTEGER NOT NULL DEFAULT 0;
