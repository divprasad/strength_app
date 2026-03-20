import "server-only";

import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { DEFAULT_MUSCLE_GROUPS, DEFAULT_VOLUME_CONFIG } from "@/lib/constants";
import { createId, nowIso } from "@/lib/utils";
import { muscles, schema, settings, users } from "@/server/db/schema";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_FILE = path.join(DATA_DIR, "strength.sqlite");
const DEFAULT_USER_ID = "primary";

let connection: ReturnType<typeof drizzle> | null = null;

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function initializeSchema(sqlite: Database.Database) {
  sqlite.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS settings (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      volume_primary_multiplier REAL NOT NULL,
      volume_secondary_multiplier REAL NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS muscles (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS muscles_user_name_idx ON muscles(user_id, name);
    CREATE TABLE IF NOT EXISTS exercises (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      category TEXT,
      equipment TEXT,
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS exercises_user_name_idx ON exercises(user_id, name);
    CREATE TABLE IF NOT EXISTS exercise_muscles (
      exercise_id TEXT NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
      muscle_id TEXT NOT NULL REFERENCES muscles(id) ON DELETE RESTRICT,
      is_primary INTEGER NOT NULL,
      PRIMARY KEY (exercise_id, muscle_id, is_primary)
    );
    CREATE TABLE IF NOT EXISTS workouts (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      date TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('draft', 'active', 'completed')),
      notes TEXT,
      session_started_at TEXT,
      session_ended_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS workouts_user_date_idx ON workouts(user_id, date);
    CREATE TABLE IF NOT EXISTS workout_exercises (
      id TEXT PRIMARY KEY NOT NULL,
      workout_id TEXT NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
      exercise_id TEXT NOT NULL REFERENCES exercises(id) ON DELETE RESTRICT,
      order_index INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      started_at TEXT,
      completed_at TEXT
    );
    CREATE UNIQUE INDEX IF NOT EXISTS workout_exercises_workout_order_idx ON workout_exercises(workout_id, order_index);
    CREATE TABLE IF NOT EXISTS set_entries (
      id TEXT PRIMARY KEY NOT NULL,
      workout_exercise_id TEXT NOT NULL REFERENCES workout_exercises(id) ON DELETE CASCADE,
      set_number INTEGER NOT NULL,
      reps INTEGER NOT NULL,
      weight INTEGER NOT NULL,
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS set_entries_workout_set_idx ON set_entries(workout_exercise_id, set_number);
  `);
}

function seedIfNeeded(db: ReturnType<typeof drizzle>) {
  const existingUser = db.select().from(users).where(eq(users.id, DEFAULT_USER_ID)).get();
  if (existingUser) return;
  const now = nowIso();
  db.insert(users).values({ id: DEFAULT_USER_ID, createdAt: now, updatedAt: now }).run();
  db.insert(settings).values({
    id: "default",
    userId: DEFAULT_USER_ID,
    volumePrimaryMultiplier: DEFAULT_VOLUME_CONFIG.primary,
    volumeSecondaryMultiplier: DEFAULT_VOLUME_CONFIG.secondary,
    createdAt: now,
    updatedAt: now
  }).run();

  for (const name of DEFAULT_MUSCLE_GROUPS) {
    db.insert(muscles)
      .values({
        id: createId("muscle"),
        userId: DEFAULT_USER_ID,
        name,
        createdAt: now,
        updatedAt: now
      })
      .run();
  }
}

export function getDb() {
  if (connection) return connection;
  ensureDataDir();
  const sqlite = new Database(DB_FILE);
  initializeSchema(sqlite);
  connection = drizzle(sqlite, { schema });
  seedIfNeeded(connection);
  return connection;
}

export function getCurrentUserId() {
  return DEFAULT_USER_ID;
}
