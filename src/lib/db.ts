import Dexie, { type EntityTable } from "dexie";
import { DEFAULT_MUSCLE_GROUPS, DEFAULT_VOLUME_CONFIG, DEFAULT_USER_ID } from "@/lib/constants";
import { createStableId, nowIso } from "@/lib/utils";
import type { AppSettings, Exercise, MuscleGroup, SetEntry, SyncJob, Workout, WorkoutExercise } from "@/types/domain";

function inferWorkoutStatus(workout: Partial<Workout>): "draft" | "active" | "completed" {
  if (!workout.sessionStartedAt) return "draft";
  if (!workout.sessionEndedAt) return "active";
  return "completed";
}

class StrengthDatabase extends Dexie {
  muscleGroups!: EntityTable<MuscleGroup, "id">;
  exercises!: EntityTable<Exercise, "id">;
  workouts!: EntityTable<Workout, "id">;
  workoutExercises!: EntityTable<WorkoutExercise, "id">;
  setEntries!: EntityTable<SetEntry, "id">;
  settings!: EntityTable<AppSettings, "id">;
  syncQueue!: EntityTable<SyncJob, "id">;

  constructor() {
    super("strength-app-db");
    this.version(1).stores({
      muscles: "id, name, updatedAt",
      exercises: "id, name, updatedAt",
      workouts: "id, date, updatedAt",
      workoutExercises: "id, workoutId, exerciseId, [workoutId+orderIndex]",
      setEntries: "id, workoutExerciseId, [workoutExerciseId+setNumber], updatedAt",
      settings: "id"
    });

    this.version(2)
      .stores({
        muscles: "id, name, updatedAt",
        exercises: "id, name, updatedAt",
        workouts: "id, date, status, updatedAt, userId",
        workoutExercises: "id, workoutId, exerciseId, [workoutId+orderIndex]",
        setEntries: "id, workoutExerciseId, [workoutExerciseId+setNumber], updatedAt",
        settings: "id"
      })
      .upgrade(async (tx) => {
        await tx.table("workouts").toCollection().modify((workout: Partial<Workout>) => {
          if (!workout.userId) {
            workout.userId = DEFAULT_USER_ID;
          }
          if (!workout.status) {
            workout.status = inferWorkoutStatus(workout);
          }
        });
      });

    this.version(4)
      .stores({
        muscles: "id, name, updatedAt",
        exercises: "id, name, updatedAt",
        workouts: "id, date, name, status, updatedAt, userId",
        workoutExercises: "id, workoutId, exerciseId, [workoutId+orderIndex]",
        setEntries: "id, workoutExerciseId, [workoutExerciseId+setNumber], updatedAt",
        settings: "id"
      })
      .upgrade(async (tx) => {
        await tx.table("workouts").toCollection().modify((workout) => {
          if (!workout.name) {
            workout.name = `Workout ${workout.date}`;
          }
        });
        await tx.table("setEntries").toCollection().modify((set) => {
          if (!set.type) {
            set.type = "normal";
          }
        });
      });

    this.version(5)
      .stores({
        muscles: "id, name, updatedAt",
        exercises: "id, name, updatedAt",
        workouts: "id, date, name, status, updatedAt, userId",
        workoutExercises: "id, workoutId, exerciseId, [workoutId+orderIndex]",
        setEntries: "id, workoutExerciseId, [workoutExerciseId+setNumber], updatedAt",
        settings: "id",
        syncQueue: "id, status, createdAt"
      });

    this.version(7)
      .stores({
        muscleGroups: "id, name, updatedAt", // renamed from muscles
        muscles: null, // explicitly drop the old store
        exercises: "id, name, updatedAt",
        workouts: "id, date, name, status, updatedAt, userId",
        workoutExercises: "id, workoutId, exerciseId, [workoutId+orderIndex]",
        setEntries: "id, workoutExerciseId, [workoutExerciseId+setNumber], updatedAt",
        settings: "id",
        syncQueue: "id, status, createdAt"
      })
      .upgrade(async (tx) => {
        // Copy all rows from the old 'muscles' store into 'muscleGroups'.
        const rows = await tx.table("muscles").toArray();
        if (rows.length > 0) {
          await tx.table("muscleGroups").bulkPut(rows);
        }
      });

    this.version(8)
      .stores({
        muscleGroups: "id, name, updatedAt",
        exercises: "id, name, updatedAt",
        workouts: "id, date, name, status, updatedAt, userId",
        workoutExercises: "id, workoutId, exerciseId, [workoutId+orderIndex]",
        setEntries: "id, workoutExerciseId, [workoutExerciseId+setNumber], updatedAt",
        settings: "id, userId",
        syncQueue: "id, status, createdAt"
      });

    this.muscleGroups = this.table("muscleGroups");
    this.exercises = this.table("exercises");
    this.workouts = this.table("workouts");
    this.workoutExercises = this.table("workoutExercises");
    this.setEntries = this.table("setEntries");
    this.settings = this.table("settings");
    this.syncQueue = this.table("syncQueue");
    this.on("populate", async () => {
      await seedDatabase(this);
    });
  }
}

export const db = new StrengthDatabase();

let bootstrapPromise: Promise<void> | null = null;

export function ensureBootstrapped(): Promise<void> {
  if (!bootstrapPromise) {
    bootstrapPromise = bootstrapIfNeeded().catch((err) => {
      // Reset so future calls can retry instead of returning a dead promise
      bootstrapPromise = null;
      throw err;
    });
  }
  return bootstrapPromise;
}

async function bootstrapIfNeeded(): Promise<void> {
  const settings = await db.settings.get("default");

  if (!settings) {
    console.log("Initializing local database settings...");
    await seedDatabase(db);
  }
}

async function seedDatabase(database: StrengthDatabase): Promise<void> {
  const now = nowIso();
  await database.transaction("rw", [database.muscleGroups, database.settings], async () => {
    await database.settings.clear();
    await database.settings.put({
      id: "default",
      volumePrimaryMultiplier: DEFAULT_VOLUME_CONFIG.primary,
      volumeSecondaryMultiplier: DEFAULT_VOLUME_CONFIG.secondary
    });

    // Seed default muscle groups (stable IDs ensure idempotency)
    const existingCount = await database.muscleGroups.count();
    if (existingCount === 0) {
      for (const name of DEFAULT_MUSCLE_GROUPS) {
        await database.muscleGroups.put({
          id: createStableId("muscle", name),
          name,
          createdAt: now,
          updatedAt: now,
        });
      }
    }
  });
}

export async function clearDatabaseForUserSwitch(): Promise<void> {
  await db.transaction('rw', db.tables, async () => {
    for (const table of db.tables) {
      await table.clear();
    }
  });
}
