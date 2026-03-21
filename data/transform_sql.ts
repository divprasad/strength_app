import * as fs from "fs";
import * as path from "path";

const sqlFile = path.join(process.cwd(), "data", "workouts.sql");
const outputFile = path.join(process.cwd(), "data", "workouts_transformed.sql");

if (!fs.existsSync(sqlFile)) {
    console.error("workouts.sql not found");
    process.exit(1);
}

const content = fs.readFileSync(sqlFile, "utf-8");
const lines = content.split("\n");

let transformed = "PRAGMA foreign_keys=OFF;\nBEGIN TRANSACTION;\n";

for (const line of lines) {
    if (!line.startsWith("INSERT")) {
        transformed += line + "\n";
        continue;
    }

    let newLine = line;

    // Table names
    newLine = newLine.replace("INSERT INTO workouts", "INSERT OR REPLACE INTO Workout");
    newLine = newLine.replace("INSERT INTO workout_exercises", "INSERT OR REPLACE INTO WorkoutExercise");
    newLine = newLine.replace("INSERT INTO set_entries", "INSERT OR REPLACE INTO SetEntry");

    // Column names (case sensitive in Prisma SQLite)
    newLine = newLine.replace("user_id", "userId");
    newLine = newLine.replace("session_started_at", "sessionStartedAt");
    newLine = newLine.replace("session_ended_at", "sessionEndedAt");
    newLine = newLine.replace("created_at", "createdAt");
    newLine = newLine.replace("updated_at", "updatedAt");
    newLine = newLine.replace("workout_id", "workoutId");
    newLine = newLine.replace("exercise_id", "exerciseId");
    newLine = newLine.replace("order_index", "orderIndex");
    newLine = newLine.replace("started_at", "startedAt");
    newLine = newLine.replace("completed_at", "completedAt");
    newLine = newLine.replace("workout_exercise_id", "workoutExerciseId");
    newLine = newLine.replace("set_number", "setNumber");

    // Add name field if it's a Workout insert and missing
    if (newLine.includes("INSERT OR REPLACE INTO Workout") && !newLine.includes("name")) {
        // Find (id, ...) and VALUES ('...', ...)
        newLine = newLine.replace("(id,", "(id, name,");
        // Simple hack: use date as name if we can find it
        const dateMatch = newLine.match(/'(\d{4}-\d{2}-\d{2})'/);
        const name = dateMatch ? `Workout ${dateMatch[1]}` : "Workout";
        newLine = newLine.replace("VALUES ('", `VALUES ('${name}', '`);
    }
    
    // Status field for Workout
    if (newLine.includes("INSERT OR REPLACE INTO Workout")) {
        if (!newLine.includes("status")) {
            newLine = newLine.replace("sessionEndedAt)", "status, sessionEndedAt)");
            // Check if last value (session_ended_at) is NULL or a string
            const isCompleted = !newLine.trim().endsWith("NULL);");
            const status = isCompleted ? "completed" : "active";
            newLine = newLine.replace("NULL);", `'${status}', NULL);`);
            // if it wasn't NULL, it's harder to inject. We'll just assume completed for now if not NULL
            if (!newLine.includes(`'${status}'`)) {
                // Find trailing ... '2026-...')
                newLine = newLine.replace(/(\'[\d\-\:TZ\.]+\'|NULL)\);$/, `$1, '${status}');`);
            }
        }
    }

    transformed += newLine + "\n";
}

transformed += "COMMIT;\nPRAGMA foreign_keys=ON;\n";

fs.writeFileSync(outputFile, transformed);
console.log("Transformed SQL saved to data/workouts_transformed.sql");
