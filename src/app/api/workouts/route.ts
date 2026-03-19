import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import type { WorkoutBundle } from "@/types/domain";

const DATA_DIR = path.join(process.cwd(), "data");
const SQL_FILE = path.join(DATA_DIR, "workouts.sql");

type Payload = {
  action: "start" | "finish" | "sync";
  userId: string;
  bundle: WorkoutBundle;
};

async function ensureDataDir() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
  } catch {
    /* ignore */
  }
}

function escapeSql(value: string | number | boolean | null | undefined) {
  if (value === null || typeof value === "undefined") {
    return "NULL";
  }
  const normalized = String(value).replace(/'/g, "''");
  return `'${normalized}'`;
}

function buildStatements(payload: Payload) {
  const { action, userId, bundle } = payload;
  const lines: string[] = [];
  lines.push(`-- ${action} @ ${new Date().toISOString()} user=${userId}`);

  const workout = bundle.workout;
  lines.push(
    `INSERT INTO workouts (id, date, notes, created_at, updated_at, user_id, session_started_at, session_ended_at) VALUES (${escapeSql(
      workout.id
    )}, ${escapeSql(workout.date)}, ${escapeSql(workout.notes ?? null)}, ${escapeSql(workout.createdAt)}, ${escapeSql(
      workout.updatedAt
    )}, ${escapeSql(userId)}, ${escapeSql(workout.sessionStartedAt ?? null)}, ${escapeSql(workout.sessionEndedAt ?? null)});`
  );

  for (const item of bundle.items) {
    const exercise = item.workoutExercise;
    lines.push(
      `INSERT INTO workout_exercises (id, workout_id, exercise_id, order_index, created_at, started_at, completed_at) VALUES (${escapeSql(
        exercise.id
      )}, ${escapeSql(exercise.workoutId)}, ${escapeSql(exercise.exerciseId)}, ${escapeSql(exercise.orderIndex)}, ${escapeSql(
        exercise.createdAt
      )}, ${escapeSql(exercise.startedAt ?? null)}, ${escapeSql(exercise.completedAt ?? null)});`
    );
    for (const setEntry of item.sets) {
      lines.push(
        `INSERT INTO set_entries (id, workout_exercise_id, set_number, reps, weight, notes, created_at, updated_at) VALUES (${escapeSql(
          setEntry.id
        )}, ${escapeSql(setEntry.workoutExerciseId)}, ${escapeSql(setEntry.setNumber)}, ${escapeSql(setEntry.reps)}, ${escapeSql(
          setEntry.weight
        )}, ${escapeSql(setEntry.notes ?? null)}, ${escapeSql(setEntry.createdAt)}, ${escapeSql(setEntry.updatedAt)});`
      );
    }
  }

  return lines.join("\n") + "\n";
}

export async function POST(request: NextRequest) {
  const payload = (await request.json()) as Payload;
  if (!payload?.bundle) {
    return NextResponse.json({ error: "Missing bundle" }, { status: 400 });
  }
  await ensureDataDir();
  const statements = buildStatements(payload);
  await fs.appendFile(SQL_FILE, statements);
  return NextResponse.json({ status: "ok", action: payload.action });
}
