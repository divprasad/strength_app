/*
  Warnings:

  - Added the required column `updatedAt` to the `WorkoutExercise` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_SetEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workoutExerciseId" TEXT NOT NULL,
    "setNumber" INTEGER NOT NULL,
    "weight" REAL,
    "reps" INTEGER,
    "type" TEXT NOT NULL DEFAULT 'normal',
    "notes" TEXT,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SetEntry_workoutExerciseId_fkey" FOREIGN KEY ("workoutExerciseId") REFERENCES "WorkoutExercise" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_SetEntry" ("completedAt", "createdAt", "id", "notes", "reps", "setNumber", "type", "weight", "workoutExerciseId") SELECT "completedAt", "createdAt", "id", "notes", "reps", "setNumber", "type", "weight", "workoutExerciseId" FROM "SetEntry";
DROP TABLE "SetEntry";
ALTER TABLE "new_SetEntry" RENAME TO "SetEntry";
CREATE TABLE "new_Workout" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'completed',
    "userId" TEXT NOT NULL DEFAULT 'default_user',
    "sessionStartedAt" DATETIME,
    "sessionEndedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Workout" ("createdAt", "date", "id", "name", "notes", "sessionEndedAt", "sessionStartedAt", "status", "updatedAt", "userId") SELECT "createdAt", "date", "id", "name", "notes", "sessionEndedAt", "sessionStartedAt", "status", "updatedAt", "userId" FROM "Workout";
DROP TABLE "Workout";
ALTER TABLE "new_Workout" RENAME TO "Workout";
CREATE TABLE "new_WorkoutExercise" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workoutId" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WorkoutExercise_workoutId_fkey" FOREIGN KEY ("workoutId") REFERENCES "Workout" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_WorkoutExercise" ("completedAt", "exerciseId", "id", "orderIndex", "startedAt", "workoutId") SELECT "completedAt", "exerciseId", "id", "orderIndex", "startedAt", "workoutId" FROM "WorkoutExercise";
DROP TABLE "WorkoutExercise";
ALTER TABLE "new_WorkoutExercise" RENAME TO "WorkoutExercise";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
