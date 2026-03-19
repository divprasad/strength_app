import { endOfWeek, format, parseISO, startOfWeek } from "date-fns";
import { db } from "@/lib/db";
import { createId, nowIso } from "@/lib/utils";
import type { Exercise, MuscleGroup, SetEntry, Workout, WorkoutBundle, WorkoutExercise } from "@/types/domain";
import { DEFAULT_USER_ID } from "@/lib/constants";

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
    date,
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

export async function getOrCreateWorkoutByDate(date: string): Promise<Workout> {
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
  const nextIndex = existingItems.length;
  const item: WorkoutExercise = {
    id: createId("workoutExercise"),
    workoutId,
    exerciseId,
    orderIndex: nextIndex,
    createdAt: nowIso()
  };
  await db.workoutExercises.put(item);
  await db.workouts.update(workoutId, { updatedAt: nowIso() });
  return item;
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
    notes: setData.notes,
    createdAt: now,
    updatedAt: now
  };
  await db.setEntries.put(entry);
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

const WORKOUT_API_PATH = "/api/workouts";

async function persistWorkoutSession(action: "start" | "finish" | "sync", workoutId: string) {
  const bundle = await getWorkoutBundle(workoutId);
  if (!bundle) return;

  const payload = {
    action,
    userId: bundle.workout.userId ?? DEFAULT_USER_ID,
    bundle
  };

  if (typeof fetch === "undefined") return;
  try {
    await fetch(WORKOUT_API_PATH, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });
  } catch (error) {
    console.warn("Unable to persist workout session", error);
  }
}

export async function startWorkoutSession(date: string): Promise<Workout | null> {
  const workout = await getOrCreateWorkoutByDate(date);
  if (workout.sessionStartedAt && !workout.sessionEndedAt) return workout;
  const now = nowIso();
  await db.workouts.update(workout.id, {
    sessionStartedAt: now,
    sessionEndedAt: undefined,
    userId: workout.userId ?? DEFAULT_USER_ID,
    updatedAt: now
  });
  await persistWorkoutSession("start", workout.id);
  return { ...workout, sessionStartedAt: now, sessionEndedAt: undefined, userId: workout.userId ?? DEFAULT_USER_ID, updatedAt: now };
}

export async function startWorkoutSessionForWorkout(workoutId: string): Promise<Workout | null> {
  const workout = await db.workouts.get(workoutId);
  if (!workout) return null;
  if (workout.sessionStartedAt && !workout.sessionEndedAt) return workout;
  const now = nowIso();
  await db.workouts.update(workoutId, {
    sessionStartedAt: now,
    sessionEndedAt: undefined,
    userId: workout.userId ?? DEFAULT_USER_ID,
    updatedAt: now
  });
  await persistWorkoutSession("start", workoutId);
  return { ...workout, sessionStartedAt: now, sessionEndedAt: undefined, userId: workout.userId ?? DEFAULT_USER_ID, updatedAt: now };
}

export async function finishWorkoutSession(workoutId: string): Promise<void> {
  const now = nowIso();
  await finishActiveWorkoutExercise(workoutId);
  await db.workouts.update(workoutId, {
    sessionEndedAt: now,
    updatedAt: now
  });
  await persistWorkoutSession("finish", workoutId);
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
  await persistWorkoutSession("sync", workoutExercise.workoutId);
}

export async function finishWorkoutExercise(workoutExerciseId: string): Promise<void> {
  const now = nowIso();
  const workoutExercise = await db.workoutExercises.get(workoutExerciseId);
  if (!workoutExercise) return;
  await db.workoutExercises.update(workoutExerciseId, {
    completedAt: now
  });
  await db.workouts.update(workoutExercise.workoutId, { updatedAt: now });
  await persistWorkoutSession("sync", workoutExercise.workoutId);
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

export function summarizeSets(sets: SetEntry[]) {
  return {
    totalReps: sets.reduce((sum, setEntry) => sum + setEntry.reps, 0),
    totalVolume: sets.reduce((sum, setEntry) => sum + setEntry.reps * setEntry.weight, 0)
  };
}
