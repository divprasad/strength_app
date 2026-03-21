import { db } from "@/lib/db";
import type { WorkoutBundle } from "@/types/domain";

const WORKOUT_API_PATH = "/api/workouts";

export async function bootstrapFromServer(): Promise<void> {
  try {
    const response = await fetch(WORKOUT_API_PATH);
    if (!response.ok) throw new Error("Failed to fetch from server");

    const data = await response.json();
    const serverWorkouts = data.workouts;

    if (!serverWorkouts || serverWorkouts.length === 0) return;

    await db.transaction("rw", [db.workouts, db.workoutExercises, db.setEntries], async () => {
      for (const sw of serverWorkouts) {
        // 1. Put Workout
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

        // 2. Put Exercises
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

          // 3. Put Sets
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
    });

    console.log(`Bootstrapped ${serverWorkouts.length} workouts from server.`);
  } catch (error) {
    console.error("Bootstrap from server failed:", error);
  }
}
