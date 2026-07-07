-- Turnos por día + horarios configurables + snapshot de descuadre.
-- Aditivo y seguro sobre datos existentes: las filas actuales de BusinessDay
-- quedan como turno 1 (DEFAULT 1) y sus fechas ya eran únicas, así que el
-- índice compuesto (date, shift) se crea sin conflictos.

-- DropIndex
DROP INDEX "BusinessDay_date_key";

-- AlterTable
ALTER TABLE "BusinessDay" ADD COLUMN     "closingExpectedBalance" INTEGER,
ADD COLUMN     "shift" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "ShiftConfig" (
    "shift" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShiftConfig_pkey" PRIMARY KEY ("shift")
);

-- CreateIndex
CREATE UNIQUE INDEX "BusinessDay_date_shift_key" ON "BusinessDay"("date", "shift");
