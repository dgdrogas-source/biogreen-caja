-- Daviplata por turno (2026-09-10). Reemplaza a CierreDiario.saldoRealDaviplata/notaDaviplata
-- (columnas ahí quedan sin uso, nunca DROP). Aditivo y aislado.
-- Historial únicamente: en este proyecto el DDL real se aplica desde scripts/ensure-columns.mjs
-- en el build de Vercel (la máquina local no alcanza Neon). Ver .claude/PLAN-CIERRE-DIARIO-AJUSTES-2026-09-10.md.

CREATE TABLE IF NOT EXISTS "CierreDiarioDaviplataTurno" (
    "id" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "shift" INTEGER NOT NULL,
    "saldoReal" INTEGER,
    "nota" TEXT,
    "confirmadoById" TEXT,
    "confirmadoAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CierreDiarioDaviplataTurno_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "CierreDiarioDaviplataTurno_confirmadoById_fkey" FOREIGN KEY ("confirmadoById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "CierreDiarioDaviplataTurno_date_shift_key" ON "CierreDiarioDaviplataTurno"("date", "shift");
