-- Días de la semana en que el turno se queda fijo en 1 todo el día (no se sugiere el 2
-- automáticamente por la hora). dayOfWeek: 0=domingo … 6=sábado.
CREATE TABLE IF NOT EXISTS "DiaTurnoUnico" (
    "dayOfWeek" INTEGER NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DiaTurnoUnico_pkey" PRIMARY KEY ("dayOfWeek")
);

-- Domingo (0) arranca activo, reflejando la práctica actual del dueño; el resto inactivos.
INSERT INTO "DiaTurnoUnico" ("dayOfWeek", "activo", "updatedAt") VALUES
    (0, true, CURRENT_TIMESTAMP),
    (1, false, CURRENT_TIMESTAMP),
    (2, false, CURRENT_TIMESTAMP),
    (3, false, CURRENT_TIMESTAMP),
    (4, false, CURRENT_TIMESTAMP),
    (5, false, CURRENT_TIMESTAMP),
    (6, false, CURRENT_TIMESTAMP)
ON CONFLICT ("dayOfWeek") DO NOTHING;
