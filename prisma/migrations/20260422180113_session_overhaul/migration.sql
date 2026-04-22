-- Drop old workout models
DROP TABLE IF EXISTS "Exercise";
DROP TABLE IF EXISTS "WorkoutDay";

-- CreateTable CycleState
CREATE TABLE "CycleState" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "currentTemplate" TEXT NOT NULL DEFAULT 'upper_b',
    "sessionCount" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable WorkoutSession
CREATE TABLE "WorkoutSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" TEXT NOT NULL,
    "template" TEXT NOT NULL,
    "phase" TEXT NOT NULL DEFAULT 'planned',
    "durationMin" INTEGER,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable SessionExercise
CREATE TABLE "SessionExercise" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "slot" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "muscleGroups" TEXT NOT NULL,
    "targetSets" INTEGER NOT NULL,
    "targetReps" TEXT NOT NULL,
    "targetWeight" REAL,
    "orderIndex" INTEGER NOT NULL,
    "aiNotes" TEXT,
    CONSTRAINT "SessionExercise_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "WorkoutSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable SetLog
CREATE TABLE "SetLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "exerciseId" TEXT NOT NULL,
    "setNumber" INTEGER NOT NULL,
    "weightLbs" REAL NOT NULL,
    "reps" INTEGER NOT NULL,
    CONSTRAINT "SetLog_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "SessionExercise" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Seed initial CycleState (next up is Upper B per user)
INSERT INTO "CycleState" ("id", "currentTemplate", "sessionCount", "updatedAt")
VALUES ('singleton', 'upper_b', 0, CURRENT_TIMESTAMP);
