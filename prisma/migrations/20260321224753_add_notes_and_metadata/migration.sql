/*
  Warnings:

  - You are about to drop the column `order` on the `WorkoutExercise` table. All the data in the column will be lost.
  - Added the required column `setNumber` to the `SetEntry` table without a default value. This is not possible if the table is not empty.
  - Added the required column `date` to the `Workout` table without a default value. This is not possible if the table is not empty.
  - Added the required column `orderIndex` to the `WorkoutExercise` table without a default value. This is not possible if the table is not empty.

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
    "type" TEXT NOT NULL,
    "notes" TEXT,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SetEntry_workoutExerciseId_fkey" FOREIGN KEY ("workoutExerciseId") REFERENCES "WorkoutExercise" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_SetEntry" ("completedAt", "createdAt", "id", "reps", "type", "weight", "workoutExerciseId") SELECT "completedAt", "createdAt", "id", "reps", "type", "weight", "workoutExerciseId" FROM "SetEntry";
DROP TABLE "SetEntry";
ALTER TABLE "new_SetEntry" RENAME TO "SetEntry";
CREATE TABLE "new_Workout" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "notes" TEXT,
    "status" TEXT NOT NULL,
    "userId" TEXT NOT NULL DEFAULT 'default_user',
    "sessionStartedAt" DATETIME,
    "sessionEndedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Workout" ("createdAt", "id", "name", "sessionEndedAt", "sessionStartedAt", "status", "updatedAt", "userId") SELECT "createdAt", "id", "name", "sessionEndedAt", "sessionStartedAt", "status", "updatedAt", "userId" FROM "Workout";
DROP TABLE "Workout";
ALTER TABLE "new_Workout" RENAME TO "Workout";
CREATE TABLE "new_WorkoutExercise" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workoutId" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    CONSTRAINT "WorkoutExercise_workoutId_fkey" FOREIGN KEY ("workoutId") REFERENCES "Workout" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_WorkoutExercise" ("completedAt", "exerciseId", "id", "startedAt", "workoutId") SELECT "completedAt", "exerciseId", "id", "startedAt", "workoutId" FROM "WorkoutExercise";
DROP TABLE "WorkoutExercise";
ALTER TABLE "new_WorkoutExercise" RENAME TO "WorkoutExercise";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
