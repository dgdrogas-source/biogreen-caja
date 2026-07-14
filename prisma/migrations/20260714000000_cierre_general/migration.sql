-- Tabla del "Cierre general" (un registro por turno). Aditiva.
-- Idempotente (IF NOT EXISTS + FKs inline): segura si el build (ensure-columns.mjs) la re-ejecuta.
CREATE TABLE IF NOT EXISTS "CierreGeneral" (
    "id" TEXT NOT NULL,
    "businessDayId" TEXT NOT NULL,
    "ventaEfectivo" INTEGER NOT NULL DEFAULT 0,
    "ventaNequi" INTEGER NOT NULL DEFAULT 0,
    "ventaTarjeta" INTEGER NOT NULL DEFAULT 0,
    "ventaDaviplata" INTEGER NOT NULL DEFAULT 0,
    "ventaTransferencia" INTEGER NOT NULL DEFAULT 0,
    "ventaCredito" INTEGER NOT NULL DEFAULT 0,
    "ventaOtro" INTEGER NOT NULL DEFAULT 0,
    "ventaSinFactura" INTEGER NOT NULL DEFAULT 0,
    "realEfectivo" INTEGER,
    "facturasPagadas" INTEGER NOT NULL DEFAULT 0,
    "gastosVarios" INTEGER NOT NULL DEFAULT 0,
    "retiroCierre" INTEGER NOT NULL DEFAULT 0,
    "descuadre" INTEGER,
    "nota" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CierreGeneral_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "CierreGeneral_businessDayId_fkey" FOREIGN KEY ("businessDayId") REFERENCES "BusinessDay"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CierreGeneral_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "CierreGeneral_businessDayId_key" ON "CierreGeneral"("businessDayId");
