"use client";

import { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Trash2 } from "lucide-react";
import { db } from "@/lib/db";
import {
  addExerciseToWorkout,
  addSetToWorkoutExercise,
  createWorkoutForDate,
  finishWorkoutExercise,
  finishWorkoutSession,
  getWorkoutById,
  listWorkoutsByDate,
  renumberSets,
  reorderSet,
  startWorkoutSessionForWorkout,
  startWorkoutExercise,
  summarizeSets
} from "@/lib/repository";
import { useUiStore } from "@/lib/store";
import { formatLocalDate, localDateIso, nowIso } from "@/lib/utils";
import type { Exercise, MuscleGroup, SetEntry } from "@/types/domain";
import { formatDurationLong, formatTimeOfDay, computeDurationSeconds, muscleTimeSummary } from "@/lib/time";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

function formatTimer(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function computeElapsed(startedAt?: string) {
  if (!startedAt) return 0;
  const startedMs = Date.parse(startedAt);
  if (Number.isNaN(startedMs)) return 0;
  return Math.max(0, Math.floor((Date.now() - startedMs) / 1000));
}

export function WorkoutLogger() {
  const selectedDate = useUiStore((s) => s.selectedDate);
  const activeWorkoutId = useUiStore((s) => s.activeWorkoutId);
  const setSelectedDate = useUiStore((s) => s.setSelectedDate);
  const setActiveWorkoutId = useUiStore((s) => s.setActiveWorkoutId);
  const clearActiveWorkout = useUiStore((s) => s.clearActiveWorkout);

  const exercises = useLiveQuery(() => db.exercises.orderBy("name").toArray(), []);
  const workouts = useLiveQuery(() => listWorkoutsByDate(selectedDate), [selectedDate]);
  const workout = useLiveQuery(() => (activeWorkoutId ? getWorkoutById(activeWorkoutId) : Promise.resolve(null)), [activeWorkoutId]);
  const workoutExercises = useLiveQuery(
    () => (activeWorkoutId ? db.workoutExercises.where("workoutId").equals(activeWorkoutId).sortBy("orderIndex") : []),
    [activeWorkoutId]
  );

  const exerciseMap = useLiveQuery(async () => {
    const data = await db.exercises.toArray();
    return new Map(data.map((exercise) => [exercise.id, exercise]));
  }, []);
  const muscleGroups = useLiveQuery(() => db.muscles.orderBy("name").toArray(), []);
  const muscleMap = useMemo(() => {
    const map = new Map<string, MuscleGroup>();
    (muscleGroups ?? []).forEach((muscle) => map.set(muscle.id, muscle));
    return map;
  }, [muscleGroups]);

  const sessionActive = workout?.status === "active";
  const [sessionElapsed, setSessionElapsed] = useState(0);
  const [sessionBusy, setSessionBusy] = useState(false);
  const [newExerciseId, setNewExerciseId] = useState("");

  useEffect(() => {
    if (!workouts) return;
    if (activeWorkoutId && !workouts.some((item) => item.id === activeWorkoutId)) {
      clearActiveWorkout();
    }
  }, [activeWorkoutId, clearActiveWorkout, workouts]);

  useEffect(() => {
    if (!workouts) return;
    if (workouts.length === 0) {
      clearActiveWorkout();
      return;
    }
    if (activeWorkoutId && workouts.some((item) => item.id === activeWorkoutId)) return;
    if (workouts.length === 1) {
      setActiveWorkoutId(workouts[0].id);
      return;
    }
    const active = workouts.find((item) => item.status === "active");
    if (active) {
      setActiveWorkoutId(active.id);
      return;
    }
    const mostRecent = [...workouts].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
    if (mostRecent) setActiveWorkoutId(mostRecent.id);
  }, [activeWorkoutId, clearActiveWorkout, setActiveWorkoutId, workouts]);

  useEffect(() => {
    if (!sessionActive || !workout?.sessionStartedAt) {
      setSessionElapsed(0);
      return;
    }
    const update = () => {
      setSessionElapsed(computeElapsed(workout.sessionStartedAt));
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [sessionActive, workout?.sessionStartedAt]);

  const activeExerciseId = workoutExercises?.find((item) => item.startedAt && !item.completedAt)?.id ?? null;

  async function handleCreateWorkout() {
    setSessionBusy(true);
    try {
      const created = await createWorkoutForDate(selectedDate);
      setActiveWorkoutId(created.id);
    } finally {
      setSessionBusy(false);
    }
  }

  async function handleStopWorkout() {
    if (!workout?.id) return;
    setSessionBusy(true);
    try {
      await finishWorkoutSession(workout.id);
    } finally {
      setSessionBusy(false);
    }
  }

  async function handleStartWorkout() {
    if (!workout?.id) return;
    setSessionBusy(true);
    try {
      await startWorkoutSessionForWorkout(workout.id);
    } finally {
      setSessionBusy(false);
    }
  }

  async function handleAddExercise() {
    if (!newExerciseId || !workout?.id) return;
    await addExerciseToWorkout(workout.id, newExerciseId);
    setNewExerciseId("");
  }

  async function handleStartExercise(workoutExerciseId: string) {
    if (!sessionActive || !workout?.id) return;
    if (activeExerciseId && activeExerciseId !== workoutExerciseId) {
      await finishWorkoutExercise(activeExerciseId);
    }
    await startWorkoutExercise(workoutExerciseId);
  }

  async function handleFinishExercise(workoutExerciseId: string) {
    await finishWorkoutExercise(workoutExerciseId);
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
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value || localDateIso(new Date()))}
              />
            </div>
            <div className="rounded-lg border p-3 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">{formatLocalDate(selectedDate, "EEEE, MMMM d")}</p>
              <p>Focus on fast logging: tap an exercise, tap add set, adjust reps/weight if needed.</p>
            </div>
          </div>

          <div className="space-y-2 rounded-lg border p-3">
            <div className="flex items-center justify-between gap-2">
              <Label>Sessions for this date</Label>
              <Button size="sm" variant="secondary" onClick={handleCreateWorkout} disabled={sessionBusy}>
                New Session
              </Button>
            </div>
            {workouts && workouts.length > 0 ? (
              <div className="space-y-2">
                {workouts.map((item) => {
                  const isSelected = item.id === activeWorkoutId;
                  const durationSeconds = computeDurationSeconds(item.sessionStartedAt, item.sessionEndedAt);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setActiveWorkoutId(item.id)}
                      className={`flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm ${
                        isSelected ? "border-primary bg-accent" : ""
                      }`}
                    >
                      <div>
                        <p className="font-medium">{item.sessionStartedAt ? formatTimeOfDay(item.sessionStartedAt) : "Unstarted session"}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.status === "active"
                            ? "Running"
                            : item.status === "completed"
                              ? `Completed · ${formatDurationLong(durationSeconds)}`
                              : "Draft"}
                        </p>
                      </div>
                      <span className="text-xs text-muted-foreground">{isSelected ? "Selected" : "Tap to open"}</span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No sessions yet for this date.</p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {!workout ? (
              <Button onClick={handleCreateWorkout} disabled={sessionBusy}>
                Create Workout
              </Button>
            ) : sessionActive ? (
              <Button variant="destructive" onClick={handleStopWorkout} disabled={sessionBusy}>
                Stop Workout
              </Button>
            ) : (
              <Button onClick={handleStartWorkout} disabled={sessionBusy}>
                Start Workout
              </Button>
            )}
            <p className="text-sm text-muted-foreground">
              {sessionActive ? `Session running · ${formatTimer(sessionElapsed)}` : "Session stopped"}
            </p>
            {workout?.sessionStartedAt ? (
              <p className="text-xs text-muted-foreground">
                Started at {formatTimeOfDay(workout.sessionStartedAt)}
                {!sessionActive && workout.sessionEndedAt
                  ? ` · Duration ${formatDurationLong(computeDurationSeconds(workout.sessionStartedAt, workout.sessionEndedAt))}`
                  : ""}
              </p>
            ) : null}
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
            <EmptyState title="No selected workout" description="Select a session or create a new one for this date." />
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
                exercise={exercise}
                muscleMap={muscleMap}
                onDelete={!item.completedAt ? () => handleDeleteWorkoutExercise(item.id) : undefined}
                onStart={sessionActive ? () => handleStartExercise(item.id) : undefined}
                onFinish={() => handleFinishExercise(item.id)}
                startedAt={item.startedAt}
                completedAt={item.completedAt}
                isActive={activeExerciseId === item.id}
                isSessionActive={sessionActive}
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

  async function handleDeleteWorkoutExercise(workoutExerciseId: string) {
    const sets = await db.setEntries.where("workoutExerciseId").equals(workoutExerciseId).toArray();
    await db.transaction("rw", db.setEntries, db.workoutExercises, async () => {
      await db.setEntries.bulkDelete(sets.map((setEntry) => setEntry.id));
      await db.workoutExercises.delete(workoutExerciseId);
    });
  }
}

function WorkoutExerciseCard({
  workoutExerciseId,
  title,
  exercise,
  muscleMap,
  onDelete,
  onStart,
  onFinish,
  startedAt,
  completedAt,
  isActive,
  isSessionActive
}: {
  workoutExerciseId: string;
  title: string;
  exercise: Exercise;
  muscleMap: Map<string, MuscleGroup>;
  onDelete?: () => void;
  onStart?: () => void;
  onFinish: () => void;
  startedAt?: string;
  completedAt?: string;
  isActive: boolean;
  isSessionActive: boolean;
}) {
  const sets = useLiveQuery(
    () => db.setEntries.where("workoutExerciseId").equals(workoutExerciseId).sortBy("setNumber"),
    [workoutExerciseId]
  );
  const [reps, setReps] = useState("8");
  const [weight, setWeight] = useState("20");

  const lastSet = useMemo(() => {
    if (!sets || sets.length === 0) return null;
    return sets[sets.length - 1];
  }, [sets]);

  const isFinished = Boolean(completedAt);
  const isTimerActive = isActive && !isFinished && Boolean(startedAt);
  const [elapsed, setElapsed] = useState(() => computeElapsed(startedAt));
  const durationSeconds = computeDurationSeconds(startedAt, completedAt);
  const muscleTimes = exercise ? muscleTimeSummary(exercise, durationSeconds, muscleMap) : [];

  useEffect(() => {
    if (!isTimerActive) {
      setElapsed(0);
      return;
    }
    const update = () => setElapsed(computeElapsed(startedAt));
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [isTimerActive, startedAt]);

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

  if (isFinished) {
    const summary = summarizeSets(sets ?? []);
    return (
      <Card>
        <CardHeader>
          <div>
            <CardTitle>{title}</CardTitle>
            <p className="text-xs text-muted-foreground">Finished</p>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Duration</span>
            <span>{formatDurationLong(durationSeconds)}</span>
          </div>
          {muscleTimes.length > 0 ? (
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              {muscleTimes.map((entry) => (
                <span key={entry.muscleId} className="rounded-full border border-border px-2 py-0.5 text-[10px]">
                  {entry.name} · {formatDurationLong(entry.seconds)} ({entry.tags.join(", ")})
                </span>
              ))}
            </div>
          ) : null}
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Total Reps</span>
            <span>{summary.totalReps}</span>
          </div>
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Total Volume</span>
            <span>{summary.totalVolume}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex items-center justify-between space-y-0">
        <div>
          <CardTitle>{title}</CardTitle>
          {isTimerActive ? (
            <p className="text-xs text-muted-foreground">Active · {formatTimer(elapsed)}</p>
          ) : (
            <p className="text-xs text-muted-foreground">Pending</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isActive ? (
            <Button size="sm" variant="secondary" onClick={onFinish}>
              Finish
            </Button>
          ) : (
            onStart &&
            isSessionActive && (
              <Button size="sm" variant="secondary" onClick={onStart}>
                Start
              </Button>
            )
          )}
          {onDelete ? (
            <Button size="icon" variant="ghost" onClick={onDelete}>
              <Trash2 className="h-4 w-4" />
            </Button>
          ) : null}
        </div>
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
