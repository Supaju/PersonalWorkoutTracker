-- Coach v2: introduce Client. All existing single-user rows are assigned to client id 'owner'.
-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "persona" TEXT NOT NULL,
    "trainingDays" TEXT NOT NULL DEFAULT '[1,2,4,5]',
    "defaultMinutes" INTEGER NOT NULL DEFAULT 60,
    "hardCapMinutes" INTEGER NOT NULL DEFAULT 90,
    "layoffDays" INTEGER NOT NULL DEFAULT 10,
    "reviewEveryWeeks" INTEGER NOT NULL DEFAULT 4,
    "webResearch" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Owner client (existing data)
INSERT INTO "Client" ("id", "name", "persona") SELECT 'owner', COALESCE((SELECT "name" FROM "UserProfile" LIMIT 1), 'Owner'), 'Calm, direct, encouraging personal trainer. Explain the why in a sentence or two. Celebrate consistency over intensity; frame missed days without guilt. No gym-bro slang.';

-- CreateTable
CREATE TABLE "ClientConsideration" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clientId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ClientConsideration_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ExercisePreference" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clientId" TEXT NOT NULL,
    "exerciseName" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "substituteFor" TEXT,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExercisePreference_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProgramVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clientId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "phase" TEXT NOT NULL,
    "structure" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "startDate" TEXT NOT NULL,
    "endDate" TEXT,
    "proposalId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProgramVersion_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProgramVersion_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "ProgramProposal" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProgramProposal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clientId" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "observations" TEXT NOT NULL,
    "recommendation" TEXT NOT NULL,
    "rationale" TEXT NOT NULL,
    "tradeOffs" TEXT NOT NULL,
    "weekToWeek" TEXT NOT NULL,
    "structure" TEXT NOT NULL,
    "researchNoteIds" TEXT NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "clientResponse" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" DATETIME,
    CONSTRAINT "ProgramProposal_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ResearchNote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clientId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "applicationToClient" TEXT NOT NULL,
    "confidence" TEXT NOT NULL,
    "sources" TEXT NOT NULL,
    "proposalId" TEXT,
    "sessionId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ResearchNote_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CoachMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clientId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "action" TEXT,
    "sessionId" TEXT,
    "proposalId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CoachMessage_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CardioLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "exerciseId" TEXT NOT NULL,
    "machine" TEXT NOT NULL,
    "minutes" REAL NOT NULL,
    "settings" TEXT,
    "intervals" TEXT,
    "perceivedEffort" INTEGER,
    "talkTest" TEXT,
    "heartRate" INTEGER,
    "distanceMi" REAL,
    "calories" INTEGER,
    "notes" TEXT,
    "loggedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CardioLog_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "SessionExercise" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ExerciseFeedback" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "exerciseId" TEXT NOT NULL,
    "tags" TEXT NOT NULL,
    "painLocation" TEXT,
    "painSharp" BOOLEAN,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExerciseFeedback_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "SessionExercise" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CheckIn" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clientId" TEXT NOT NULL,
    "sessionId" TEXT,
    "kind" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "soreness" TEXT,
    "sleep" TEXT,
    "energy" TEXT,
    "minutesAvailable" INTEGER,
    "painNotes" TEXT,
    "effort" INTEGER,
    "enjoyment" INTEGER,
    "conditioning" TEXT,
    "bodyweightLbs" REAL,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CheckIn_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CheckIn_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "WorkoutSession" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ClarifyingQuestion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "exerciseName" TEXT,
    "kind" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "options" TEXT NOT NULL,
    "answer" TEXT,
    "answeredAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ClarifyingQuestion_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "WorkoutSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AIReview" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clientId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewText" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    CONSTRAINT "AIReview_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_AIReview" ("clientId", "category", "createdAt", "id", "reviewText") SELECT 'owner', "category", "createdAt", "id", "reviewText" FROM "AIReview";
DROP TABLE "AIReview";
ALTER TABLE "new_AIReview" RENAME TO "AIReview";
CREATE TABLE "new_Equipment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clientId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    CONSTRAINT "Equipment_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Equipment" ("clientId", "category", "id", "name") SELECT 'owner', "category", "id", "name" FROM "Equipment";
DROP TABLE "Equipment";
ALTER TABLE "new_Equipment" RENAME TO "Equipment";
CREATE INDEX "Equipment_clientId_idx" ON "Equipment"("clientId");
CREATE TABLE "new_MealPlan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clientId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "meals" TEXT NOT NULL,
    CONSTRAINT "MealPlan_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_MealPlan" ("clientId", "date", "id", "meals") SELECT 'owner', "date", "id", "meals" FROM "MealPlan";
DROP TABLE "MealPlan";
ALTER TABLE "new_MealPlan" RENAME TO "MealPlan";
CREATE UNIQUE INDEX "MealPlan_clientId_date_key" ON "MealPlan"("clientId", "date");
CREATE TABLE "new_NutritionChat" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clientId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NutritionChat_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_NutritionChat" ("clientId", "content", "createdAt", "date", "id", "role") SELECT 'owner', "content", "createdAt", "date", "id", "role" FROM "NutritionChat";
DROP TABLE "NutritionChat";
ALTER TABLE "new_NutritionChat" RENAME TO "NutritionChat";
CREATE INDEX "NutritionChat_clientId_date_idx" ON "NutritionChat"("clientId", "date");
CREATE TABLE "new_NutritionEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clientId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "slot" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "calories" REAL NOT NULL,
    "protein" REAL NOT NULL,
    "carbs" REAL NOT NULL,
    "fat" REAL NOT NULL,
    "source" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NutritionEntry_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_NutritionEntry" ("clientId", "calories", "carbs", "createdAt", "date", "description", "fat", "id", "protein", "slot", "source") SELECT 'owner', "calories", "carbs", "createdAt", "date", "description", "fat", "id", "protein", "slot", "source" FROM "NutritionEntry";
DROP TABLE "NutritionEntry";
ALTER TABLE "new_NutritionEntry" RENAME TO "NutritionEntry";
CREATE INDEX "NutritionEntry_clientId_date_idx" ON "NutritionEntry"("clientId", "date");
CREATE TABLE "new_SessionExercise" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "slot" TEXT NOT NULL DEFAULT '',
    "name" TEXT NOT NULL,
    "muscleGroups" TEXT NOT NULL,
    "block" TEXT NOT NULL DEFAULT 'strength',
    "pairGroup" TEXT,
    "unit" TEXT NOT NULL DEFAULT 'total',
    "restSec" INTEGER,
    "cue" TEXT,
    "prescription" TEXT,
    "targetSets" INTEGER NOT NULL DEFAULT 0,
    "targetReps" TEXT NOT NULL DEFAULT '',
    "targetWeight" REAL,
    "orderIndex" INTEGER NOT NULL,
    "aiNotes" TEXT,
    "added" BOOLEAN NOT NULL DEFAULT false,
    "swappedFrom" TEXT,
    "skipped" BOOLEAN NOT NULL DEFAULT false,
    "skipReason" TEXT,
    CONSTRAINT "SessionExercise_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "WorkoutSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_SessionExercise" ("aiNotes", "id", "muscleGroups", "name", "orderIndex", "sessionId", "slot", "targetReps", "targetSets", "targetWeight") SELECT "aiNotes", "id", "muscleGroups", "name", "orderIndex", "sessionId", "slot", "targetReps", "targetSets", "targetWeight" FROM "SessionExercise";
DROP TABLE "SessionExercise";
ALTER TABLE "new_SessionExercise" RENAME TO "SessionExercise";
CREATE TABLE "new_SetLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "exerciseId" TEXT NOT NULL,
    "setNumber" INTEGER NOT NULL,
    "setType" TEXT NOT NULL DEFAULT 'working',
    "weightLbs" REAL,
    "reps" INTEGER,
    "rir" INTEGER,
    "durationSec" INTEGER,
    "distanceYd" REAL,
    "notes" TEXT,
    "loggedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SetLog_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "SessionExercise" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_SetLog" ("exerciseId", "id", "reps", "setNumber", "weightLbs") SELECT "exerciseId", "id", "reps", "setNumber", "weightLbs" FROM "SetLog";
DROP TABLE "SetLog";
ALTER TABLE "new_SetLog" RENAME TO "SetLog";
CREATE TABLE "new_UserProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clientId" TEXT NOT NULL,
    "name" TEXT,
    "age" INTEGER NOT NULL,
    "gender" TEXT NOT NULL,
    "heightIn" REAL NOT NULL,
    "weightLbs" REAL NOT NULL,
    "goals" TEXT NOT NULL,
    "goalNotes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "UserProfile_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_UserProfile" ("clientId", "age", "createdAt", "gender", "goals", "heightIn", "id", "name", "updatedAt", "weightLbs") SELECT 'owner', "age", "createdAt", "gender", "goals", "heightIn", "id", "name", "updatedAt", "weightLbs" FROM "UserProfile";
DROP TABLE "UserProfile";
ALTER TABLE "new_UserProfile" RENAME TO "UserProfile";
CREATE UNIQUE INDEX "UserProfile_clientId_key" ON "UserProfile"("clientId");
CREATE TABLE "new_WorkoutSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clientId" TEXT NOT NULL,
    "programVersionId" TEXT,
    "date" TEXT NOT NULL,
    "template" TEXT NOT NULL,
    "sessionType" TEXT NOT NULL DEFAULT 'legacy',
    "phase" TEXT NOT NULL DEFAULT 'planned',
    "name" TEXT,
    "estimatedMinutes" INTEGER,
    "durationMin" INTEGER,
    "startedAt" DATETIME,
    "finishedAt" DATETIME,
    "notes" TEXT,
    "coachNotes" TEXT,
    "plan" TEXT,
    "coachReview" TEXT,
    "reviewedAt" DATETIME,
    "planningChat" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WorkoutSession_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WorkoutSession_programVersionId_fkey" FOREIGN KEY ("programVersionId") REFERENCES "ProgramVersion" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_WorkoutSession" ("clientId", "createdAt", "date", "durationMin", "id", "notes", "phase", "planningChat", "template", "sessionType") SELECT 'owner', "createdAt", "date", "durationMin", "id", "notes", "phase", "planningChat", "template", "template" FROM "WorkoutSession";
DROP TABLE "WorkoutSession";
ALTER TABLE "new_WorkoutSession" RENAME TO "WorkoutSession";
CREATE INDEX "WorkoutSession_clientId_date_idx" ON "WorkoutSession"("clientId", "date");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "ClientConsideration_clientId_idx" ON "ClientConsideration"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "ExercisePreference_clientId_exerciseName_kind_key" ON "ExercisePreference"("clientId", "exerciseName", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "ProgramVersion_proposalId_key" ON "ProgramVersion"("proposalId");

-- CreateIndex
CREATE UNIQUE INDEX "ProgramVersion_clientId_version_key" ON "ProgramVersion"("clientId", "version");

-- CreateIndex
CREATE INDEX "ProgramProposal_clientId_status_idx" ON "ProgramProposal"("clientId", "status");

-- CreateIndex
CREATE INDEX "ResearchNote_clientId_idx" ON "ResearchNote"("clientId");

-- CreateIndex
CREATE INDEX "CoachMessage_clientId_createdAt_idx" ON "CoachMessage"("clientId", "createdAt");

-- CreateIndex
CREATE INDEX "CheckIn_clientId_date_idx" ON "CheckIn"("clientId", "date");
