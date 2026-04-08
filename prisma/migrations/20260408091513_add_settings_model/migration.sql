-- CreateTable
CREATE TABLE "Settings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "volumePrimaryMultiplier" REAL NOT NULL DEFAULT 1.0,
    "volumeSecondaryMultiplier" REAL NOT NULL DEFAULT 0.5,
    "gymFee" REAL,
    "gymFeePeriodDays" INTEGER,
    "gymFeeTargetPerSession" REAL,
    "appScale" REAL NOT NULL DEFAULT 1.0,
    "updatedAt" DATETIME NOT NULL
);
