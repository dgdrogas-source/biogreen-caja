-- CreateTable
CREATE TABLE "PocketTransfer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fromBucket" TEXT NOT NULL,
    "toBucket" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PocketTransfer_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "PocketTransfer_createdAt_idx" ON "PocketTransfer"("createdAt");
