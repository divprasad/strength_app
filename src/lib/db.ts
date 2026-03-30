import Dexie, { type EntityTable } from "dexie";
import { DEFAULT_MUSCLE_GROUPS, DEFAULT_VOLUME_CONFIG, DEFAULT_USER_ID } from "@/lib/constants";
import { createId, createStableId, localDateIso, nowIso } from "@/lib/utils";
import type { AppSettings, Exercise, MuscleGroup, SetEntry, SyncJob, Workout, WorkoutExercise } from "@/types/domain";

function inferWorkoutStatus(workout: Partial<Workout>): "draft" | "active" | "completed" {
  if (!workout.sessionStartedAt) return "draft";
  if (!workout.sessionEndedAt) return "active";
  return "completed";
}

class StrengthDatabase extends Dexie {
  muscles!: EntityTable<MuscleGroup, "id">;
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

    this.on("populate", async () => {
      await seedDatabase(this);
    });
  }
}

export const db = new StrengthDatabase();

let bootstrapPromise: Promise<void> | null = null;

export function ensureBootstrapped(): Promise<void> {
  if (!bootstrapPromise) {
    bootstrapPromise = bootstrapIfNeeded();
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
  await database.transaction("rw", [database.settings], async () => {
    await database.settings.clear();
    await database.settings.put({
      id: "default",
      volumePrimaryMultiplier: DEFAULT_VOLUME_CONFIG.primary,
      volumeSecondaryMultiplier: DEFAULT_VOLUME_CONFIG.secondary
    });
  });
}
