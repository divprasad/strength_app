import { endOfWeek, format, parseISO, startOfWeek } from "date-fns";
import { db } from "@/lib/db";
import { createId, nowIso } from "@/lib/utils";
import type { Exercise, MuscleGroup, SetEntry, Workout, WorkoutBundle, WorkoutExercise } from "@/types/domain";

export async function getOrCreateWorkoutByDate(date: string): Promise<Workout> {
  const existing = await db.workouts.where("date").equals(date).first();
  if (existing) return existing;
  const now = nowIso();
  const workout: Workout = {
    id: createId("workout"),
    date,
    createdAt: now,
    updatedAt: now
  };
  await db.workouts.put(workout);
  return workout;
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
