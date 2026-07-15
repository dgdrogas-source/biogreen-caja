-- Fase 3: Cierre General mejorado con métodos de pago, diferencias y resolución de ajustes

-- Agregar métodos de pago a gastos y facturas
ALTER TABLE "CierreGeneralGasto" ADD COLUMN IF NOT EXISTS "metodoPago" TEXT;
ALTER TABLE "CierreGeneralFactura" ADD COLUMN IF NOT EXISTS "metodoPago" TEXT;

-- Tabla: Registro de sobrante/faltante con razón
CREATE TABLE IF NOT EXISTS "ClosureDifference" (
  "id" TEXT NOT NULL,
  "cierreGeneralId" TEXT NOT NULL,
  "tipo" TEXT NOT NULL,
  "monto" INTEGER NOT NULL,
  "razonProbable" TEXT NOT NULL,
  "descripcion" TEXT,
  "estado" TEXT NOT NULL DEFAULT 'PENDIENTE_RESOLUCION',
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ClosureDifference_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ClosureDifference_cierreGeneralId_fkey" FOREIGN KEY ("cierreGeneralId") REFERENCES "CierreGeneral"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ClosureDifference_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "ClosureDifference_cierreGeneralId_idx" ON "ClosureDifference"("cierreGeneralId");

-- Tabla: Cómo se resolvió una diferencia (ej: transferencia entre métodos, crear abono, etc)
CREATE TABLE IF NOT EXISTS "ClosureDifferenceResolution" (
  "id" TEXT NOT NULL,
  "differenciaId" TEXT NOT NULL,
  "tipoAjuste" TEXT NOT NULL,
  "detalles" TEXT,
  "monto" INTEGER NOT NULL,
  "confirmado" BOOLEAN NOT NULL DEFAULT false,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ClosureDifferenceResolution_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ClosureDifferenceResolution_differenciaId_fkey" FOREIGN KEY ("differenciaId") REFERENCES "ClosureDifference"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ClosureDifferenceResolution_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "ClosureDifferenceResolution_differenciaId_idx" ON "ClosureDifferenceResolution"("differenciaId");
