-- CreateTable
CREATE TABLE "PocketBalance" (
    "bucket" TEXT NOT NULL PRIMARY KEY,
    "openingBalance" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" DATETIME NOT NULL
);
