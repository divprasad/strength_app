"use client";

import { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Trash2 } from "lucide-react";
import { useSearchParams, useRouter } from "next/navigation";
import { db } from "@/lib/db";
import {
  addExerciseToWorkout,
  addSetToWorkoutExercise,
  createWorkoutForDate,
  finishWorkoutExercise,
  finishWorkoutSession,
  getWorkoutById,
  listWorkoutsByDate,
  removeExerciseFromWorkout,
  renumberSets,
  reorderSet,
  startWorkoutSessionForWorkout,
  startWorkoutExercise,
  summarizeSets,
  updateWorkout,
  syncWorkoutToServer
} from "@/lib/repository";
import { useUiStore } from "@/lib/store";
import { formatLocalDate, localDateIso, nowIso } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { Exercise, MuscleGroup, SetEntry, Workout } from "@/types/domain";
import { formatDurationLong, formatTimeOfDay, computeDurationSeconds, muscleTimeSummary } from "@/lib/time";
import { PageIntro } from "@/components/layout/page-intro";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Modal } from "@/components/ui/modal";

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

  const [sessionActive, setSessionActive] = useState(false); // Initialize sessionActive state
  const [sessionElapsed, setSessionElapsed] = useState(0);
  const [sessionBusy, setSessionBusy] = useState(false);
  const [newExerciseId, setNewExerciseId] = useState("");

  useEffect(() => {
    setSessionActive(workout?.status === "active");
  }, [workout?.status]);

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
  const sessionSummary = !workout
    ? "No workout selected"
    : sessionActive
      ? `Session running · ${formatTimer(sessionElapsed)}`
      : workout.status === "completed"
        ? "Session complete"
        : "Session stopped";

  const searchParams = useSearchParams();
  const router = useRouter();
  const editId = searchParams.get("id");
  const [pendingEditWorkout, setPendingEditWorkout] = useState<Workout | null>(null);

  useEffect(() => {
    if (editId && activeWorkoutId !== editId) {
      getWorkoutById(editId).then((w) => {
        if (w) setPendingEditWorkout(w);
      });
    }
  }, [editId, activeWorkoutId]);

  const handleConfirmEdit = () => {
    if (pendingEditWorkout) {
      setActiveWorkoutId(pendingEditWorkout.id);
      setSelectedDate(pendingEditWorkout.date);
      setPendingEditWorkout(null);
      // Remove id from URL without refresh
      const url = new URL(window.location.href);
      url.searchParams.delete("id");
      router.replace(url.pathname + url.search);
    }
  };

  const handleFinishWorkout = async () => {
    if (!activeWorkoutId) return;

    const confirmed = window.confirm(
      "Are you sure you want to finish this workout? This will save the session to the server."
    );
    if (!confirmed) return;

    try {
      await finishWorkoutSession(activeWorkoutId);
      setActiveWorkoutId(null);
    } catch (error) {
      console.error("Failed to finish workout:", error);
      alert("Failed to save workout to server. It is still saved locally.");
    }
  };

  const handleSaveAndPush = async () => {
    if (!activeWorkoutId) return;
    setSessionBusy(true);
    try {
      await syncWorkoutToServer(activeWorkoutId);
      alert("Changes saved and pushed to server successfully.");
    } catch (error) {
      console.error("Failed to push changes:", error);
      alert("Failed to push changes to server. Changes are saved locally.");
    } finally {
      setSessionBusy(false);
    }
  };

  const handleUpdateTime = async (time: string) => {
    if (!workout || !time) return;
    const [hours, minutes] = time.split(":").map(Number);
    const date = new Date(workout.sessionStartedAt || nowIso());
    date.setHours(hours, minutes, 0, 0);
    await updateWorkout(workout.id, { sessionStartedAt: date.toISOString() });
  };

  const primaryAction = !workout ? (
    <Button onClick={handleCreateWorkout} disabled={sessionBusy}>
      Create Workout
    </Button>
  ) : sessionActive ? (
    <Button variant="destructive" onClick={handleFinishWorkout} disabled={sessionBusy}>
      Stop Workout
    </Button>
  ) : (
    <Button onClick={handleStartWorkout} disabled={sessionBusy}>
      Start Workout
    </Button>
  );

  async function handleCreateWorkout() {
    setSessionBusy(true);
    try {
      const created = await createWorkoutForDate(selectedDate);
      setActiveWorkoutId(created.id);
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
    <div className="space-y-6">
      <PageIntro
        eyebrow="Training Session"
        title="Workout Logger"
        description="Choose the active day, pick the right session, and move from start to finished sets without losing context."
        action={
          <div className="flex flex-wrap gap-2">
            {primaryAction}
            <Button size="sm" variant="secondary" onClick={handleCreateWorkout} disabled={sessionBusy}>
              New Session
            </Button>
            {workout?.status === "completed" && (
              <Button size="sm" onClick={handleSaveAndPush} disabled={sessionBusy} className="bg-primary/90 hover:bg-primary">
                Confirm Edit and Save
              </Button>
            )}
          </div>
        }
        meta={
          <>
            <Badge className="bg-accent px-3 py-1 text-accent-foreground">{formatLocalDate(selectedDate, "EEEE, MMMM d")}</Badge>
            <Badge className={cn(workout?.status === "completed" ? "bg-primary/10 text-primary border-primary/20" : "")}>
              {sessionSummary}
            </Badge>
          </>
        }
      />

      <Modal
        isOpen={!!pendingEditWorkout}
        onClose={() => {
          setPendingEditWorkout(null);
          const url = new URL(window.location.href);
          url.searchParams.delete("id");
          router.replace(url.pathname + url.search);
        }}
        title="Edit Workout Session?"
        description="Are you sure you want to jump back into this session? Any changes will need to be re-confirmed for server sync."
        footer={
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => {
              setPendingEditWorkout(null);
              const url = new URL(window.location.href);
              url.searchParams.delete("id");
              router.replace(url.pathname + url.search);
            }}>
              Cancel
            </Button>
            <Button onClick={handleConfirmEdit}>
              Edit Session
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="rounded-[1.5rem] border border-border/70 bg-muted/30 p-4">
            <p className="font-medium">{pendingEditWorkout?.name}</p>
            <p className="text-sm text-muted-foreground">{pendingEditWorkout?.date}</p>
          </div>
        </div>
      </Modal>

      <div className="grid gap-4 xl:grid-cols-[0.92fr_1.08fr]">
        <Card className="overflow-hidden">
          <CardHeader className="pb-4">
            <CardTitle>Session Day</CardTitle>
            <CardDescription>Set the training date first so the logger loads the right sessions and history context.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="workout-date">Date</Label>
              <Input
                id="workout-date"
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value || localDateIso(new Date()))}
              />
            </div>
            <div className="rounded-[1.2rem] border border-border/70 bg-background/58 p-4 shadow-[inset_0_1px_0_hsl(0_0%_100%/0.42)]">
              <p className="font-medium">{formatLocalDate(selectedDate, "EEEE, MMMM d")}</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Focus on quick logging: select the session, start the active exercise, and add sets without leaving the page.
              </p>
            </div>
            <div className="rounded-[1.2rem] border border-border/70 bg-background/58 p-4 shadow-[inset_0_1px_0_hsl(0_0%_100%/0.42)]">
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-primary/70">Session Status</p>
              <p className="mt-2 text-lg font-semibold tracking-[-0.03em]">{sessionSummary}</p>
              {workout?.sessionStartedAt ? (
                <div className="mt-2 space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Started at {formatTimeOfDay(workout.sessionStartedAt)}
                    {!sessionActive && workout.sessionEndedAt
                      ? ` · Duration ${formatDurationLong(computeDurationSeconds(workout.sessionStartedAt, workout.sessionEndedAt))}`
                      : ""}
                  </p>
                  {workout.status === "completed" && (
                    <div className="pt-2">
                      <Label htmlFor="start-time" className="text-[10px] uppercase text-muted-foreground">Update Start Time</Label>
                      <Input
                        id="start-time"
                        type="time"
                        defaultValue={formatTimeOfDay(workout.sessionStartedAt).split(" ")[0]} // Basic format check
                        onBlur={(e) => handleUpdateTime(e.target.value)}
                        className="mt-1 h-8 max-w-[120px] text-xs"
                      />
                    </div>
                  )}
                </div>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">Create or select a session to begin logging sets for this day.</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader className="pb-4">
            <CardTitle>Sessions for This Date</CardTitle>
            <CardDescription>Move between sessions without losing the active workout selection.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {workouts && workouts.length > 0 ? (
              <div className="space-y-3">
                {workouts.map((item) => {
                  const isSelected = item.id === activeWorkoutId;
                  const durationSeconds = computeDurationSeconds(item.sessionStartedAt, item.sessionEndedAt);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setActiveWorkoutId(item.id)}
                      className={cn(
                        "flex w-full items-center justify-between gap-3 rounded-[1.2rem] border px-4 py-3 text-left shadow-[inset_0_1px_0_hsl(0_0%_100%/0.35)] transition-colors",
                        isSelected
                          ? "border-primary/20 bg-accent/75"
                          : "border-border/70 bg-background/58 hover:border-border hover:bg-card"
                      )}
                    >
                      <div className="min-w-0">
                        <p className="font-medium">{item.sessionStartedAt ? formatTimeOfDay(item.sessionStartedAt) : "Unstarted session"}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
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
              <EmptyState title="No sessions yet for this date" description="Use the session actions above to create the first workout entry for this day." />
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <CardHeader className="pb-4">
          <CardTitle>Add Exercise to Workout</CardTitle>
          <CardDescription>Select a movement to add it to the active workout before you start logging sets.</CardDescription>
        </CardHeader>
        <CardContent>
          {workout ? (
            <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
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
            <EmptyState title="No selected workout" description="Select an existing session or create a new one before adding exercises." />
          )}
        </CardContent>
      </Card>

      {workout ? (
        workoutExercises && workoutExercises.length > 0 ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-primary/70">Exercise Queue</p>
              <h2 className="text-2xl font-semibold tracking-[-0.04em]">Logged Exercises</h2>
              <p className="text-sm text-muted-foreground">Keep the active movement visible, finish it cleanly, then move to the next one.</p>
            </div>
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
                  allowEdit={workout?.status === "completed" || sessionActive}
                />
              );
            })}
          </div>
        ) : (
          <Card>
            <CardContent className="pt-5">
              <EmptyState title="No exercises in this workout" description="Add an exercise above to begin logging sets." />
            </CardContent>
          </Card>
        )
      ) : (
        <Card>
          <CardContent className="pt-5">
            <EmptyState title="No workout yet" description="Create a workout for this date to start." />
          </CardContent>
        </Card>
      )}
    </div>
  );

  async function handleDeleteWorkoutExercise(workoutExerciseId: string) {
    setSessionBusy(true);
    try {
      await removeExerciseFromWorkout(workoutExerciseId);
    } finally {
      setSessionBusy(false);
    }
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
  isSessionActive,
  allowEdit
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
  allowEdit?: boolean;
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

  if (isFinished && !allowEdit) {
    const summary = summarizeSets(sets ?? []);
    return (
      <Card className="overflow-hidden border-white/50 bg-card/92">
        <CardHeader className="border-b border-border/70 pb-4">
          <div className="space-y-2">
            <CardTitle>{title}</CardTitle>
            <Badge className="w-fit bg-accent px-3 py-1 text-accent-foreground">Finished</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-5">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-[1.1rem] border border-border/70 bg-background/58 p-3">
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-primary/70">Duration</p>
              <p className="mt-2 text-xl font-semibold tracking-[-0.03em]">{formatDurationLong(durationSeconds)}</p>
            </div>
            <div className="rounded-[1.1rem] border border-border/70 bg-background/58 p-3">
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-primary/70">Total Reps</p>
              <p className="mt-2 text-xl font-semibold tracking-[-0.03em]">{summary.totalReps}</p>
            </div>
            <div className="rounded-[1.1rem] border border-border/70 bg-background/58 p-3">
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-primary/70">Total Volume</p>
              <p className="mt-2 text-xl font-semibold tracking-[-0.03em]">{summary.totalVolume}</p>
            </div>
          </div>
          {muscleTimes.length > 0 ? (
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              {muscleTimes.map((entry) => (
                <span key={entry.muscleId} className="rounded-full border border-border/70 px-2.5 py-1 text-[10px]">
                  {entry.name} · {formatDurationLong(entry.seconds)} ({entry.tags.join(", ")})
                </span>
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("overflow-hidden", isActive && "border-primary/20 bg-card/94")}>
      <CardHeader className="flex flex-col gap-4 border-b border-border/70 pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <CardTitle>{title}</CardTitle>
          <div className="flex flex-wrap gap-2">
            <Badge className={cn(isTimerActive ? "bg-accent px-3 py-1 text-accent-foreground" : "")}>
              {isTimerActive ? `Active · ${formatTimer(elapsed)}` : "Pending"}
            </Badge>
            {sets && sets.length > 0 ? <Badge>{sets.length} set{sets.length === 1 ? "" : "s"}</Badge> : null}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isActive ? (
            <Button size="sm" variant="secondary" onClick={onFinish}>
              Finish
            </Button>
          ) : isFinished && allowEdit ? (
            <Badge variant="outline">Completed</Badge>
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
      <CardContent className="space-y-4 pt-5">
        <div className="hidden grid-cols-[42px_1fr_1fr_130px_42px] gap-2 text-xs text-muted-foreground sm:grid">
          <span>#</span>
          <span>Reps</span>
          <span>Weight</span>
          <span>Actions</span>
          <span></span>
        </div>

        <div className="space-y-2">
          {(sets ?? []).map((setEntry) => (
            <div
              key={setEntry.id}
              className="rounded-[1.2rem] border border-border/70 bg-background/58 p-3 shadow-[inset_0_1px_0_hsl(0_0%_100%/0.42)]"
            >
              <div className="flex items-center justify-between gap-3 sm:hidden">
                <p className="text-sm font-medium">Set {setEntry.setNumber}</p>
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" onClick={() => reorderSet(setEntry.id, "up")}>
                    ↑
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => reorderSet(setEntry.id, "down")}>
                    ↓
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => deleteSet(setEntry.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="mt-3 grid gap-3 sm:mt-0 sm:grid-cols-[42px_1fr_1fr_130px_42px] sm:items-center">
                <span className="hidden text-sm font-medium sm:block">{setEntry.setNumber}</span>
                <div>
                  <p className="mb-1 text-[11px] uppercase tracking-[0.18em] text-muted-foreground sm:hidden">Reps</p>
                  <Input
                    type="number"
                    inputMode="numeric"
                    defaultValue={setEntry.reps}
                    onBlur={(e) => updateSet(setEntry, { reps: Number(e.target.value) || 0 })}
                    className="h-10"
                  />
                </div>
                <div>
                  <p className="mb-1 text-[11px] uppercase tracking-[0.18em] text-muted-foreground sm:hidden">Weight</p>
                  <Input
                    type="number"
                    inputMode="decimal"
                    defaultValue={setEntry.weight}
                    onBlur={(e) => updateSet(setEntry, { weight: Number(e.target.value) || 0 })}
                    className="h-10"
                  />
                </div>
                <div className="hidden gap-1 sm:flex">
                  <Button size="sm" variant="ghost" onClick={() => reorderSet(setEntry.id, "up")}>
                    ↑
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => reorderSet(setEntry.id, "down")}>
                    ↓
                  </Button>
                </div>
                <Button size="icon" variant="ghost" className="hidden sm:inline-flex" onClick={() => deleteSet(setEntry.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-[1.25rem] border border-border/70 bg-background/58 p-4 shadow-[inset_0_1px_0_hsl(0_0%_100%/0.42)]">
          <p className="mb-1 text-sm font-medium">Quick Add Set</p>
          <p className="mb-3 text-sm text-muted-foreground">Use the current reps and weight defaults for a fast, repeatable set entry flow.</p>
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
