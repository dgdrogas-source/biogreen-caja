-- Observación del cierre de turno (aditivo, nullable).
ALTER TABLE "BusinessDay" ADD COLUMN IF NOT EXISTS "closingNote" TEXT;
