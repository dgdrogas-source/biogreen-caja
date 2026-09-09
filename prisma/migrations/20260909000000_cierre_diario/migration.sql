-- Módulo Cierre Diario (2026-09-09). Reemplaza a Cierre General. Aditivo y aislado.
-- Historial únicamente: en este proyecto el DDL real se aplica desde scripts/ensure-columns.mjs
-- en el build de Vercel (la máquina local no alcanza Neon). Ver .claude/PLAN-CIERRE-DIARIO-IMPLEMENTACION.md.

ALTER TABLE "ParteTurno" ADD COLUMN IF NOT EXISTS "ventaTarjetaDebito" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS "CierreDiario" (
    "date" TEXT NOT NULL,
    "saldoRealCC" INTEGER,
    "notaCC" TEXT,
    "saldoRealDaviplata" INTEGER,
    "notaDaviplata" TEXT,
    "cerradoById" TEXT,
    "cerradoAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CierreDiario_pkey" PRIMARY KEY ("date"),
    CONSTRAINT "CierreDiario_cerradoById_fkey" FOREIGN KEY ("cerradoById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "CierreDiarioDatafono" (
    "date" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CierreDiarioDatafono_pkey" PRIMARY KEY ("date")
);

CREATE TABLE IF NOT EXISTS "CierreDiarioDatafonoFranquicia" (
    "id" TEXT NOT NULL,
    "datafonoDate" TEXT NOT NULL,
    "franquicia" TEXT NOT NULL,
    "montoVendido" INTEGER NOT NULL,
    CONSTRAINT "CierreDiarioDatafonoFranquicia_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "CierreDiarioDatafonoFranquicia_datafonoDate_fkey" FOREIGN KEY ("datafonoDate") REFERENCES "CierreDiarioDatafono"("date") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "CierreDiarioDatafonoFranquicia_datafonoDate_idx" ON "CierreDiarioDatafonoFranquicia"("datafonoDate");

CREATE TABLE IF NOT EXISTS "CierreDiarioPendienteTarjeta" (
    "id" TEXT NOT NULL,
    "dateOrigen" TEXT NOT NULL,
    "franquicia" TEXT NOT NULL,
    "montoVendido" INTEGER NOT NULL,
    "montoConsignado" INTEGER,
    "fechaConsignado" TEXT,
    "resuelto" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CierreDiarioPendienteTarjeta_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "CierreDiarioPendienteTarjeta_dateOrigen_idx" ON "CierreDiarioPendienteTarjeta"("dateOrigen");
CREATE INDEX IF NOT EXISTS "CierreDiarioPendienteTarjeta_resuelto_idx" ON "CierreDiarioPendienteTarjeta"("resuelto");

CREATE TABLE IF NOT EXISTS "CierreDiarioMovimientoManual" (
    "id" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "cuenta" TEXT NOT NULL,
    "monto" INTEGER NOT NULL,
    "impuesto4x1000" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CierreDiarioMovimientoManual_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "CierreDiarioMovimientoManual_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "CierreDiarioMovimientoManual_date_idx" ON "CierreDiarioMovimientoManual"("date");
