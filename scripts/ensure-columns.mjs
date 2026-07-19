/**
 * Asegura columnas aditivas en la BD antes del build (idempotente).
 * Corre en el build de Vercel (que sí alcanza Neon), así el esquema queda listo
 * ANTES de publicar el código nuevo. Con IF NOT EXISTS es seguro correrlo siempre.
 * Si la BD no responde, el build falla y la web se queda en la versión anterior (sin romperse).
 */
import pg from "pg";

// Intenta la conexión directa (mejor para DDL) y, si no responde, la pooled
// (la que la web usa con éxito). Así el build aplica la columna por el endpoint
// que esté disponible desde la red de Vercel.
const candidatos = [process.env.DIRECT_URL, process.env.DATABASE_URL].filter(Boolean);
if (candidatos.length === 0) {
  console.error("ensure-columns: falta DIRECT_URL/DATABASE_URL");
  process.exit(1);
}

const statements = [
  'ALTER TABLE "PocketBalance" ADD COLUMN IF NOT EXISTS "openingEfectivo" INTEGER NOT NULL DEFAULT 0;',
  // Tabla del Cierre general (idempotente: IF NOT EXISTS + FKs inline).
  `CREATE TABLE IF NOT EXISTS "CierreGeneral" (
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
  );`,
  'CREATE UNIQUE INDEX IF NOT EXISTS "CierreGeneral_businessDayId_key" ON "CierreGeneral"("businessDayId");',

  // Fase 2 del Cierre general (aditivo). Ver prisma/migrations/20260715000000_cierre_general_fase2/.
  'ALTER TABLE "CierreGeneral" ADD COLUMN IF NOT EXISTS "consignado" BOOLEAN NOT NULL DEFAULT false;',

  `CREATE TABLE IF NOT EXISTS "BolsaGeneral" (
    "bucket" TEXT NOT NULL,
    "openingBalance" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BolsaGeneral_pkey" PRIMARY KEY ("bucket")
  );`,

  `CREATE TABLE IF NOT EXISTS "CategoriaGasto" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CategoriaGasto_pkey" PRIMARY KEY ("id")
  );`,
  'CREATE UNIQUE INDEX IF NOT EXISTS "CategoriaGasto_nombre_key" ON "CategoriaGasto"("nombre");',

  `CREATE TABLE IF NOT EXISTS "CierreGeneralGasto" (
    "id" TEXT NOT NULL,
    "cierreGeneralId" TEXT NOT NULL,
    "categoriaId" TEXT NOT NULL,
    "monto" INTEGER NOT NULL,
    "descripcion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CierreGeneralGasto_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "CierreGeneralGasto_cierreGeneralId_fkey" FOREIGN KEY ("cierreGeneralId") REFERENCES "CierreGeneral"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CierreGeneralGasto_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "CategoriaGasto"("id") ON DELETE RESTRICT ON UPDATE CASCADE
  );`,
  'CREATE INDEX IF NOT EXISTS "CierreGeneralGasto_cierreGeneralId_idx" ON "CierreGeneralGasto"("cierreGeneralId");',

  `CREATE TABLE IF NOT EXISTS "CierreGeneralFactura" (
    "id" TEXT NOT NULL,
    "cierreGeneralId" TEXT NOT NULL,
    "proveedor" TEXT,
    "monto" INTEGER NOT NULL,
    "descripcion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CierreGeneralFactura_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "CierreGeneralFactura_cierreGeneralId_fkey" FOREIGN KEY ("cierreGeneralId") REFERENCES "CierreGeneral"("id") ON DELETE CASCADE ON UPDATE CASCADE
  );`,
  'CREATE INDEX IF NOT EXISTS "CierreGeneralFactura_cierreGeneralId_idx" ON "CierreGeneralFactura"("cierreGeneralId");',

  `CREATE TABLE IF NOT EXISTS "Cliente" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "telefono" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Cliente_pkey" PRIMARY KEY ("id")
  );`,

  `CREATE TABLE IF NOT EXISTS "VentaCredito" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "monto" INTEGER NOT NULL,
    "date" TEXT NOT NULL,
    "shift" INTEGER NOT NULL,
    "nota" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "VentaCredito_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "VentaCredito_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "VentaCredito_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
  );`,
  'CREATE INDEX IF NOT EXISTS "VentaCredito_clienteId_idx" ON "VentaCredito"("clienteId");',
  'CREATE INDEX IF NOT EXISTS "VentaCredito_date_idx" ON "VentaCredito"("date");',

  `CREATE TABLE IF NOT EXISTS "AbonoCredito" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "monto" INTEGER NOT NULL,
    "medioPago" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "shift" INTEGER NOT NULL,
    "nota" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "AbonoCredito_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "AbonoCredito_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AbonoCredito_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
  );`,
  'CREATE INDEX IF NOT EXISTS "AbonoCredito_clienteId_idx" ON "AbonoCredito"("clienteId");',
  'CREATE INDEX IF NOT EXISTS "AbonoCredito_date_idx" ON "AbonoCredito"("date");',

  // Métodos de pago para gastos y facturas (Fase 3 — registro de diferencias)
  'ALTER TABLE "CierreGeneralGasto" ADD COLUMN IF NOT EXISTS "metodoPago" TEXT;',
  'ALTER TABLE "CierreGeneralFactura" ADD COLUMN IF NOT EXISTS "metodoPago" TEXT;',

  // Registro de sobrante/faltante
  `CREATE TABLE IF NOT EXISTS "ClosureDifference" (
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
  );`,
  'CREATE INDEX IF NOT EXISTS "ClosureDifference_cierreGeneralId_idx" ON "ClosureDifference"("cierreGeneralId");',

  // Resoluciones de diferencias
  `CREATE TABLE IF NOT EXISTS "ClosureDifferenceResolution" (
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
  );`,
  'CREATE INDEX IF NOT EXISTS "ClosureDifferenceResolution_differenciaId_idx" ON "ClosureDifferenceResolution"("differenciaId");',

  // Proveedores del Cierre general (Costo/facturas y Gastos), editables por el admin
  `CREATE TABLE IF NOT EXISTS "Proveedor" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Proveedor_pkey" PRIMARY KEY ("id")
  );`,
  'CREATE UNIQUE INDEX IF NOT EXISTS "Proveedor_nombre_tipo_key" ON "Proveedor"("nombre", "tipo");',

  'ALTER TABLE "CierreGeneralFactura" ADD COLUMN IF NOT EXISTS "proveedorId" TEXT;',
  'ALTER TABLE "CierreGeneralGasto" ADD COLUMN IF NOT EXISTS "proveedorId" TEXT;',
  'CREATE INDEX IF NOT EXISTS "CierreGeneralFactura_proveedorId_idx" ON "CierreGeneralFactura"("proveedorId");',
  'CREATE INDEX IF NOT EXISTS "CierreGeneralGasto_proveedorId_idx" ON "CierreGeneralGasto"("proveedorId");',

  // Postgres no soporta "ADD CONSTRAINT IF NOT EXISTS" — se guarda con un DO block que
  // revisa pg_constraint primero (idempotente, seguro de re-correr en cada deploy).
  `DO $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'CierreGeneralFactura_proveedorId_fkey'
    ) THEN
      ALTER TABLE "CierreGeneralFactura"
        ADD CONSTRAINT "CierreGeneralFactura_proveedorId_fkey"
        FOREIGN KEY ("proveedorId") REFERENCES "Proveedor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
  END $$;`,
  `DO $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'CierreGeneralGasto_proveedorId_fkey'
    ) THEN
      ALTER TABLE "CierreGeneralGasto"
        ADD CONSTRAINT "CierreGeneralGasto_proveedorId_fkey"
        FOREIGN KEY ("proveedorId") REFERENCES "Proveedor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
  END $$;`,

  // ---------------------------------------------------------------------------
  // Módulo Cierre Mensual (aditivo, aislado). Ver prisma/migrations/20260715160000_cierre_mensual/.
  // ---------------------------------------------------------------------------
  `CREATE TABLE IF NOT EXISTS "MensualCategoriaGasto" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MensualCategoriaGasto_pkey" PRIMARY KEY ("id")
  );`,
  'CREATE UNIQUE INDEX IF NOT EXISTS "MensualCategoriaGasto_nombre_key" ON "MensualCategoriaGasto"("nombre");',

  `CREATE TABLE IF NOT EXISTS "MensualDia" (
    "id" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "ventaDia" INTEGER NOT NULL DEFAULT 0,
    "comisionTarjeta" INTEGER NOT NULL DEFAULT 0,
    "impuesto4x1000" INTEGER NOT NULL DEFAULT 0,
    "carteraTotal" INTEGER NOT NULL DEFAULT 0,
    "nota" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MensualDia_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "MensualDia_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
  );`,
  'CREATE UNIQUE INDEX IF NOT EXISTS "MensualDia_date_key" ON "MensualDia"("date");',
  'CREATE INDEX IF NOT EXISTS "MensualDia_date_idx" ON "MensualDia"("date");',

  `CREATE TABLE IF NOT EXISTS "MensualGasto" (
    "id" TEXT NOT NULL,
    "mensualDiaId" TEXT NOT NULL,
    "categoriaId" TEXT NOT NULL,
    "monto" INTEGER NOT NULL,
    "descripcion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MensualGasto_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "MensualGasto_mensualDiaId_fkey" FOREIGN KEY ("mensualDiaId") REFERENCES "MensualDia"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MensualGasto_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "MensualCategoriaGasto"("id") ON DELETE RESTRICT ON UPDATE CASCADE
  );`,
  'CREATE INDEX IF NOT EXISTS "MensualGasto_mensualDiaId_idx" ON "MensualGasto"("mensualDiaId");',

  `CREATE TABLE IF NOT EXISTS "MensualDiferencia" (
    "id" TEXT NOT NULL,
    "mensualDiaId" TEXT NOT NULL,
    "cierre" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "monto" INTEGER NOT NULL,
    "disposicion" TEXT,
    "nota" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MensualDiferencia_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "MensualDiferencia_mensualDiaId_fkey" FOREIGN KEY ("mensualDiaId") REFERENCES "MensualDia"("id") ON DELETE CASCADE ON UPDATE CASCADE
  );`,
  'CREATE INDEX IF NOT EXISTS "MensualDiferencia_mensualDiaId_idx" ON "MensualDiferencia"("mensualDiaId");',

  // ---------------------------------------------------------------------------
  // Resumen Cierre general: % de reposición dinámico (congelado por cierre) + config global
  // (% y punto de equilibrio). Ver prisma/migrations/20260717000000_cierre_general_resumen/.
  // ---------------------------------------------------------------------------
  'ALTER TABLE "CierreGeneral" ADD COLUMN IF NOT EXISTS "porcentajeReposicion" INTEGER NOT NULL DEFAULT 70;',
  `CREATE TABLE IF NOT EXISTS "CierreGeneralConfig" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "porcentajeReposicion" INTEGER NOT NULL DEFAULT 70,
    "puntoEquilibrio" INTEGER NOT NULL DEFAULT 1100000,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CierreGeneralConfig_pkey" PRIMARY KEY ("id")
  );`,
  // Fila única de arranque (id=1). ON CONFLICT DO NOTHING → idempotente, no pisa ajustes.
  `INSERT INTO "CierreGeneralConfig" ("id", "porcentajeReposicion", "puntoEquilibrio", "updatedAt")
   VALUES (1, 70, 1100000, CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING;`,

  // ---------------------------------------------------------------------------
  // Saldos por plataforma (Cierre general, 2026-07-17). Ver prisma/migrations/20260717120000_saldos_plataforma/.
  // ---------------------------------------------------------------------------
  'ALTER TABLE "CierreGeneralGasto" ADD COLUMN IF NOT EXISTS "autoGenerado" BOOLEAN NOT NULL DEFAULT false;',

  `CREATE TABLE IF NOT EXISTS "PlataformaSaldoInicial" (
    "plataforma" TEXT NOT NULL,
    "openingBalance" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PlataformaSaldoInicial_pkey" PRIMARY KEY ("plataforma")
  );`,

  `CREATE TABLE IF NOT EXISTS "TarjetaAbono" (
    "id" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "monto" INTEGER NOT NULL,
    "nota" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TarjetaAbono_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "TarjetaAbono_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
  );`,
  'CREATE INDEX IF NOT EXISTS "TarjetaAbono_date_idx" ON "TarjetaAbono"("date");',

  `CREATE TABLE IF NOT EXISTS "PlataformaTransferencia" (
    "id" TEXT NOT NULL,
    "fromPlataforma" TEXT NOT NULL,
    "toPlataforma" TEXT NOT NULL,
    "monto" INTEGER NOT NULL,
    "impuesto4x1000" INTEGER NOT NULL DEFAULT 0,
    "nota" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PlataformaTransferencia_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "PlataformaTransferencia_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
  );`,
  'CREATE INDEX IF NOT EXISTS "PlataformaTransferencia_createdAt_idx" ON "PlataformaTransferencia"("createdAt");',

  // ---------------------------------------------------------------------------
  // Fase 2 de Saldos por plataforma (2026-07-17). Ver prisma/migrations/20260717180000_saldos_plataforma_fase2/.
  // ---------------------------------------------------------------------------
  'ALTER TABLE "Proveedor" ADD COLUMN IF NOT EXISTS "medioPagoHabitual" TEXT;',

  `CREATE TABLE IF NOT EXISTS "TarjetaConfig" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "ajustePendienteInicial" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TarjetaConfig_pkey" PRIMARY KEY ("id")
  );`,
  `INSERT INTO "TarjetaConfig" ("id", "ajustePendienteInicial", "updatedAt")
   VALUES (1, 0, CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING;`,

  'ALTER TABLE "PlataformaTransferencia" ADD COLUMN IF NOT EXISTS "gastoGeneradoId" TEXT;',
  'CREATE UNIQUE INDEX IF NOT EXISTS "PlataformaTransferencia_gastoGeneradoId_key" ON "PlataformaTransferencia"("gastoGeneradoId");',
  `DO $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'PlataformaTransferencia_gastoGeneradoId_fkey'
    ) THEN
      ALTER TABLE "PlataformaTransferencia"
        ADD CONSTRAINT "PlataformaTransferencia_gastoGeneradoId_fkey"
        FOREIGN KEY ("gastoGeneradoId") REFERENCES "CierreGeneralGasto"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
  END $$;`,

  // ---------------------------------------------------------------------------
  // Módulo LICORES (2026-07-19). Ver prisma/migrations/20260719000000_licores/.
  // ---------------------------------------------------------------------------
  `CREATE TABLE IF NOT EXISTS "LicorProducto" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "precioVenta" INTEGER NOT NULL DEFAULT 0,
    "stockMinimo" INTEGER NOT NULL DEFAULT 6,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LicorProducto_pkey" PRIMARY KEY ("id")
  );`,
  'CREATE UNIQUE INDEX IF NOT EXISTS "LicorProducto_nombre_key" ON "LicorProducto"("nombre");',

  `CREATE TABLE IF NOT EXISTS "LicorCompra" (
    "id" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "valorTotal" INTEGER NOT NULL,
    "proveedor" TEXT,
    "descripcion" TEXT,
    "metodoPago" TEXT NOT NULL,
    "movementId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "LicorCompra_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "LicorCompra_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "LicorProducto"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "LicorCompra_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
  );`,
  'CREATE INDEX IF NOT EXISTS "LicorCompra_productoId_deletedAt_idx" ON "LicorCompra"("productoId", "deletedAt");',
  'CREATE INDEX IF NOT EXISTS "LicorCompra_date_idx" ON "LicorCompra"("date");',

  `CREATE TABLE IF NOT EXISTS "LicorVenta" (
    "id" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "shift" INTEGER NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "precioUnitario" INTEGER NOT NULL,
    "costoUnitario" INTEGER NOT NULL,
    "metodoPago" TEXT NOT NULL,
    "descuento" BOOLEAN NOT NULL DEFAULT false,
    "movementId" TEXT,
    "nota" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "LicorVenta_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "LicorVenta_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "LicorProducto"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "LicorVenta_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
  );`,
  'CREATE INDEX IF NOT EXISTS "LicorVenta_productoId_deletedAt_idx" ON "LicorVenta"("productoId", "deletedAt");',
  'CREATE INDEX IF NOT EXISTS "LicorVenta_date_idx" ON "LicorVenta"("date");',

  // ---------------------------------------------------------------------------
  // Licores: cartera propia + cierre esporádico (2026-07-19).
  // Ver prisma/migrations/20260719120000_licores_cartera_cierre/.
  // ---------------------------------------------------------------------------
  `CREATE TABLE IF NOT EXISTS "LicorCliente" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "telefono" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LicorCliente_pkey" PRIMARY KEY ("id")
  );`,
  'CREATE UNIQUE INDEX IF NOT EXISTS "LicorCliente_nombre_key" ON "LicorCliente"("nombre");',

  `CREATE TABLE IF NOT EXISTS "LicorCierre" (
    "id" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "ventasEfectivo" INTEGER NOT NULL DEFAULT 0,
    "ventasPlataforma" INTEGER NOT NULL DEFAULT 0,
    "ventasCredito" INTEGER NOT NULL DEFAULT 0,
    "abonosEfectivo" INTEGER NOT NULL DEFAULT 0,
    "abonosPlataforma" INTEGER NOT NULL DEFAULT 0,
    "comprasEfectivo" INTEGER NOT NULL DEFAULT 0,
    "comprasPlataforma" INTEGER NOT NULL DEFAULT 0,
    "efectivoEsperado" INTEGER NOT NULL DEFAULT 0,
    "efectivoContado" INTEGER NOT NULL DEFAULT 0,
    "diferencia" INTEGER NOT NULL DEFAULT 0,
    "nota" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LicorCierre_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "LicorCierre_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
  );`,
  'CREATE INDEX IF NOT EXISTS "LicorCierre_date_idx" ON "LicorCierre"("date");',

  `CREATE TABLE IF NOT EXISTS "LicorAbono" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "monto" INTEGER NOT NULL,
    "medioPago" TEXT NOT NULL,
    "nota" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),
    "licorCierreId" TEXT,
    CONSTRAINT "LicorAbono_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "LicorAbono_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "LicorCliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "LicorAbono_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "LicorAbono_licorCierreId_fkey" FOREIGN KEY ("licorCierreId") REFERENCES "LicorCierre"("id") ON DELETE SET NULL ON UPDATE CASCADE
  );`,
  'CREATE INDEX IF NOT EXISTS "LicorAbono_clienteId_deletedAt_idx" ON "LicorAbono"("clienteId", "deletedAt");',
  'CREATE INDEX IF NOT EXISTS "LicorAbono_date_idx" ON "LicorAbono"("date");',
  'CREATE INDEX IF NOT EXISTS "LicorAbono_licorCierreId_idx" ON "LicorAbono"("licorCierreId");',

  // Columnas nuevas sobre las tablas de licores ya creadas (aditivo).
  'ALTER TABLE "LicorVenta" ADD COLUMN IF NOT EXISTS "clienteId" TEXT;',
  'ALTER TABLE "LicorVenta" ADD COLUMN IF NOT EXISTS "licorCierreId" TEXT;',
  'ALTER TABLE "LicorCompra" ADD COLUMN IF NOT EXISTS "licorCierreId" TEXT;',
  'CREATE INDEX IF NOT EXISTS "LicorVenta_clienteId_deletedAt_idx" ON "LicorVenta"("clienteId", "deletedAt");',
  'CREATE INDEX IF NOT EXISTS "LicorVenta_licorCierreId_idx" ON "LicorVenta"("licorCierreId");',
  'CREATE INDEX IF NOT EXISTS "LicorCompra_licorCierreId_idx" ON "LicorCompra"("licorCierreId");',
  `DO $$
  BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'LicorVenta_clienteId_fkey') THEN
      ALTER TABLE "LicorVenta" ADD CONSTRAINT "LicorVenta_clienteId_fkey"
        FOREIGN KEY ("clienteId") REFERENCES "LicorCliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'LicorVenta_licorCierreId_fkey') THEN
      ALTER TABLE "LicorVenta" ADD CONSTRAINT "LicorVenta_licorCierreId_fkey"
        FOREIGN KEY ("licorCierreId") REFERENCES "LicorCierre"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'LicorCompra_licorCierreId_fkey') THEN
      ALTER TABLE "LicorCompra" ADD CONSTRAINT "LicorCompra_licorCierreId_fkey"
        FOREIGN KEY ("licorCierreId") REFERENCES "LicorCierre"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
  END $$;`,
];

let aplicado = false;
let ultimoError = null;
for (const url of candidatos) {
  const client = new pg.Client({ connectionString: url });
  try {
    await client.connect();
    for (const sql of statements) await client.query(sql);
    console.log("ensure-columns ✓ vía", url.includes("-pooler") ? "pooled" : "directa");
    aplicado = true;
    await client.end().catch(() => {});
    break;
  } catch (e) {
    ultimoError = e;
    console.warn("ensure-columns: falló un endpoint, probando el siguiente…", e.message);
    await client.end().catch(() => {});
  }
}

if (!aplicado) {
  console.error("ensure-columns FALLÓ en todos los endpoints:", ultimoError?.message);
  process.exit(1); // el build falla → no se publica código que espere una columna inexistente
}
