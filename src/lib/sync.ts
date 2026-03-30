import { db } from "@/lib/db";


const WORKOUT_API_PATH = "/api/workouts";
const MUSCLE_API_PATH = "/api/muscles";
const EXERCISE_API_PATH = "/api/exercises";

export async function bootstrapMuscles(): Promise<void> {
  const response = await fetch(MUSCLE_API_PATH);
  if (!response.ok) throw new Error("Failed to fetch muscles");
  const { muscles } = await response.json();
  await db.muscles.bulkPut(muscles);
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
    [db.muscles, db.exercises, db.workouts, db.workoutExercises, db.setEntries],
    async () => {
      await db.muscles.bulkPut(muscles);
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

  console.log(`Bootstrapped ${muscles.length} muscles, ${exercises.length} exercises, ${serverWorkouts?.length ?? 0} workouts from server.`);
}

