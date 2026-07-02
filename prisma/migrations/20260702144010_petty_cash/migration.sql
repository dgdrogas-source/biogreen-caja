-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Movement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessDayId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "paymentMethod" TEXT NOT NULL,
    "note" TEXT,
    "registeredById" TEXT NOT NULL,
    "registeredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isSystemGenerated" BOOLEAN NOT NULL DEFAULT false,
    "sourceMovementId" TEXT,
    "needsReclassification" BOOLEAN NOT NULL DEFAULT false,
    "fromPettyCash" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Movement_businessDayId_fkey" FOREIGN KEY ("businessDayId") REFERENCES "BusinessDay" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Movement_registeredById_fkey" FOREIGN KEY ("registeredById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Movement_sourceMovementId_fkey" FOREIGN KEY ("sourceMovementId") REFERENCES "Movement" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Movement" ("amount", "businessDayId", "createdAt", "deletedAt", "direction", "id", "isSystemGenerated", "needsReclassification", "note", "paymentMethod", "registeredAt", "registeredById", "sourceMovementId", "type", "updatedAt") SELECT "amount", "businessDayId", "createdAt", "deletedAt", "direction", "id", "isSystemGenerated", "needsReclassification", "note", "paymentMethod", "registeredAt", "registeredById", "sourceMovementId", "type", "updatedAt" FROM "Movement";
DROP TABLE "Movement";
ALTER TABLE "new_Movement" RENAME TO "Movement";
CREATE INDEX "Movement_businessDayId_deletedAt_idx" ON "Movement"("businessDayId", "deletedAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
