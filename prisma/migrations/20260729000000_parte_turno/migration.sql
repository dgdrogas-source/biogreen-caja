-- Módulo PARTE DE TURNO (2026-07-29)
-- La vendedora registra al cambio de turno el "Cuadre de Caja" del POS (Dominium) y el
-- administrador lo aprueba; solo al aprobar se vuelca a CierreGeneral y afecta bolsas,
-- resumen y rentabilidad.
--
-- 100% ADITIVO: solo CREATE TABLE IF NOT EXISTS / ADD COLUMN IF NOT EXISTS. Ningún DROP,
-- ninguna tabla ni columna existente se modifica.
--
-- Este SQL es el mismo que aplica scripts/ensure-columns.mjs durante el build de Vercel
-- (la máquina local no alcanza Neon). Esta carpeta existe para el historial.

CREATE TABLE IF NOT EXISTS "ParteTurno" (
    "id" TEXT NOT NULL,
    "businessDayId" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'BORRADOR',
    "ventaEfectivo" INTEGER NOT NULL DEFAULT 0,
    "ventaNequi" INTEGER NOT NULL DEFAULT 0,
    "ventaTarjeta" INTEGER NOT NULL DEFAULT 0,
    "ventaDaviplata" INTEGER NOT NULL DEFAULT 0,
    "ventaTransferencia" INTEGER NOT NULL DEFAULT 0,
    "ventaCredito" INTEGER NOT NULL DEFAULT 0,
    "ventaOtro" INTEGER NOT NULL DEFAULT 0,
    "ventaSinFactura" INTEGER NOT NULL DEFAULT 0,
    "retiroCierre" INTEGER NOT NULL DEFAULT 0,
    "realEfectivo" INTEGER,
    "nota" TEXT,
    "notaAdmin" TEXT,
    "registradoById" TEXT NOT NULL,
    "enviadoAt" TIMESTAMP(3),
    "aprobadoAt" TIMESTAMP(3),
    "aprobadoById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ParteTurno_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ParteTurno_businessDayId_fkey" FOREIGN KEY ("businessDayId") REFERENCES "BusinessDay"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ParteTurno_registradoById_fkey" FOREIGN KEY ("registradoById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ParteTurno_aprobadoById_fkey" FOREIGN KEY ("aprobadoById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "ParteTurno_businessDayId_key" ON "ParteTurno"("businessDayId");
CREATE INDEX IF NOT EXISTS "ParteTurno_estado_idx" ON "ParteTurno"("estado");

CREATE TABLE IF NOT EXISTS "ParteTurnoGasto" (
    "id" TEXT NOT NULL,
    "parteTurnoId" TEXT NOT NULL,
    "categoriaId" TEXT NOT NULL,
    "proveedorId" TEXT NOT NULL,
    "monto" INTEGER NOT NULL,
    "descripcion" TEXT,
    "metodoPago" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ParteTurnoGasto_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ParteTurnoGasto_parteTurnoId_fkey" FOREIGN KEY ("parteTurnoId") REFERENCES "ParteTurno"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ParteTurnoGasto_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "CategoriaGasto"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ParteTurnoGasto_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "Proveedor"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "ParteTurnoGasto_parteTurnoId_idx" ON "ParteTurnoGasto"("parteTurnoId");

CREATE TABLE IF NOT EXISTS "ParteTurnoFactura" (
    "id" TEXT NOT NULL,
    "parteTurnoId" TEXT NOT NULL,
    "proveedorId" TEXT NOT NULL,
    "monto" INTEGER NOT NULL,
    "descripcion" TEXT,
    "metodoPago" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ParteTurnoFactura_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ParteTurnoFactura_parteTurnoId_fkey" FOREIGN KEY ("parteTurnoId") REFERENCES "ParteTurno"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ParteTurnoFactura_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "Proveedor"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "ParteTurnoFactura_parteTurnoId_idx" ON "ParteTurnoFactura"("parteTurnoId");

-- Trazabilidad: de qué parte salió cada gasto/factura ya volcado al cierre.
-- Columnas SUELTAS (sin FK) a propósito — mismo criterio que LicorVenta.movementId.
ALTER TABLE "CierreGeneralGasto" ADD COLUMN IF NOT EXISTS "parteTurnoId" TEXT;
ALTER TABLE "CierreGeneralFactura" ADD COLUMN IF NOT EXISTS "parteTurnoId" TEXT;
