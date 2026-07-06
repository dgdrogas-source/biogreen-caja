-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessDay" (
    "id" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "openingBalance" INTEGER,
    "closingRealBalance" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "closedAt" TIMESTAMP(3),
    "closedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessDay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Movement" (
    "id" TEXT NOT NULL,
    "businessDayId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "paymentMethod" TEXT NOT NULL,
    "note" TEXT,
    "registeredById" TEXT NOT NULL,
    "registeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isSystemGenerated" BOOLEAN NOT NULL DEFAULT false,
    "sourceMovementId" TEXT,
    "needsReclassification" BOOLEAN NOT NULL DEFAULT false,
    "pettyCashBucket" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Movement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "movementId" TEXT,
    "businessDayId" TEXT,
    "action" TEXT NOT NULL,
    "changedById" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fieldChanges" TEXT,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PocketTransfer" (
    "id" TEXT NOT NULL,
    "fromBucket" TEXT NOT NULL,
    "toBucket" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PocketTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BaseFund" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "cashPortion" INTEGER NOT NULL DEFAULT 0,
    "nequiPortion" INTEGER NOT NULL DEFAULT 1110000,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BaseFund_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PocketBalance" (
    "bucket" TEXT NOT NULL,
    "openingBalance" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PocketBalance_pkey" PRIMARY KEY ("bucket")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "BusinessDay_date_key" ON "BusinessDay"("date");

-- CreateIndex
CREATE INDEX "Movement_businessDayId_deletedAt_idx" ON "Movement"("businessDayId", "deletedAt");

-- CreateIndex
CREATE INDEX "AuditLog_changedAt_idx" ON "AuditLog"("changedAt");

-- CreateIndex
CREATE INDEX "PocketTransfer_createdAt_idx" ON "PocketTransfer"("createdAt");

-- AddForeignKey
ALTER TABLE "BusinessDay" ADD CONSTRAINT "BusinessDay_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Movement" ADD CONSTRAINT "Movement_businessDayId_fkey" FOREIGN KEY ("businessDayId") REFERENCES "BusinessDay"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Movement" ADD CONSTRAINT "Movement_registeredById_fkey" FOREIGN KEY ("registeredById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Movement" ADD CONSTRAINT "Movement_sourceMovementId_fkey" FOREIGN KEY ("sourceMovementId") REFERENCES "Movement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_movementId_fkey" FOREIGN KEY ("movementId") REFERENCES "Movement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_businessDayId_fkey" FOREIGN KEY ("businessDayId") REFERENCES "BusinessDay"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PocketTransfer" ADD CONSTRAINT "PocketTransfer_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
