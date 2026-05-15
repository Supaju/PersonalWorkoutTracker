-- AlterTable
ALTER TABLE "WorkoutSession" ADD COLUMN "planningChat" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_CycleState" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'singleton',
    "currentTemplate" TEXT NOT NULL DEFAULT 'upper_b',
    "sessionCount" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_CycleState" ("currentTemplate", "id", "sessionCount", "updatedAt") SELECT "currentTemplate", "id", "sessionCount", "updatedAt" FROM "CycleState";
DROP TABLE "CycleState";
ALTER TABLE "new_CycleState" RENAME TO "CycleState";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
