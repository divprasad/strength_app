const fs = require("fs");
const path = require("path");

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

    // Table names - Quoted and Case Sensitive
    newLine = newLine.replace("INSERT INTO workouts", "INSERT OR REPLACE INTO \"Workout\"");
    newLine = newLine.replace("INSERT INTO workout_exercises", "INSERT OR REPLACE INTO \"WorkoutExercise\"");
    newLine = newLine.replace("INSERT INTO set_entries", "INSERT OR REPLACE INTO \"SetEntry\"");

    // Column name replacements (ORDER MATTERS: longest first)
    const replacements = [
        ["workout_exercise_id", "workoutExerciseId"],
        ["session_started_at", "sessionStartedAt"],
        ["session_ended_at", "sessionEndedAt"],
        ["exercise_id", "exerciseId"],
        ["workout_id", "workoutId"],
        ["created_at", "createdAt"],
        ["updated_at", "updatedAt"],
        ["order_index", "orderIndex"],
        ["started_at", "startedAt"],
        ["completed_at", "completedAt"],
        ["set_number", "setNumber"],
        ["user_id", "userId"]
    ];

    for (const [oldName, newName] of replacements) {
        newLine = newLine.split(oldName).join(newName);
    }

    // Wrap columns in quotes for safety
    newLine = newLine.replace(/\(([^)]+)\) VALUES/, (match, cols) => {
        const quotedCols = cols.split(', ').map(c => `"${c.trim()}"`).join(', ');
        return `(${quotedCols}) VALUES`;
    });

    // Handle name field for Workout
    if (newLine.includes("INSERT OR REPLACE INTO \"Workout\"") && !newLine.includes("\"name\"")) {
        newLine = newLine.replace("(\"id\",", "(\"id\", \"name\",");
        const dateMatch = newLine.match(/'(\d{4}-\d{2}-\d{2})'/);
        const name = dateMatch ? `Workout ${dateMatch[1]}` : "Workout";
        newLine = newLine.replace("VALUES ('", `VALUES ('${name}', '`);
    }

    transformed += newLine + "\n";
}

transformed += "COMMIT;\nPRAGMA foreign_keys=ON;\n";

fs.writeFileSync(outputFile, transformed);
console.log("Transformed SQL saved to data/workouts_transformed.sql");
