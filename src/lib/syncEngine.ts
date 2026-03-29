import { db } from "@/lib/db";
import { DEFAULT_USER_ID } from "@/lib/constants";

const WORKOUT_API_PATH = "/api/workouts";
let isProcessing = false;

/**
 * Grabs all pending workouts from the syncQueue and sends them to the server.
 */
export async function processSyncQueue(): Promise<void> {
  if (isProcessing) return;
  if (typeof navigator !== "undefined" && !navigator.onLine) return;

  isProcessing = true;
  try {
    const pendingJobs = await db.syncQueue.where("status").equals("pending").toArray();

    for (const job of pendingJobs) {
      const success = await pushWorkoutToServer(job.id);
      if (success) {
        await db.syncQueue.delete(job.id);
      } else {
        await db.syncQueue.update(job.id, { 
          status: "failed", 
          lastAttemptAt: new Date().toISOString(),
          retryCount: job.retryCount + 1
        });
      }
    }
  } finally {
    isProcessing = false;
  }
}

/**
 * Builds the workout bundle and POSTs to the server.
 */
async function pushWorkoutToServer(workoutId: string): Promise<boolean> {
  // Replicating getWorkoutBundle directly to avoid circular dependency with repository.ts
  const workout = await db.workouts.get(workoutId);
  if (!workout) return true; // It was deleted locally before sync? Just clear from queue.

  const workoutExercises = await db.workoutExercises.where("workoutId").equals(workoutId).sortBy("orderIndex");
  const exerciseIds = workoutExercises.map((w) => w.exerciseId);
  const exercises = await db.exercises.bulkGet(exerciseIds);

  const items = await Promise.all(
    workoutExercises.map(async (workoutExercise, index) => {
      const exercise = exercises[index];
      if (!exercise) return null;
      const sets = await db.setEntries
        .where("workoutExerciseId")
        .equals(workoutExercise.id)
        .sortBy("setNumber");
      return { workoutExercise, exercise, sets };
    })
  );

  const bundle = {
    workout,
    items: items.filter(Boolean) as unknown[]
  };

  const payload = {
    action: "sync",
    userId: workout.userId ?? DEFAULT_USER_ID,
    bundle
  };

  try {
    const response = await fetch(WORKOUT_API_PATH, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    return response.ok;
  } catch (error) {
    console.warn("[SyncEngine] Failed to sync workout", workoutId, error);
    return false;
  }
}

// Auto-start sync when returning online
if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    processSyncQueue().catch(console.error);
  });
}
