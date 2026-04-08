import { db } from "@/lib/db";
import { DEFAULT_USER_ID } from "@/lib/constants";
import type { WorkoutBundle } from "@/types/domain";

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
      const success = await pushWorkoutToServer(job.id, job.action as "upsert" | "delete");
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

    // Always push settings on every sync cycle — keeps SQLite in sync with Dexie
    await pushSettingsToServer();
  } finally {
    isProcessing = false;
  }
}

/**
 * Like processSyncQueue, but forces execution even if a previous run is still
 * marked as in-progress (e.g. from a prior stale call). Used by syncAllWorkouts
 * to guarantee the queue is fully drained before the caller returns.
 */
export async function flushSyncQueue(): Promise<void> {
  isProcessing = false; // Reset guard so we always run
  await processSyncQueue();
}

/**
 * Builds the workout bundle and POSTs to the server.
 */
async function pushWorkoutToServer(workoutId: string, action: "upsert" | "delete" = "upsert"): Promise<boolean> {
  if (action === "delete") {
    try {
      const response = await fetch(`${WORKOUT_API_PATH}?id=${workoutId}`, {
        method: "DELETE",
      });
      return response.ok;
    } catch (error) {
      console.warn("[SyncEngine] Failed to sync delete for workout", workoutId, error);
      return false;
    }
  }

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

  const validItems = items.filter((item): item is NonNullable<typeof item> => item !== null);

  const bundle: WorkoutBundle = {
    workout,
    items: validItems
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

/**
 * Reads current AppSettings from Dexie and upserts them to /api/settings.
 * Only syncs non-device-local fields (excludes themePref, paletteIdx).
 */
async function pushSettingsToServer(): Promise<void> {
  try {
    const settings = await db.settings.get("default");
    if (!settings) return;

    await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        volumePrimaryMultiplier: settings.volumePrimaryMultiplier,
        volumeSecondaryMultiplier: settings.volumeSecondaryMultiplier,
        gymFee: settings.gymFee ?? null,
        gymFeePeriodDays: settings.gymFeePeriodDays ?? null,
        gymFeeTargetPerSession: settings.gymFeeTargetPerSession ?? null,
        appScale: settings.appScale ?? 1.0,
      }),
    });
  } catch (error) {
    console.warn("[SyncEngine] Failed to sync settings:", error);
  }
}

// Auto-start sync when returning online
if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    processSyncQueue().catch(console.error);
  });
}
