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
  // Only re-seed if the database is completely empty (no exercises)
  // This ensures that user imports and existing data are not wiped by the stable ID check
  const firstExercise = await db.exercises.orderBy("name").first();
  const needsReseed = !firstExercise;

  if (!settings || needsReseed) {
    console.log("Initializing database...");
    await seedDatabase(db);
  }
}

async function seedDatabase(database: StrengthDatabase): Promise<void> {
  const now = nowIso();

  // Only clear reference data. Workouts are user data and must never be wiped
  // by a re-seed triggered by bootstrap fallback.
  await database.transaction("rw", [database.muscles, database.exercises, database.settings], async () => {
    await database.exercises.clear();
    await database.muscles.clear();
    await database.settings.clear();
  });

  const muscles: MuscleGroup[] = DEFAULT_MUSCLE_GROUPS.map((name) => ({
    id: createStableId("muscle", name),
    name,
    createdAt: now,
    updatedAt: now
  }));

  await database.muscles.bulkPut(muscles);

  const chest = muscles.find((m) => m.name === "Chest")?.id;
  const shoulders = muscles.find((m) => m.name === "Shoulders")?.id;
  const triceps = muscles.find((m) => m.name === "Triceps")?.id;
  const back = muscles.find((m) => m.name === "Back")?.id;
  const biceps = muscles.find((m) => m.name === "Biceps")?.id;
  const quads = muscles.find((m) => m.name === "Quads")?.id;
  const glutes = muscles.find((m) => m.name === "Glutes")?.id;
  const hamstrings = muscles.find((m) => m.name === "Hamstrings")?.id;

  const exercises: Exercise[] = [
    {
      id: createStableId("exercise", "Barbell Bench Press"),
      name: "Barbell Bench Press",
      category: "Push",
      equipment: "Barbell",
      primaryMuscleIds: chest ? [chest] : [],
      secondaryMuscleIds: [shoulders, triceps].filter(Boolean) as string[],
      notes: "Pause briefly on chest.",
      createdAt: now,
      updatedAt: now
    },
    {
      id: createStableId("exercise", "Pull-Up"),
      name: "Pull-Up",
      category: "Pull",
      equipment: "Bodyweight",
      primaryMuscleIds: back ? [back] : [],
      secondaryMuscleIds: [biceps].filter(Boolean) as string[],
      notes: "Full range of motion.",
      createdAt: now,
      updatedAt: now
    },
    {
      id: createStableId("exercise", "Back Squat"),
      name: "Back Squat",
      category: "Legs",
      equipment: "Barbell",
      primaryMuscleIds: [quads, glutes].filter(Boolean) as string[],
      secondaryMuscleIds: [hamstrings].filter(Boolean) as string[],
      notes: "Controlled descent.",
      createdAt: now,
      updatedAt: now
    }
  ];

  await database.exercises.bulkPut(exercises);

  await database.settings.put({
    id: "default",
    volumePrimaryMultiplier: DEFAULT_VOLUME_CONFIG.primary,
    volumeSecondaryMultiplier: DEFAULT_VOLUME_CONFIG.secondary
  });
}
