-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_WorkoutExercise" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workoutId" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME,
    CONSTRAINT "WorkoutExercise_workoutId_fkey" FOREIGN KEY ("workoutId") REFERENCES "Workout" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_WorkoutExercise" ("completedAt", "createdAt", "exerciseId", "id", "orderIndex", "startedAt", "updatedAt", "workoutId") SELECT "completedAt", "createdAt", "exerciseId", "id", "orderIndex", "startedAt", "updatedAt", "workoutId" FROM "WorkoutExercise";
DROP TABLE "WorkoutExercise";
ALTER TABLE "new_WorkoutExercise" RENAME TO "WorkoutExercise";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
