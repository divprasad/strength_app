"use client";

import { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Trash2, ChevronDown, ChevronUp, Plus, Check, RotateCcw } from "lucide-react";
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
import { formatDurationLong, formatTimeOfDay, computeDurationSeconds } from "@/lib/time";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";

/* ─── helpers ─── */

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

function formatSetsInline(sets: SetEntry[]): string {
  if (sets.length === 0) return "No sets";
  const groups: { reps: number; weight: number; count: number }[] = [];
  for (const s of sets) {
    const last = groups[groups.length - 1];
    if (last && last.reps === s.reps && last.weight === s.weight) {
      last.count++;
    } else {
      groups.push({ reps: s.reps, weight: s.weight, count: 1 });
    }
  }
  return groups.map(g => `${g.count}×${g.reps}@${g.weight}kg`).join(", ");
}

/* ═══════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════════ */

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

  const [sessionActive, setSessionActive] = useState(false);
  const [sessionElapsed, setSessionElapsed] = useState(0);
  const [sessionBusy, setSessionBusy] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showSessionSelector, setShowSessionSelector] = useState(false);

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
    ? "No session"
    : sessionActive
      ? formatTimer(sessionElapsed)
      : workout.status === "completed"
        ? "Complete"
        : "Stopped";

  // Edit mode via URL param
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
      const url = new URL(window.location.href);
      url.searchParams.delete("id");
      router.replace(url.pathname + url.search);
    }
  };

  /* ─── actions ─── */

  async function handleCreateAndStart() {
    setSessionBusy(true);
    try {
      const created = await createWorkoutForDate(selectedDate);
      setActiveWorkoutId(created.id);
      await startWorkoutSessionForWorkout(created.id);
    } finally {
      setSessionBusy(false);
    }
  }

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

  const handleFinishWorkout = async () => {
    if (!activeWorkoutId) return;
    const confirmed = window.confirm("Finish this workout? This will save the session to the server.");
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

  // Phase 2: Quick-add exercise — auto-creates workout + starts session if needed
  async function handleQuickAddExercise(exerciseId: string) {
    if (!exerciseId) return;
    setSessionBusy(true);
    try {
      let wid = workout?.id;
      // Auto-create workout if none exists
      if (!wid) {
        const created = await createWorkoutForDate(selectedDate);
        setActiveWorkoutId(created.id);
        wid = created.id;
      }
      // Auto-start session if not started
      const current = await getWorkoutById(wid);
      if (current && !current.sessionStartedAt) {
        await startWorkoutSessionForWorkout(wid);
      }
      // Add exercise
      const item = await addExerciseToWorkout(wid, exerciseId);
      // Auto-start the exercise (finish current active one first)
      if (activeExerciseId) {
        await finishWorkoutExercise(activeExerciseId);
      }
      await startWorkoutExercise(item.id);
    } finally {
      setSessionBusy(false);
    }
  }

  async function handleStartExercise(workoutExerciseId: string) {
    if (!workout?.id) return;
    // Auto-start session if needed
    const current = await getWorkoutById(workout.id);
    if (current && !current.sessionStartedAt) {
      await startWorkoutSessionForWorkout(workout.id);
    }
    if (activeExerciseId && activeExerciseId !== workoutExerciseId) {
      await finishWorkoutExercise(activeExerciseId);
    }
    await startWorkoutExercise(workoutExerciseId);
  }

  async function handleFinishExercise(workoutExerciseId: string) {
    await finishWorkoutExercise(workoutExerciseId);
  }

  async function handleDeleteWorkoutExercise(workoutExerciseId: string) {
    setSessionBusy(true);
    try {
      await removeExerciseFromWorkout(workoutExerciseId);
    } finally {
      setSessionBusy(false);
    }
  }

  const hasMultipleSessions = (workouts?.length ?? 0) > 1;

  /* ─── render ─── */

  return (
    <div className="space-y-3">
      {/* ── Phase 4: Compact Header Bar ── */}
      <div className="flex items-center justify-between gap-3 rounded-[1.4rem] border border-border/60 bg-card/90 px-4 py-3 shadow-[0_12px_36px_-24px_hsl(var(--foreground)/0.3)]">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => setShowDatePicker(!showDatePicker)}
            className="text-sm font-semibold tracking-tight text-foreground hover:text-primary transition-colors"
          >
            {formatLocalDate(selectedDate, "EEE, MMM d")}
          </button>
          <div className="h-4 w-px bg-border/50" />
          <Badge
            className={cn(
              "px-2.5 py-0.5 text-[10px] font-semibold",
              sessionActive
                ? "bg-emerald-500/15 text-emerald-600 border-emerald-500/20 dark:text-emerald-400"
                : workout?.status === "completed"
                  ? "bg-primary/10 text-primary border-primary/20"
                  : ""
            )}
          >
            {sessionActive ? `● ${sessionSummary}` : sessionSummary}
          </Badge>
          {hasMultipleSessions && (
            <button
              onClick={() => setShowSessionSelector(!showSessionSelector)}
              className="text-[10px] text-muted-foreground hover:text-foreground"
            >
              {workouts?.length} sessions
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          {sessionActive ? (
            <Button size="sm" variant="destructive" onClick={handleFinishWorkout} disabled={sessionBusy} className="h-8 rounded-full px-3 text-xs">
              Stop
            </Button>
          ) : workout && workout.status !== "completed" ? (
            <Button size="sm" onClick={handleStartWorkout} disabled={sessionBusy} className="h-8 rounded-full px-3 text-xs">
              Start
            </Button>
          ) : workout?.status === "completed" ? (
            <Button size="sm" onClick={handleSaveAndPush} disabled={sessionBusy} className="h-8 rounded-full px-3 text-xs bg-primary/90 hover:bg-primary">
              Save Edit
            </Button>
          ) : null}
        </div>
      </div>

      {/* Collapsible Date Picker */}
      {showDatePicker && (
        <div className="rounded-[1.2rem] border border-border/60 bg-card/90 p-3 animate-in slide-in-from-top-1 duration-150">
          <div className="flex items-center gap-3">
            <Input
              type="date"
              value={selectedDate}
              onChange={(e) => {
                setSelectedDate(e.target.value || localDateIso(new Date()));
                setShowDatePicker(false);
              }}
              className="h-9 max-w-[180px] text-sm"
            />
            {workout?.status === "completed" && workout.sessionStartedAt && (
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground">Start time:</span>
                <Input
                  type="time"
                  defaultValue={formatTimeOfDay(workout.sessionStartedAt).split(" ")[0]}
                  onBlur={(e) => handleUpdateTime(e.target.value)}
                  className="h-9 w-[100px] text-sm"
                />
              </div>
            )}
            <Button size="sm" variant="secondary" onClick={handleCreateWorkout} disabled={sessionBusy} className="h-8 text-xs rounded-full">
              New Session
            </Button>
          </div>
        </div>
      )}

      {/* Collapsible Session Selector */}
      {showSessionSelector && workouts && workouts.length > 1 && (
        <div className="rounded-[1.2rem] border border-border/60 bg-card/90 p-2 animate-in slide-in-from-top-1 duration-150">
          <div className="space-y-1">
            {workouts.map((item) => {
              const isSelected = item.id === activeWorkoutId;
              const dur = computeDurationSeconds(item.sessionStartedAt, item.sessionEndedAt);
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveWorkoutId(item.id);
                    setShowSessionSelector(false);
                  }}
                  className={cn(
                    "flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm transition-colors",
                    isSelected ? "bg-accent/75 text-foreground" : "hover:bg-card text-muted-foreground"
                  )}
                >
                  <span>{item.sessionStartedAt ? formatTimeOfDay(item.sessionStartedAt) : "Unstarted"}</span>
                  <span className="text-xs">{item.status === "completed" ? formatDurationLong(dur) : item.status}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Edit Mode Modal */}
      <Modal
        isOpen={!!pendingEditWorkout}
        onClose={() => {
          setPendingEditWorkout(null);
          const url = new URL(window.location.href);
          url.searchParams.delete("id");
          router.replace(url.pathname + url.search);
        }}
        title="Edit Workout Session?"
        description="Jump back into this session to make changes."
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
        <div className="rounded-[1.5rem] border border-border/70 bg-muted/30 p-4">
          <p className="font-medium">{pendingEditWorkout?.name}</p>
          <p className="text-sm text-muted-foreground">{pendingEditWorkout?.date}</p>
        </div>
      </Modal>

      {/* ── Exercise List ── */}
      {workout ? (
        <div className="space-y-2">
          {workoutExercises && workoutExercises.length > 0 ? (
            workoutExercises.map((item) => {
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
                  onStart={() => handleStartExercise(item.id)}
                  onFinish={() => handleFinishExercise(item.id)}
                  startedAt={item.startedAt}
                  completedAt={item.completedAt}
                  isActive={activeExerciseId === item.id}
                  isSessionActive={sessionActive}
                  allowEdit={workout?.status === "completed" || sessionActive}
                />
              );
            })
          ) : (
            <Card className="border-dashed border-border/50">
              <CardContent className="pt-5">
                <EmptyState title="No exercises yet" description="Pick an exercise below to start tracking." />
              </CardContent>
            </Card>
          )}

          {/* ── Phase 2: Inline Exercise Picker (always at bottom) ── */}
          <InlineExercisePicker
            exercises={exercises ?? []}
            onAdd={handleQuickAddExercise}
            disabled={sessionBusy}
          />
        </div>
      ) : (
        /* No workout — show a single CTA */
        <div className="flex flex-col items-center gap-4 rounded-[1.8rem] border border-dashed border-border/50 bg-card/60 px-6 py-12">
          <p className="text-sm text-muted-foreground">No workout for {formatLocalDate(selectedDate, "EEEE, MMM d")}</p>
          <Button onClick={handleCreateAndStart} disabled={sessionBusy} className="rounded-full px-6">
            Start Workout
          </Button>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   INLINE EXERCISE PICKER (Phase 2)
   ═══════════════════════════════════════════════════════════════════ */

function InlineExercisePicker({
  exercises,
  onAdd,
  disabled
}: {
  exercises: Exercise[];
  onAdd: (exerciseId: string) => void;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");

  const filtered = useMemo(() => {
    if (!filter) return exercises;
    const lower = filter.toLowerCase();
    return exercises.filter(e => e.name.toLowerCase().includes(lower));
  }, [exercises, filter]);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        disabled={disabled}
        className="flex w-full items-center justify-center gap-2 rounded-[1.2rem] border border-dashed border-border/50 bg-card/40 px-4 py-3 text-sm text-muted-foreground transition-colors hover:border-primary/30 hover:bg-card/70 hover:text-foreground disabled:opacity-50"
      >
        <Plus className="h-4 w-4" />
        Add Exercise
      </button>
    );
  }

  return (
    <div className="rounded-[1.2rem] border border-primary/20 bg-card/90 p-3 shadow-[0_8px_24px_-12px_hsl(var(--primary)/0.2)] animate-in zoom-in-95 duration-150">
      <Input
        autoFocus
        placeholder="Search exercises..."
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        className="h-9 text-sm mb-2"
      />
      <div className="max-h-[200px] overflow-y-auto space-y-0.5">
        {filtered.length > 0 ? (
          filtered.map((exercise) => (
            <button
              key={exercise.id}
              onClick={() => {
                onAdd(exercise.id);
                setOpen(false);
                setFilter("");
              }}
              className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm text-left transition-colors hover:bg-accent/50"
            >
              <span className="font-medium">{exercise.name}</span>
              <span className="text-[10px] text-muted-foreground">{exercise.category}</span>
            </button>
          ))
        ) : (
          <p className="px-3 py-2 text-xs text-muted-foreground">No exercises found</p>
        )}
      </div>
      <button
        onClick={() => { setOpen(false); setFilter(""); }}
        className="mt-2 w-full rounded-lg px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted/50 transition-colors"
      >
        Cancel
      </button>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   EXERCISE CARD (Phase 1 + 3 + 5)
   ═══════════════════════════════════════════════════════════════════ */

function WorkoutExerciseCard({
  workoutExerciseId,
  title,
  exercise: _exercise,
  muscleMap: _muscleMap,
  onDelete,
  onStart,
  onFinish,
  startedAt,
  completedAt,
  isActive,
  isSessionActive: _isSessionActive,
  allowEdit
}: {
  workoutExerciseId: string;
  title: string;
  exercise: Exercise;
  muscleMap: Map<string, MuscleGroup>;
  onDelete?: () => void;
  onStart: () => void;
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

  const lastSet = useMemo(() => {
    if (!sets || sets.length === 0) return null;
    return sets[sets.length - 1];
  }, [sets]);

  // Phase 3: Smart pre-fill from last set
  const [reps, setReps] = useState("8");
  const [weight, setWeight] = useState("20");

  useEffect(() => {
    if (lastSet) {
      setReps(String(lastSet.reps));
      setWeight(String(lastSet.weight));
    }
  }, [lastSet]);

  const isFinished = Boolean(completedAt);
  const isTimerActive = isActive && !isFinished && Boolean(startedAt);
  const [elapsed, setElapsed] = useState(() => computeElapsed(startedAt));
  const durationSeconds = computeDurationSeconds(startedAt, completedAt);
  const [expanded, setExpanded] = useState(false);

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

  /* ── Phase 1: Collapsed finished exercise ── */
  if (isFinished && !isActive) {
    const summary = summarizeSets(sets ?? []);
    if (!expanded) {
      return (
        <button
          onClick={() => setExpanded(true)}
          className="flex w-full items-center gap-3 rounded-[1.2rem] border border-border/50 bg-card/60 px-4 py-3 text-left transition-all hover:bg-card/80"
        >
          <Check className="h-4 w-4 shrink-0 text-emerald-500" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium truncate">{title}</p>
            <p className="text-xs text-muted-foreground truncate">
              {formatSetsInline(sets ?? [])} · {formatDurationLong(durationSeconds)}
            </p>
          </div>
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        </button>
      );
    }
    // Expanded collapsed view
    return (
      <div className="rounded-[1.2rem] border border-border/50 bg-card/70 overflow-hidden">
        <button
          onClick={() => setExpanded(false)}
          className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-card/90 transition-colors"
        >
          <Check className="h-4 w-4 shrink-0 text-emerald-500" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium truncate">{title}</p>
            <p className="text-[10px] text-muted-foreground">
              {formatDurationLong(durationSeconds)} · {summary.totalReps} reps · {summary.totalVolume}kg vol
            </p>
          </div>
          <ChevronUp className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        </button>
        <div className="px-4 pb-3 space-y-2">
          {(sets ?? []).length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {(sets ?? []).map((setEntry) => (
                allowEdit ? (
                  <SetChip
                    key={setEntry.id}
                    setEntry={setEntry}
                    onUpdate={updateSet}
                    onDelete={deleteSet}
                  />
                ) : (
                  <span key={setEntry.id} className="inline-flex items-center gap-1.5 rounded-full border border-border/50 bg-background/60 px-2.5 py-1 text-xs">
                    <span className="font-semibold text-primary/70">#{setEntry.setNumber}</span>
                    <span className="text-muted-foreground">{setEntry.reps}×{setEntry.weight}kg</span>
                  </span>
                )
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  /* ── Pending (not started) exercise ── */
  if (!startedAt && !isFinished) {
    return (
      <div className="flex items-center gap-3 rounded-[1.2rem] border border-border/40 bg-card/40 px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="text-[10px] text-muted-foreground">Pending</p>
        </div>
        <div className="flex items-center gap-1.5">
          <Button size="sm" variant="secondary" onClick={onStart} className="h-8 rounded-full px-3 text-xs">
            Start
          </Button>
          {onDelete && (
            <Button size="icon" variant="ghost" onClick={onDelete} className="h-8 w-8 text-muted-foreground hover:text-destructive">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>
    );
  }

  /* ── Active exercise card (full interactive view) ── */
  return (
    <div
      className={cn(
        "rounded-[1.4rem] border-2 bg-card/95 shadow-[0_16px_40px_-20px_hsl(var(--foreground)/0.4)] overflow-hidden transition-all",
        isActive
          ? "border-primary/30 shadow-[0_16px_40px_-16px_hsl(var(--primary)/0.25)]"
          : isFinished && allowEdit
            ? "border-border/50"
            : "border-border/40"
      )}
    >
      {/* Card header */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border/40">
        <div className="flex items-center gap-2.5 min-w-0">
          <p className="font-semibold text-sm tracking-tight truncate">{title}</p>
          {isTimerActive && (
            <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 px-2 py-0 text-[10px] font-mono animate-pulse">
              {formatTimer(elapsed)}
            </Badge>
          )}
          {isFinished && allowEdit && (
            <Badge variant="outline" className="px-2 py-0 text-[10px]">Completed</Badge>
          )}
          {sets && sets.length > 0 && (
            <span className="text-[10px] text-muted-foreground">{sets.length} set{sets.length === 1 ? "" : "s"}</span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {isActive && (
            <Button size="sm" variant="secondary" onClick={onFinish} className="h-7 rounded-full px-3 text-[11px]">
              Finish
            </Button>
          )}
          {!isActive && !isFinished && (
            <Button size="sm" variant="secondary" onClick={onStart} className="h-7 rounded-full px-3 text-[11px]">
              Start
            </Button>
          )}
          {onDelete && (
            <Button size="icon" variant="ghost" onClick={onDelete} className="h-7 w-7 text-muted-foreground hover:text-destructive">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* ── Phase 5: Compact set chips ── */}
      <div className="px-4 py-3 space-y-2">
        {(sets ?? []).length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {(sets ?? []).map((setEntry) => (
              <SetChip
                key={setEntry.id}
                setEntry={setEntry}
                onUpdate={updateSet}
                onDelete={deleteSet}
              />
            ))}
          </div>
        )}

        {/* ── Phase 3: Smart Quick Add ── */}
        <div className="flex items-center gap-2 pt-1">
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            <Input
              type="number"
              inputMode="numeric"
              value={reps}
              onChange={(e) => setReps(e.target.value)}
              className="h-10 w-16 text-center text-sm font-medium"
              placeholder="Reps"
            />
            <span className="text-xs text-muted-foreground">×</span>
            <Input
              type="number"
              inputMode="decimal"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              className="h-10 w-20 text-center text-sm font-medium"
              placeholder="kg"
            />
          </div>
          <Button onClick={addSet} className="h-10 rounded-full px-4 text-sm shrink-0">
            Log
          </Button>
          {lastSet && (
            <Button variant="secondary" onClick={quickRepeat} className="h-10 rounded-full px-3 text-sm shrink-0" title="Repeat last set">
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   SET CHIP (Phase 5 — compact pill instead of full card)
   ═══════════════════════════════════════════════════════════════════ */

function SetChip({
  setEntry,
  onUpdate,
  onDelete
}: {
  setEntry: SetEntry;
  onUpdate: (setEntry: SetEntry, patch: Partial<SetEntry>) => void;
  onDelete: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editReps, setEditReps] = useState(String(setEntry.reps));
  const [editWeight, setEditWeight] = useState(String(setEntry.weight));

  if (editing) {
    return (
      <div className="flex items-center gap-1.5 rounded-xl border border-primary/20 bg-accent/30 px-2 py-1.5 animate-in zoom-in-95 duration-100">
        <span className="text-[10px] font-semibold text-primary/70 w-4">#{setEntry.setNumber}</span>
        <Input
          type="number"
          inputMode="numeric"
          value={editReps}
          onChange={(e) => setEditReps(e.target.value)}
          className="h-7 w-12 text-center text-xs p-0"
          autoFocus
        />
        <span className="text-[10px] text-muted-foreground">×</span>
        <Input
          type="number"
          inputMode="decimal"
          value={editWeight}
          onChange={(e) => setEditWeight(e.target.value)}
          className="h-7 w-14 text-center text-xs p-0"
        />
        <button
          onClick={() => {
            onUpdate(setEntry, { reps: Number(editReps) || 0, weight: Number(editWeight) || 0 });
            setEditing(false);
          }}
          className="text-emerald-500 hover:text-emerald-600 p-0.5"
        >
          <Check className="h-3 w-3" />
        </button>
        <button
          onClick={() => onDelete(setEntry.id)}
          className="text-muted-foreground hover:text-destructive p-0.5"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => {
        setEditReps(String(setEntry.reps));
        setEditWeight(String(setEntry.weight));
        setEditing(true);
      }}
      className="inline-flex items-center gap-1.5 rounded-full border border-border/50 bg-background/60 px-2.5 py-1 text-xs transition-colors hover:border-primary/20 hover:bg-accent/30"
    >
      <span className="font-semibold text-primary/70">#{setEntry.setNumber}</span>
      <span className="text-muted-foreground">{setEntry.reps}×{setEntry.weight}kg</span>
    </button>
  );
}
