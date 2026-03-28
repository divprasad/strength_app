import { endOfWeek, format, parseISO, startOfWeek } from "date-fns";
import { db } from "@/lib/db";
import { createId, nowIso } from "@/lib/utils";
import type { Exercise, MuscleGroup, SetEntry, Workout, WorkoutBundle, WorkoutExercise, WorkoutStatus } from "@/types/domain";
import { DEFAULT_USER_ID } from "@/lib/constants";
import { processSyncQueue } from "@/lib/syncEngine";


function inferWorkoutStatus(workout: Pick<Workout, "sessionStartedAt" | "sessionEndedAt">): WorkoutStatus {
  if (!workout.sessionStartedAt) return "draft";
  if (!workout.sessionEndedAt) return "active";
  return "completed";
}

export async function listWorkoutsByDate(date: string): Promise<Workout[]> {
  return db.workouts.where("date").equals(date).sortBy("updatedAt");
}

export async function getWorkoutById(workoutId: string): Promise<Workout | null> {
  return (await db.workouts.get(workoutId)) ?? null;
}

export async function createWorkoutForDate(date: string, options?: Pick<Workout, "notes" | "sessionStartedAt" | "sessionEndedAt">): Promise<Workout> {
  const now = nowIso();
  const workout: Workout = {
    id: createId("workout"),
    name: `Workout ${date}`, // Default name
    date,
    status: inferWorkoutStatus(options ?? {}),
    notes: options?.notes,
    sessionStartedAt: options?.sessionStartedAt,
    sessionEndedAt: options?.sessionEndedAt,
    createdAt: now,
    updatedAt: now,
    userId: DEFAULT_USER_ID
  };
  await db.workouts.put(workout);
  return workout;
}

export async function updateWorkout(workoutId: string, patch: Partial<Workout>): Promise<void> {
  const now = nowIso();
  await db.workouts.update(workoutId, { ...patch, updatedAt: now });
  await enqueueSync(workoutId);
}

export async function getOrCreateWorkoutByDate(date: string): Promise<Workout> {
  // Deprecated compatibility helper. New session flows should create/select by workoutId.
  const existing = await db.workouts.where("date").equals(date).first();
  if (existing) return existing;
  return createWorkoutForDate(date);
}

export async function getWorkoutBundle(workoutId: string): Promise<WorkoutBundle | null> {
  const workout = await db.workouts.get(workoutId);
  if (!workout) return null;
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

  return {
    workout,
    items: items.filter(Boolean) as WorkoutBundle["items"]
  };
}

export async function addExerciseToWorkout(workoutId: string, exerciseId: string): Promise<WorkoutExercise> {
  const existingItems = await db.workoutExercises.where("workoutId").equals(workoutId).toArray();
  const maxIndex = existingItems.reduce((max, item) => Math.max(max, item.orderIndex), -1);
  const nextIndex = maxIndex + 1;
  const item: WorkoutExercise = {
    id: createId("workoutExercise"),
    workoutId,
    exerciseId,
    orderIndex: nextIndex,
    createdAt: nowIso()
  };
  await db.workoutExercises.put(item);
  await db.workouts.update(workoutId, { updatedAt: nowIso() });
  await enqueueSync(workoutId);
  return item;
}

export async function normalizeWorkoutExerciseOrder(workoutId: string): Promise<void> {
  const items = await db.workoutExercises.where("workoutId").equals(workoutId).sortBy("orderIndex");
  await db.transaction("rw", db.workoutExercises, async () => {
    for (let i = 0; i < items.length; i++) {
      if (items[i].orderIndex !== i) {
        await db.workoutExercises.update(items[i].id, { orderIndex: i });
      }
    }
  });
}

export async function removeExerciseFromWorkout(workoutExerciseId: string): Promise<void> {
  const workoutExercise = await db.workoutExercises.get(workoutExerciseId);
  if (!workoutExercise) return;

  const workoutId = workoutExercise.workoutId;
  const sets = await db.setEntries.where("workoutExerciseId").equals(workoutExerciseId).toArray();

  await db.transaction("rw", [db.setEntries, db.workoutExercises, db.workouts], async () => {
    await db.setEntries.bulkDelete(sets.map((s) => s.id));
    await db.workoutExercises.delete(workoutExerciseId);
    await db.workouts.update(workoutId, { updatedAt: nowIso() });
  });

  await normalizeWorkoutExerciseOrder(workoutId);
  await enqueueSync(workoutId);
}

export async function addSetToWorkoutExercise(
  workoutExerciseId: string,
  setData: Pick<SetEntry, "reps" | "weight" | "notes">
): Promise<SetEntry> {
  const existingSets = await db.setEntries.where("workoutExerciseId").equals(workoutExerciseId).sortBy("setNumber");
  const nextSetNumber = existingSets.length + 1;
  const now = nowIso();
  const entry: SetEntry = {
    id: createId("set"),
    workoutExerciseId,
    setNumber: nextSetNumber,
    reps: setData.reps,
    weight: setData.weight,
    type: "normal", // Default type
    notes: setData.notes,
    createdAt: now,
    updatedAt: now
  };
  await db.setEntries.put(entry);
  const workoutExercise = await db.workoutExercises.get(workoutExerciseId);
  if (workoutExercise) await enqueueSync(workoutExercise.workoutId);
  return entry;
}

export async function renumberSets(workoutExerciseId: string): Promise<void> {
  const sets = await db.setEntries.where("workoutExerciseId").equals(workoutExerciseId).sortBy("setNumber");
  await Promise.all(
    sets.map((setEntry, idx) =>
      db.setEntries.update(setEntry.id, {
        setNumber: idx + 1,
        updatedAt: nowIso()
      })
    )
  );
  const workoutExercise = await db.workoutExercises.get(workoutExerciseId);
  if (workoutExercise) await enqueueSync(workoutExercise.workoutId);
}

export async function reorderSet(setId: string, direction: "up" | "down"): Promise<void> {
  const setEntry = await db.setEntries.get(setId);
  if (!setEntry) return;

  const sets = await db.setEntries.where("workoutExerciseId").equals(setEntry.workoutExerciseId).sortBy("setNumber");
  const idx = sets.findIndex((s) => s.id === setId);
  if (idx === -1) return;

  const swapIdx = direction === "up" ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= sets.length) return;

  const current = sets[idx];
  const target = sets[swapIdx];

  await db.transaction("rw", db.setEntries, async () => {
    await db.setEntries.update(current.id, { setNumber: target.setNumber, updatedAt: nowIso() });
    await db.setEntries.update(target.id, { setNumber: current.setNumber, updatedAt: nowIso() });
  });
  const workoutExercise = await db.workoutExercises.get(setEntry.workoutExerciseId);
  if (workoutExercise) await enqueueSync(workoutExercise.workoutId);
}

export async function weekRangeDateStrings(anchorDateIso: string): Promise<{ start: string; end: string }> {
  const anchor = parseISO(anchorDateIso);
  const start = startOfWeek(anchor, { weekStartsOn: 1 });
  const end = endOfWeek(anchor, { weekStartsOn: 1 });
  return {
    start: format(start, "yyyy-MM-dd"),
    end: format(end, "yyyy-MM-dd")
  };
}

export async function createMuscleGroup(name: string): Promise<MuscleGroup> {
  const now = nowIso();
  const muscle: MuscleGroup = {
    id: createId("muscle"),
    name,
    createdAt: now,
    updatedAt: now
  };
  await db.muscles.put(muscle);
  return muscle;
}

export async function createExercise(data: Omit<Exercise, "id" | "createdAt" | "updatedAt">): Promise<Exercise> {
  const now = nowIso();
  const existing = await db.exercises.filter((e) => e.name.toLowerCase() === data.name.trim().toLowerCase()).first();
  if (existing) {
    throw new Error("Exercise name already exists.");
  }

  const exercise: Exercise = {
    id: createId("exercise"),
    ...data,
    name: data.name.trim(),
    createdAt: now,
    updatedAt: now
  };

  await db.exercises.put(exercise);
  return exercise;
}

export async function isExerciseReferenced(exerciseId: string): Promise<boolean> {
  return db.workoutExercises.where("exerciseId").equals(exerciseId).first().then(Boolean);
}

export async function deleteExercise(exerciseId: string): Promise<void> {
  if (await isExerciseReferenced(exerciseId)) {
    throw new Error("Cannot delete this exercise because it is used in a workout.");
  }
  await db.exercises.delete(exerciseId);
}

export async function isMuscleGroupReferenced(muscleId: string): Promise<boolean> {
  const exercises = await db.exercises.toArray();
  return exercises.some(
    (exercise) => exercise.primaryMuscleIds.includes(muscleId) || exercise.secondaryMuscleIds.includes(muscleId)
  );
}

export async function deleteMuscleGroup(muscleId: string): Promise<void> {
  if (await isMuscleGroupReferenced(muscleId)) {
    throw new Error("Cannot delete this muscle group because it is referenced by an exercise.");
  }
  await db.muscles.delete(muscleId);
}

export async function enqueueSync(workoutId: string): Promise<void> {
  const now = nowIso();
  const existingJob = await db.syncQueue.get(workoutId);
  if (!existingJob) {
    await db.syncQueue.put({
      id: workoutId,
      action: "upsert",
      status: "pending",
      retryCount: 0,
      createdAt: now,
    });
  } else if (existingJob.status === "failed") {
    await db.syncQueue.update(workoutId, { status: "pending", retryCount: existingJob.retryCount + 1 });
  }
  
  setTimeout(() => {
    processSyncQueue().catch(console.error);
  }, 100);
}

export async function syncWorkoutToServer(workoutId: string): Promise<void> {
  await enqueueSync(workoutId);
}

export async function startWorkoutSession(date: string): Promise<Workout | null> {
  const workout = await createWorkoutForDate(date);
  return startWorkoutSessionForWorkout(workout.id);
}

export async function startWorkoutSessionForWorkout(workoutId: string): Promise<Workout | null> {
  const workout = await db.workouts.get(workoutId);
  if (!workout) return null;
  if (workout.sessionStartedAt && !workout.sessionEndedAt) return workout;
  const now = nowIso();
  await db.workouts.update(workoutId, {
    status: "active",
    sessionStartedAt: now,
    sessionEndedAt: undefined,
    userId: workout.userId ?? DEFAULT_USER_ID,
    updatedAt: now
  });
  await enqueueSync(workoutId);
  return { ...workout, sessionStartedAt: now, sessionEndedAt: undefined, userId: workout.userId ?? DEFAULT_USER_ID, updatedAt: now };
}

export async function finishWorkoutSession(workoutId: string): Promise<void> {
  const now = nowIso();
  await finishActiveWorkoutExercise(workoutId);
  await db.workouts.update(workoutId, {
    status: "completed",
    sessionEndedAt: now,
    updatedAt: now
  });
  await enqueueSync(workoutId);
}

export async function startWorkoutExercise(workoutExerciseId: string): Promise<void> {
  const now = nowIso();
  const workoutExercise = await db.workoutExercises.get(workoutExerciseId);
  if (!workoutExercise) return;
  await db.workoutExercises.update(workoutExerciseId, {
    startedAt: now,
    completedAt: undefined
  });
  await db.workouts.update(workoutExercise.workoutId, { updatedAt: now });
  await enqueueSync(workoutExercise.workoutId);
}

export async function finishWorkoutExercise(workoutExerciseId: string): Promise<void> {
  const now = nowIso();
  const workoutExercise = await db.workoutExercises.get(workoutExerciseId);
  if (!workoutExercise) return;
  await db.workoutExercises.update(workoutExerciseId, {
    completedAt: now
  });
  await db.workouts.update(workoutExercise.workoutId, { updatedAt: now });
  await enqueueSync(workoutExercise.workoutId);
}

export async function finishActiveWorkoutExercise(workoutId: string): Promise<void> {
  const activeExercise = await db.workoutExercises
    .where("workoutId")
    .equals(workoutId)
    .filter((exercise) => !!exercise.startedAt && !exercise.completedAt)
    .first();
  if (activeExercise) {
    await finishWorkoutExercise(activeExercise.id);
  }
}

export async function syncAllMuscles(): Promise<void> {
  const muscles = await db.muscles.toArray();
  const response = await fetch("/api/muscles", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ muscleGroups: muscles })
  });
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Failed to sync muscles to server (Status: ${response.status}): ${errText}`);
  }
}

export async function syncAllExercises(): Promise<void> {
  const exercises = await db.exercises.toArray();
  const response = await fetch("/api/exercises", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ exercises })
  });
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Failed to sync exercises to server (Status: ${response.status}): ${errText}`);
  }
}

/**
 * Pushes all local workouts to the server.
 * Note: This can be slow for large histories, but is useful for initial imports.
 */
export async function syncAllWorkouts(): Promise<void> {
  const workouts = await db.workouts.toArray();
  for (const workout of workouts) {
    await enqueueSync(workout.id);
  }
}

export async function checkServerSyncStatus(): Promise<boolean> {
  const [localMuscles, localExercises, localWorkouts] = await Promise.all([
    db.muscles.toArray(),
    db.exercises.toArray(),
    db.workouts.toArray()
  ]);

  const [resMuscles, resExercises, resWorkouts] = await Promise.all([
    fetch("/api/muscles"),
    fetch("/api/exercises"),
    fetch("/api/workouts")
  ]);

  if (!resMuscles.ok || !resExercises.ok || !resWorkouts.ok) {
    throw new Error("Failed to fetch current server state for comparison.");
  }

  const [serverMuscles, serverExercises, serverWorkouts] = await Promise.all([
    resMuscles.json().then((d) => d.muscles),
    resExercises.json().then((d) => d.exercises),
    resWorkouts.json().then((d) => d.workouts)
  ]);

  // 1. Simple count check
  if (
    localMuscles.length !== serverMuscles.length ||
    localExercises.length !== serverExercises.length ||
    localWorkouts.length !== serverWorkouts.length
  ) {
    return true; // Counts differ, sync needed
  }

  // 2. Newest updatedAt check
  const getLatestUpdate = (items: { updatedAt: string }[]) =>
    items.reduce((max, item) => {
      const time = new Date(item.updatedAt).getTime();
      return time > max ? time : max;
    }, 0);

  const localMax = Math.max(
    getLatestUpdate(localMuscles),
    getLatestUpdate(localExercises),
    getLatestUpdate(localWorkouts)
  );

  const serverMax = Math.max(
    getLatestUpdate(serverMuscles),
    getLatestUpdate(serverExercises),
    getLatestUpdate(serverWorkouts)
  );

  return localMax > serverMax; // Sync if local has newer data
}

export async function syncEverythingToServer(): Promise<void> {
  // 1. Clear server state to ensure a clean overwrite (prevents zombie data)
  await Promise.all([
    fetch("/api/muscles", { method: "DELETE" }),
    fetch("/api/exercises", { method: "DELETE" }),
    fetch("/api/workouts", { method: "DELETE" })
  ]);

  // 2. Push current local state
  await syncAllMuscles();
  await syncAllExercises();
  await syncAllWorkouts();
}

export function summarizeSets(sets: SetEntry[]) {
  return {
    totalReps: sets.reduce((sum, setEntry) => sum + setEntry.reps, 0),
    totalVolume: sets.reduce((sum, setEntry) => sum + setEntry.reps * setEntry.weight, 0)
  };
}

export async function archiveWorkout(workoutId: string): Promise<void> {
  await db.workouts.update(workoutId, {
    status: "archived",
    updatedAt: nowIso()
  });
}

export async function restoreWorkout(workoutId: string): Promise<void> {
  await db.workouts.update(workoutId, {
    status: "completed",
    updatedAt: nowIso()
  });
}

export async function deleteWorkout(workoutId: string): Promise<void> {
  const workoutExercises = await db.workoutExercises.where("workoutId").equals(workoutId).toArray();
  const setEntriesKeys = await Promise.all(
    workoutExercises.map(async (we) => {
      const sets = await db.setEntries.where("workoutExerciseId").equals(we.id).toArray();
      return sets.map((s) => s.id);
    })
  ).then(nested => nested.flat());

  await db.transaction("rw", [db.setEntries, db.workoutExercises, db.workouts], async () => {
    await db.setEntries.bulkDelete(setEntriesKeys);
    await db.workoutExercises.bulkDelete(workoutExercises.map((we) => we.id));
    await db.workouts.delete(workoutId);
  });
}
