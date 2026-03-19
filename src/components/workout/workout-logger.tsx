"use client";

import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Trash2 } from "lucide-react";
import { db } from "@/lib/db";
import { addExerciseToWorkout, addSetToWorkoutExercise, getOrCreateWorkoutByDate, renumberSets, reorderSet } from "@/lib/repository";
import { useUiStore } from "@/lib/store";
import { formatLocalDate, localDateIso, nowIso } from "@/lib/utils";
import type { SetEntry } from "@/types/domain";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

export function WorkoutLogger() {
  const activeDate = useUiStore((s) => s.activeWorkoutDate);
  const setActiveDate = useUiStore((s) => s.setActiveWorkoutDate);

  const exercises = useLiveQuery(() => db.exercises.orderBy("name").toArray(), []);
  const workout = useLiveQuery(() => db.workouts.where("date").equals(activeDate).first(), [activeDate]);
  const workoutExercises = useLiveQuery(
    () => (workout ? db.workoutExercises.where("workoutId").equals(workout.id).sortBy("orderIndex") : []),
    [workout?.id]
  );

  const [newExerciseId, setNewExerciseId] = useState("");

  const exerciseMap = useLiveQuery(async () => {
    const data = await db.exercises.toArray();
    return new Map(data.map((exercise) => [exercise.id, exercise]));
  }, []);

  async function ensureWorkout() {
    await getOrCreateWorkoutByDate(activeDate);
  }

  async function handleAddExercise() {
    if (!newExerciseId) return;
    const currentWorkout = await getOrCreateWorkoutByDate(activeDate);
    await addExerciseToWorkout(currentWorkout.id, newExerciseId);
    setNewExerciseId("");
  }

  async function handleDeleteWorkoutExercise(workoutExerciseId: string) {
    const sets = await db.setEntries.where("workoutExerciseId").equals(workoutExerciseId).toArray();
    await db.transaction("rw", db.setEntries, db.workoutExercises, async () => {
      await db.setEntries.bulkDelete(sets.map((setEntry) => setEntry.id));
      await db.workoutExercises.delete(workoutExerciseId);
    });
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Workout Logger</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 md:grid-cols-[220px_1fr]">
            <div>
              <Label htmlFor="workout-date">Date</Label>
              <Input
                id="workout-date"
                type="date"
                value={activeDate}
                onChange={(e) => setActiveDate(e.target.value || localDateIso(new Date()))}
              />
            </div>
            <div className="rounded-lg border p-3 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">{formatLocalDate(activeDate, "EEEE, MMMM d")}</p>
              <p>Focus on fast logging: tap an exercise, tap add set, adjust reps/weight if needed.</p>
            </div>
          </div>

          {workout ? (
            <div className="flex gap-2">
              <Select value={newExerciseId} onChange={(e) => setNewExerciseId(e.target.value)}>
                <option value="">Add exercise to workout</option>
                {(exercises ?? []).map((exercise) => (
                  <option key={exercise.id} value={exercise.id}>
                    {exercise.name}
                  </option>
                ))}
              </Select>
              <Button onClick={handleAddExercise} className="shrink-0">
                Add
              </Button>
            </div>
          ) : (
            <Button onClick={ensureWorkout}>Create Workout</Button>
          )}
        </CardContent>
      </Card>

      {workout ? (
        workoutExercises && workoutExercises.length > 0 ? (
          <div className="space-y-3">
            {workoutExercises.map((item) => {
              const exercise = exerciseMap?.get(item.exerciseId);
              if (!exercise) return null;
              return (
                <WorkoutExerciseCard
                  key={item.id}
                  workoutExerciseId={item.id}
                  title={exercise.name}
                  onDelete={() => handleDeleteWorkoutExercise(item.id)}
                />
              );
            })}
          </div>
        ) : (
          <EmptyState title="No exercises in this workout" description="Add an exercise above to begin logging sets." />
        )
      ) : (
        <EmptyState title="No workout yet" description="Create a workout for this date to start." />
      )}
    </div>
  );
}

function WorkoutExerciseCard({
  workoutExerciseId,
  title,
  onDelete
}: {
  workoutExerciseId: string;
  title: string;
  onDelete: () => void;
}) {
  const sets = useLiveQuery(() => db.setEntries.where("workoutExerciseId").equals(workoutExerciseId).sortBy("setNumber"), [workoutExerciseId]);
  const [reps, setReps] = useState("8");
  const [weight, setWeight] = useState("20");

  const lastSet = useMemo(() => {
    if (!sets || sets.length === 0) return null;
    return sets[sets.length - 1];
  }, [sets]);

  async function addSet() {
    await addSetToWorkoutExercise(workoutExerciseId, {
      reps: Number(reps) || 0,
      weight: Number(weight) || 0,
      notes: undefined
    });
  }

  async function quickRepeat() {
    if (!lastSet) {
      await addSet();
      return;
    }
    await addSetToWorkoutExercise(workoutExerciseId, {
      reps: lastSet.reps,
      weight: lastSet.weight,
      notes: lastSet.notes
    });
  }

  async function updateSet(setEntry: SetEntry, patch: Partial<SetEntry>) {
    await db.setEntries.update(setEntry.id, { ...patch, updatedAt: nowIso() });
  }

  async function deleteSet(setId: string) {
    await db.setEntries.delete(setId);
    await renumberSets(workoutExerciseId);
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle>{title}</CardTitle>
        <Button variant="destructive" size="sm" onClick={onDelete}>
          Remove
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-[42px_1fr_1fr_130px_42px] gap-2 text-xs text-muted-foreground">
          <span>#</span>
          <span>Reps</span>
          <span>Weight</span>
          <span>Actions</span>
          <span></span>
        </div>

        <div className="space-y-2">
          {(sets ?? []).map((setEntry) => (
            <div key={setEntry.id} className="grid grid-cols-[42px_1fr_1fr_130px_42px] items-center gap-2">
              <span className="text-sm font-medium">{setEntry.setNumber}</span>
              <Input
                type="number"
                inputMode="numeric"
                defaultValue={setEntry.reps}
                onBlur={(e) => updateSet(setEntry, { reps: Number(e.target.value) || 0 })}
                className="h-10"
              />
              <Input
                type="number"
                inputMode="decimal"
                defaultValue={setEntry.weight}
                onBlur={(e) => updateSet(setEntry, { weight: Number(e.target.value) || 0 })}
                className="h-10"
              />
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" onClick={() => reorderSet(setEntry.id, "up")}>
                  ↑
                </Button>
                <Button size="sm" variant="ghost" onClick={() => reorderSet(setEntry.id, "down")}>
                  ↓
                </Button>
              </div>
              <Button size="icon" variant="ghost" onClick={() => deleteSet(setEntry.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>

        <div className="rounded-lg border bg-muted/30 p-3">
          <p className="mb-2 text-sm font-medium">Quick Add Set</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Input type="number" inputMode="numeric" value={reps} onChange={(e) => setReps(e.target.value)} placeholder="Reps" />
            <Input
              type="number"
              inputMode="decimal"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              placeholder="Weight"
            />
            <Button onClick={addSet}>Add Set</Button>
            <Button variant="secondary" onClick={quickRepeat}>
              Repeat Last
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
