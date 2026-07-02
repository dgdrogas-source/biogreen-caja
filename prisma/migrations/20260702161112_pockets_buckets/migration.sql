-- AddColumn pettyCashBucket
ALTER TABLE "Movement" ADD COLUMN "pettyCashBucket" TEXT;

-- Backfill: all existing fromPettyCash=true become pettyCashBucket='COMISION'
UPDATE "Movement" SET "pettyCashBucket" = 'COMISION' WHERE "fromPettyCash" = 1 AND "deletedAt" IS NULL;

-- DropColumn fromPettyCash
pragma foreign_keys=off;
CREATE TABLE "Movement_new" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessDayId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "paymentMethod" TEXT NOT NULL,
    "note" TEXT,
    "registeredById" TEXT NOT NULL,
    "registeredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isSystemGenerated" BOOLEAN NOT NULL DEFAULT 0,
    "sourceMovementId" TEXT,
    "needsReclassification" BOOLEAN NOT NULL DEFAULT 0,
    "pettyCashBucket" TEXT,
    "deletedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Movement_businessDayId_fkey" FOREIGN KEY ("businessDayId") REFERENCES "BusinessDay" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Movement_registeredById_fkey" FOREIGN KEY ("registeredById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Movement_sourceMovementId_fkey" FOREIGN KEY ("sourceMovementId") REFERENCES "Movement" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "Movement_new" SELECT "id", "businessDayId", "type", "direction", "amount", "paymentMethod", "note", "registeredById", "registeredAt", "isSystemGenerated", "sourceMovementId", "needsReclassification", "pettyCashBucket", "deletedAt", "createdAt", "updatedAt" FROM "Movement";
DROP TABLE "Movement";
ALTER TABLE "Movement_new" RENAME TO "Movement";
CREATE INDEX "Movement_businessDayId_deletedAt_idx" ON "Movement"("businessDayId", "deletedAt");
pragma foreign_keys=on;
