import { db } from "@/lib/db";


const WORKOUT_API_PATH = "/api/workouts";
const MUSCLE_API_PATH = "/api/muscles";
const EXERCISE_API_PATH = "/api/exercises";
const SETTINGS_API_PATH = "/api/settings";

export async function bootstrapMuscles(): Promise<void> {
  const response = await fetch(MUSCLE_API_PATH);
  if (!response.ok) throw new Error("Failed to fetch muscles");
  const { muscles } = await response.json();
  await db.muscleGroups.bulkPut(muscles);
}

export async function bootstrapExercises(): Promise<void> {
  const response = await fetch(EXERCISE_API_PATH);
  if (!response.ok) throw new Error("Failed to fetch exercises");
  const { exercises } = await response.json();
  await db.exercises.bulkPut(
    exercises.map((e: { primaryMuscleIds: string | string[]; secondaryMuscleIds: string | string[] }) => ({
      ...e,
      primaryMuscleIds: typeof e.primaryMuscleIds === "string" ? JSON.parse(e.primaryMuscleIds) : e.primaryMuscleIds,
      secondaryMuscleIds: typeof e.secondaryMuscleIds === "string" ? JSON.parse(e.secondaryMuscleIds) : e.secondaryMuscleIds
    }))
  );
}

export async function bootstrapFromServer(): Promise<void> {
  // ── 1. Fetch ALL data from server first (network phase) ──────────────
  const [muscleRes, exerciseRes, workoutRes] = await Promise.all([
    fetch(MUSCLE_API_PATH),
    fetch(EXERCISE_API_PATH),
    fetch(WORKOUT_API_PATH),
  ]);

  if (!muscleRes.ok) throw new Error("Failed to fetch muscles");
  if (!exerciseRes.ok) throw new Error("Failed to fetch exercises");
  if (!workoutRes.ok) throw new Error("Failed to fetch workouts");

  const { muscles } = await muscleRes.json();
  const { exercises: rawExercises } = await exerciseRes.json();
  const { workouts: serverWorkouts } = await workoutRes.json();

  const exercises = rawExercises.map(
    (e: { primaryMuscleIds: string | string[]; secondaryMuscleIds: string | string[] }) => ({
      ...e,
      primaryMuscleIds: typeof e.primaryMuscleIds === "string" ? JSON.parse(e.primaryMuscleIds) : e.primaryMuscleIds,
      secondaryMuscleIds: typeof e.secondaryMuscleIds === "string" ? JSON.parse(e.secondaryMuscleIds) : e.secondaryMuscleIds,
    })
  );

  // ── 2. Write ALL data in one atomic transaction ──────────────────────
  //    This ensures useLiveQuery never observes partial state
  //    (e.g. workouts without their exercise definitions).
  await db.transaction(
    "rw",
    [db.muscleGroups, db.exercises, db.workouts, db.workoutExercises, db.setEntries],
    async () => {
      await db.muscleGroups.bulkPut(muscles);
      await db.exercises.bulkPut(exercises);

      if (!serverWorkouts || serverWorkouts.length === 0) return;

      for (const sw of serverWorkouts) {
        await db.workouts.put({
          id: sw.id,
          name: sw.name,
          date: sw.date,
          status: sw.status,
          notes: sw.notes,
          userId: sw.userId,
          sessionStartedAt: sw.sessionStartedAt,
          sessionEndedAt: sw.sessionEndedAt,
          createdAt: sw.createdAt,
          updatedAt: sw.updatedAt,
        });

        for (const se of sw.exercises) {
          await db.workoutExercises.put({
            id: se.id,
            workoutId: sw.id,
            exerciseId: se.exerciseId,
            orderIndex: se.orderIndex,
            createdAt: se.createdAt,
            startedAt: se.startedAt,
            completedAt: se.completedAt,
          });

          for (const s of se.sets) {
            await db.setEntries.put({
              id: s.id,
              workoutExerciseId: se.id,
              setNumber: s.setNumber,
              weight: s.weight,
              reps: s.reps,
              type: s.type,
              notes: s.notes,
              createdAt: s.createdAt,
              updatedAt: s.updatedAt,
              completedAt: s.completedAt,
            });
          }
        }
      }
    }
  );

  // Also pull settings from server and merge into Dexie
  await bootstrapSettings();

  console.log(`Bootstrapped ${muscles.length} muscles, ${exercises.length} exercises, ${serverWorkouts?.length ?? 0} workouts from server.`);
}

/**
 * Fetches settings from the server and merges them into Dexie.
 * Preserves device-local fields (themePref, paletteIdx) that are never synced server-side.
 */
export async function bootstrapSettings(): Promise<void> {
  try {
    const res = await fetch(SETTINGS_API_PATH);
    if (!res.ok) return;
    const { settings: serverSettings } = await res.json();
    if (!serverSettings) return;

    // Get current Dexie settings to preserve device-local fields
    const localSettings = await db.settings.get("default");

    await db.settings.put({
      id: "default",
      volumePrimaryMultiplier: serverSettings.volumePrimaryMultiplier ?? 1.0,
      volumeSecondaryMultiplier: serverSettings.volumeSecondaryMultiplier ?? 0.5,
      gymFee: serverSettings.gymFee ?? undefined,
      gymFeePeriodDays: serverSettings.gymFeePeriodDays ?? undefined,
      gymFeeTargetPerSession: serverSettings.gymFeeTargetPerSession ?? undefined,
      appScale: serverSettings.appScale ?? 1.0,
      // Preserve device-local display preferences
      themePref: localSettings?.themePref,
      paletteIdx: localSettings?.paletteIdx,
    });
  } catch (error) {
    console.warn("[Bootstrap] Could not fetch settings from server:", error);
  }
}

