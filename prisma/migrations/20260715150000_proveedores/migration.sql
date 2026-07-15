-- Proveedores del Cierre general: catálogo editable (Costo/facturas y Gastos)

CREATE TABLE IF NOT EXISTS "Proveedor" (
  "id" TEXT NOT NULL,
  "nombre" TEXT NOT NULL,
  "tipo" TEXT NOT NULL,
  "activa" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Proveedor_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Proveedor_nombre_tipo_key" ON "Proveedor"("nombre", "tipo");

ALTER TABLE "CierreGeneralFactura" ADD COLUMN IF NOT EXISTS "proveedorId" TEXT;
ALTER TABLE "CierreGeneralGasto" ADD COLUMN IF NOT EXISTS "proveedorId" TEXT;

CREATE INDEX IF NOT EXISTS "CierreGeneralFactura_proveedorId_idx" ON "CierreGeneralFactura"("proveedorId");
CREATE INDEX IF NOT EXISTS "CierreGeneralGasto_proveedorId_idx" ON "CierreGeneralGasto"("proveedorId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CierreGeneralFactura_proveedorId_fkey'
  ) THEN
    ALTER TABLE "CierreGeneralFactura"
      ADD CONSTRAINT "CierreGeneralFactura_proveedorId_fkey"
      FOREIGN KEY ("proveedorId") REFERENCES "Proveedor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CierreGeneralGasto_proveedorId_fkey'
  ) THEN
    ALTER TABLE "CierreGeneralGasto"
      ADD CONSTRAINT "CierreGeneralGasto_proveedorId_fkey"
      FOREIGN KEY ("proveedorId") REFERENCES "Proveedor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
