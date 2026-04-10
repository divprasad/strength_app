"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { subDays, eachDayOfInterval, format } from "date-fns";
import { Trash2, ChevronDown, ChevronUp, Plus, Check, RotateCcw, PenLine, Dumbbell, Archive, Play, Clock, X } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSearchParams, useRouter } from "next/navigation";
import { StepperInput } from "@/components/ui/stepper-input";
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
  archiveWorkout,
  deleteWorkout,
  moveWorkoutExercise,
  updateExerciseTime
} from "@/lib/repository";
import { useUiStore } from "@/lib/store";
import { formatLocalDate, localDateIso, nowIso } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { Exercise, MuscleGroup, SetEntry, Workout } from "@/types/domain";
import { formatDurationLong, formatTimeOfDay, computeDurationSeconds } from "@/lib/time";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

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

/** Rounds duration to nearest minute. <30s → 0m, ≥30s → round up. */
function formatDurationRounded(seconds: number): string {
  return `${Math.round(seconds / 60)}m`;
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
  const setSessionActiveGlobal = useUiStore((s) => s.setSessionActive);

  const exercises = useLiveQuery(() => db.exercises.orderBy("name").filter((e) => !e.deletedAt).toArray(), []);
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
  const muscleGroups = useLiveQuery(() => db.muscleGroups.orderBy("name").toArray(), []);
  const muscleMap = useMemo(() => {
    const map = new Map<string, MuscleGroup>();
    (muscleGroups ?? []).forEach((muscle) => map.set(muscle.id, muscle));
    return map;
  }, [muscleGroups]);

  const [sessionActive, setSessionActive] = useState(false);
  const [sessionElapsed, setSessionElapsed] = useState(0);
  const [sessionBusy, setSessionBusy] = useState(false);
  const [showSessionSelector, setShowSessionSelector] = useState(false);
  const [sessionEditMode, setSessionEditMode] = useState(false);

  // Month history strip — all workouts in the past 30 days
  const today = localDateIso(new Date());
  const monthWorkouts = useLiveQuery(async () => {
    const start = localDateIso(subDays(new Date(), 29));
    return db.workouts
      .where("date")
      .between(start, today, true, true)
      .filter((w) => w.status === "completed" || w.status === "active")
      .toArray();
  }, [today]);

  // Map date -> workouts for quick lookup
  const monthWorkoutMap = useMemo(() => {
    const map = new Map<string, Workout[]>();
    (monthWorkouts ?? []).forEach((w) => {
      const arr = map.get(w.date) ?? [];
      arr.push(w);
      map.set(w.date, arr);
    });
    return map;
  }, [monthWorkouts]);

  // For the selected history day, show a popover with muscles + copy-template button
  const [historyPopoverDate, setHistoryPopoverDate] = useState<string | null>(null);
  const [copyBusy, setCopyBusy] = useState(false);

  // Set of exercise IDs already added to this session — used to filter the picker
  const doneExerciseIds = useMemo(
    () => new Set((workoutExercises ?? []).map((we) => we.exerciseId)),
    [workoutExercises]
  );

  useEffect(() => {
    const isActive = workout?.status === "active";
    setSessionActive(isActive);
    setSessionActiveGlobal(isActive);
  }, [workout?.status, setSessionActiveGlobal]);

  useEffect(() => {
    if (!workouts) return;
    if (activeWorkoutId && !workouts.some((item) => item.id === activeWorkoutId)) {
      clearActiveWorkout();
    }
  }, [activeWorkoutId, clearActiveWorkout, workouts]);

  // Reset edit mode whenever the active workout changes
  useEffect(() => {
    setSessionEditMode(false);
  }, [activeWorkoutId]);

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
        ? "Done"
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
    const confirmed = window.confirm("End workout and save?");
    if (!confirmed) return;
    try {
      await finishWorkoutSession(activeWorkoutId);
      setActiveWorkoutId(null);
    } catch (error) {
      console.error("Failed to finish workout:", error);
      alert("Failed to save workout to server. It is still saved locally.");
    }
  };

  const handleCopyAsTemplate = async () => {
    if (!activeWorkoutId || !workoutExercises) return;
    setSessionBusy(true);
    try {
      const todayStr = localDateIso(new Date());
      // Remove any existing draft workouts on today to prevent accumulation
      const todayWorkouts = await listWorkoutsByDate(todayStr);
      for (const w of todayWorkouts) {
        if (w.status === "draft") await deleteWorkout(w.id);
      }
      const newWorkout = await createWorkoutForDate(todayStr);
      for (const we of workoutExercises) {
        await addExerciseToWorkout(newWorkout.id, we.exerciseId);
      }
      setSelectedDate(todayStr);
      setActiveWorkoutId(newWorkout.id);
    } finally {
      setSessionBusy(false);
    }
  };

  // Copy a past workout (by workoutId) as template for today
  const handleCopyHistoryAsTemplate = async (workoutId: string) => {
    setCopyBusy(true);
    try {
      const todayStr = localDateIso(new Date());
      const sourceExercises = await db.workoutExercises
        .where("workoutId")
        .equals(workoutId)
        .sortBy("orderIndex");
      // Remove any existing draft workouts on today to prevent accumulation
      const todayWorkouts = await listWorkoutsByDate(todayStr);
      for (const w of todayWorkouts) {
        if (w.status === "draft") await deleteWorkout(w.id);
      }
      const newWorkout = await createWorkoutForDate(todayStr);
      for (const we of sourceExercises) {
        await addExerciseToWorkout(newWorkout.id, we.exerciseId);
      }
      setSelectedDate(todayStr);
      setActiveWorkoutId(newWorkout.id);
      setHistoryPopoverDate(null);
    } finally {
      setCopyBusy(false);
    }
  };

  const handleArchiveWorkout = async () => {
    if (!activeWorkoutId) return;
    const confirmed = window.confirm(
      "Archive this workout? It will be hidden from history but can be restored in Settings."
    );
    if (!confirmed) return;
    await archiveWorkout(activeWorkoutId);
    clearActiveWorkout();
  };

  const handleDeleteSession = async (workoutId: string, status: string) => {
    if (status !== "draft") {
      const confirmed = window.confirm("Delete this session? This cannot be undone.");
      if (!confirmed) return;
    }
    await deleteWorkout(workoutId);
    if (workoutId === activeWorkoutId) clearActiveWorkout();
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
      // Add exercise in pending state — user starts it manually
      await addExerciseToWorkout(wid, exerciseId);
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
    <div className="space-y-3 stagger-children">
      {/* ── Month History Strip — hidden during active session ── */}
      <div
        className={cn(
          "transition-all duration-300 ease-in-out overflow-hidden",
          sessionActive ? "max-h-0 opacity-0 pointer-events-none" : "max-h-40 opacity-100"
        )}
      >
        <MonthHistoryStrip
          today={today}
          monthWorkoutMap={monthWorkoutMap}
          exerciseMap={exerciseMap ?? new Map()}
          muscleMap={muscleMap}
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
          historyPopoverDate={historyPopoverDate}
          onSetHistoryPopoverDate={setHistoryPopoverDate}
          onCopyAsTemplate={handleCopyHistoryAsTemplate}
          copyBusy={copyBusy}
        />
      </div>

      {/* ── Compact Header Bar ── */}
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-border/30 bg-card/75 backdrop-blur-lg px-4 py-3 shadow-e1">
        <div className="flex items-center gap-2 min-w-0 flex-wrap">
          <span className="text-sm font-semibold tracking-tight text-foreground">
            {formatLocalDate(selectedDate, "EEE, MMM d")}
          </span>
          <div className="h-4 w-px bg-border/30" />
          {workout?.status === "completed" && !sessionActive ? (
            <button className="group flex items-center gap-1.5 rounded-full border border-success/25 bg-success/5 px-2.5 py-1 text-[10px] font-medium text-success/70 hover:bg-success/12 hover:border-success/50 hover:text-success active:scale-95 transition-all duration-200">
              <Check
                className="h-3.5 w-3.5 transition-transform duration-300 group-hover:-rotate-12 "
                strokeWidth={2.5}
              />
              <span className="max-w-0 overflow-hidden whitespace-nowrap transition-all duration-300 group-hover:max-w-[5rem]">
                completed
              </span>
            </button>
          ) : (
            <Badge
              className={cn(
                "px-2.5 py-0.5 text-[10px] font-semibold",
                sessionActive ? "bg-success/15 text-success border-success/20" : ""
              )}
            >
              {sessionActive ? `● ${sessionSummary}` : sessionSummary}
            </Badge>
          )}

          {/* Copy as Template — animated dumbbell, only on completed */}
          {workout?.status === "completed" && !sessionActive && (
            <button
              onClick={handleCopyAsTemplate}
              disabled={sessionBusy}
              title="Copy entire workout session as a new draft"
              className="group flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/5 px-2.5 py-1 text-[10px] font-medium text-primary/70 hover:bg-primary/12 hover:border-primary/50 hover:text-primary active:scale-95 transition-all duration-200 disabled:opacity-40"
            >
              <Dumbbell
                className="h-3.5 w-3.5 transition-transform duration-300 group-hover:-rotate-12 group-active:rotate-0"
                strokeWidth={2}
              />
              <span className="max-w-0 overflow-hidden whitespace-nowrap transition-all duration-300 group-hover:max-w-[5rem]">
                template
              </span>
            </button>
          )}

          {hasMultipleSessions && (
            <button
              onClick={() => setShowSessionSelector(!showSessionSelector)}
              className="text-[10px] text-muted-foreground hover:text-foreground"
            >
              {workouts?.length} sessions
            </button>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {sessionActive ? (
            <Button size="sm" variant="destructive" onClick={handleFinishWorkout} disabled={sessionBusy} className="h-8 rounded-full px-3 text-xs">
              Stop
            </Button>
          ) : workout?.status === "draft" ? (
            <>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => workout && handleDeleteSession(workout.id, workout.status)}
                disabled={sessionBusy}
                className="h-8 rounded-full px-3 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                Delete
              </Button>
              <Button size="sm" onClick={handleStartWorkout} disabled={sessionBusy} className="h-8 rounded-full px-3 text-xs">
                Start
              </Button>
            </>
          ) : workout && workout.status !== "completed" ? (
            <Button size="sm" onClick={handleStartWorkout} disabled={sessionBusy} className="h-8 rounded-full px-3 text-xs">
              Start
            </Button>
          ) : workout?.status === "completed" ? (
            <div className="flex items-center gap-1.5">
              {/* Edit toggle */}
              <button
                onClick={() => setSessionEditMode((v) => !v)}
                title={sessionEditMode ? "Stop editing" : "Edit session"}
                className={cn(
                  "group flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-medium active:scale-95 transition-all duration-200",
                  sessionEditMode
                    ? "border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/15"
                    : "border-destructive/40 bg-transparent text-destructive hover:bg-destructive/10 hover:border-destructive/60 hover:text-destructive"
                )}
              >
                <span className="max-w-0 overflow-hidden whitespace-nowrap transition-all duration-300 group-hover:max-w-[3rem]">
                  {sessionEditMode ? "back" : "edit"}
                </span>
                <PenLine className="h-3.5 w-3.5 transition-transform duration-300 group-hover:-rotate-12 group-active:rotate-0" />
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {/* Collapsible Session Selector */}
      {showSessionSelector && workouts && workouts.length > 1 && (
        <div className="rounded-2xl border border-border/30 bg-card/75 backdrop-blur-lg p-2 animate-fade-up">
          <div className="space-y-1">
            {workouts.map((item) => {
              const isSelected = item.id === activeWorkoutId;
              const dur = computeDurationSeconds(item.sessionStartedAt, item.sessionEndedAt);
              return (
                <div
                  key={item.id}
                  className={cn(
                    "flex w-full items-center rounded-xl transition-colors",
                    isSelected ? "bg-accent/75 text-foreground" : "hover:bg-card/60 text-muted-foreground"
                  )}
                >
                  <button
                    onClick={() => {
                      setActiveWorkoutId(item.id);
                      setShowSessionSelector(false);
                    }}
                    className="flex flex-1 items-center justify-between px-3 py-2 text-sm"
                  >
                    <span>{item.sessionStartedAt ? formatTimeOfDay(item.sessionStartedAt) : "Unstarted"}</span>
                    <span className="text-xs">{item.status === "completed" ? formatDurationLong(dur) : item.status}</span>
                  </button>
                  <button
                    onClick={() => handleDeleteSession(item.id, item.status)}
                    title="Delete session"
                    className="shrink-0 p-2 mr-1 rounded-lg text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
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
        title="Edit Session?"
        description="Resume editing this session."
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
        <div className="rounded-xl border border-border/20 bg-muted/20 p-4">
          <p className="font-medium">{pendingEditWorkout?.name}</p>
          <p className="text-sm text-muted-foreground">{pendingEditWorkout?.date}</p>
        </div>
      </Modal>

      {/* ── Exercise List ── */}
      {workout ? (
        <div className="space-y-2">
          {workoutExercises && workoutExercises.length > 0 ? (
            workout.status === "completed" ? (
              /* Single column for completed workouts */
              <div className="space-y-2">
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
                      onDelete={sessionEditMode ? () => handleDeleteWorkoutExercise(item.id) : undefined}
                      onStart={() => handleStartExercise(item.id)}
                      onFinish={() => handleFinishExercise(item.id)}
                      startedAt={item.startedAt}
                      completedAt={item.completedAt}
                      isActive={activeExerciseId === item.id}
                      isSessionActive={sessionActive}
                      allowEdit={sessionEditMode}
                      isInGrid={false}
                    />
                  );
                })}

                {/* Session Archive located at the bottom in Edit Mode */}
                {sessionEditMode && (
                  <div className="pt-2 flex  text-[12px] justify-center">
                    <Button
                      variant="destructive"
                      onClick={handleArchiveWorkout}
                      disabled={sessionBusy}
                      className="w-full sm:w-auto h-10 rounded-xl bg-destructive/15 text-destructive hover:bg-destructive/25 border border-destructive/30 shadow-none transition-colors"
                    >
                      <Archive className="mr-2 h-3 w-3" />
                      Archive Session
                    </Button>
                  </div>
                )}
              </div>
            ) : (
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
                    onMoveUp={() => moveWorkoutExercise(item.id, "up")}
                    onMoveDown={() => moveWorkoutExercise(item.id, "down")}
                    startedAt={item.startedAt}
                    completedAt={item.completedAt}
                    isActive={activeExerciseId === item.id}
                    isSessionActive={sessionActive}
                    allowEdit={workout?.status === "completed" || sessionActive}
                    isInGrid={false}
                  />
                );
              })
            )
          ) : (
            <p className="px-1 py-2 text-sm text-muted-foreground/60 text-center">
              No exercises yet — add one below to start.
            </p>
          )}

          {/* ── Inline Exercise Picker (always at bottom) ── */}
          <InlineExercisePicker
            exercises={exercises ?? []}
            onAdd={handleQuickAddExercise}
            disabled={sessionBusy}
            doneExerciseIds={doneExerciseIds}
          />
        </div>
      ) : (
        /* No workout — only allow starting on today */
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-border/30 bg-card/40 backdrop-blur-sm px-6 py-12">
          <p className="text-sm text-muted-foreground">No workout for {formatLocalDate(selectedDate, "EEEE, MMM d")}</p>
          {selectedDate === today && (
            <Button onClick={handleCreateAndStart} disabled={sessionBusy} className="rounded-full px-6">
              Start Workout
            </Button>
          )}
          {selectedDate !== today && (
            <p className="text-xs text-muted-foreground/60">Select a past workout above to use it as today&apos;s template</p>
          )}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   INLINE EXERCISE PICKER
   ═══════════════════════════════════════════════════════════════════ */

function InlineExercisePicker({
  exercises,
  onAdd,
  disabled,
  doneExerciseIds,
}: {
  exercises: Exercise[];
  onAdd: (exerciseId: string) => void;
  disabled: boolean;
  doneExerciseIds: Set<string>;
}) {
  const [open, setOpen] = useState(false);

  // Only show exercises not yet added to this session
  const available = useMemo(
    () => exercises.filter((e) => !doneExerciseIds.has(e.id)),
    [exercises, doneExerciseIds]
  );

  // Group by category, sorted alphabetically within each group
  const groups = useMemo(() => {
    const map = new Map<string, Exercise[]>();
    for (const ex of available) {
      const cat = ex.category ?? "Other";
      const arr = map.get(cat) ?? [];
      arr.push(ex);
      map.set(cat, arr);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([cat, exs]) => ({
        cat,
        exs: [...exs].sort((a, b) => a.name.localeCompare(b.name)),
      }));
  }, [available]);

  function close() {
    setOpen(false);
  }

  return (
    <>
      {/* Trigger */}
      <button
        onClick={() => setOpen(true)}
        disabled={disabled}
        className="flex w-full items-center justify-center gap-2.5 rounded-2xl border-2 border-dashed border-primary/25 bg-primary/5 px-4 py-4 text-sm font-semibold text-primary/80 transition-all duration-200 ease-spring hover:border-primary/40 hover:bg-primary/10 hover:text-primary active:scale-[0.98] disabled:opacity-50"
      >
        <Plus className="h-5 w-5" />
        Add Exercise
      </button>

      {/* Full-screen exercise picker modal */}
      {open && (
        <ExercisePickerModal
          groups={groups}
          available={available}
          onAdd={(id) => { onAdd(id); close(); }}
          onClose={close}
        />
      )}
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   EXERCISE PICKER MODAL
   Full-screen portal overlay — bypasses CSS stacking context issues
   that cause fixed/BottomSheet to render at wrong position on mobile.
   ═══════════════════════════════════════════════════════════════════ */

function ExercisePickerModal({
  groups,
  available,
  onAdd,
  onClose,
}: {
  groups: { cat: string; exs: Exercise[] }[];
  available: Exercise[];
  onAdd: (exerciseId: string) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  // Lock body scroll while open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  // Filter groups by search term
  const filteredGroups = useMemo(() => {
    if (!search.trim()) return groups;
    const q = search.toLowerCase();
    return groups
      .map(({ cat, exs }) => ({
        cat,
        exs: exs.filter((ex) => ex.name.toLowerCase().includes(q)),
      }))
      .filter(({ exs }) => exs.length > 0);
  }, [groups, search]);

  return createPortal(
    <div className="fixed inset-0 z-[60] flex flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/30 shrink-0">
        <h2 className="text-base font-semibold tracking-tight">Add Exercise</h2>
        <button
          onClick={onClose}
          className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          aria-label="Close exercise picker"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Search */}
      <div className="px-4 py-2.5 shrink-0 border-b border-border/20">
        <input
          ref={searchRef}
          type="text"
          placeholder="Search exercises…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-xl border border-border/30 bg-muted/30 px-3 py-2 text-sm outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/20 transition-colors placeholder:text-muted-foreground/50"
          autoComplete="off"
          autoCorrect="off"
        />
      </div>

      {/* Scrollable exercise list */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
        {filteredGroups.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            {available.length === 0
              ? "All exercises already added"
              : "No exercises match your search"}
          </p>
        ) : (
          filteredGroups.map(({ cat, exs }) => (
            <div key={cat}>
              <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                {cat}
              </p>
              <div className="flex flex-wrap gap-2">
                {exs.map((ex) => (
                  <button
                    key={ex.id}
                    onClick={() => onAdd(ex.id)}
                    className="rounded-full border border-border/30 bg-card/50 backdrop-blur-sm px-3.5 py-2 text-sm font-medium
                               hover:border-primary/20 hover:bg-primary/8 hover:text-primary
                               active:scale-95 transition-all duration-200 ease-spring"
                  >
                    {ex.name}
                  </button>
                ))}
              </div>
            </div>
          ))
        )}
        {/* Safe area bottom padding */}
        <div className="h-20" />
      </div>
    </div>,
    document.body
  );
}

function TimeEditorModal({
  isOpen,
  onClose,
  onSave,
  initialDurationSeconds
}: {
  isOpen: boolean;
  onClose: () => void;
  onSave: (durationSeconds: number) => void;
  initialDurationSeconds: number;
}) {
  const [mins, setMins] = useState("0");
  const [secs, setSecs] = useState("0");

  useEffect(() => {
    if (isOpen) {
      setMins(Math.floor(initialDurationSeconds / 60).toString());
      setSecs((initialDurationSeconds % 60).toString());
    }
  }, [isOpen, initialDurationSeconds]);

  function handleSave() {
    const m = parseInt(mins, 10) || 0;
    const s = parseInt(secs, 10) || 0;
    onSave(m * 60 + s);
    onClose();
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit Duration">
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">Adjust the recorded time for this exercise.</p>
        <div className="flex gap-4">
          <div className="flex-1 space-y-1.5">
            <Label>Minutes</Label>
            <Input type="number" min="0" value={mins} onChange={(e) => setMins(e.target.value)} />
          </div>
          <div className="flex-1 space-y-1.5">
            <Label>Seconds</Label>
            <Input type="number" min="0" max="59" value={secs} onChange={(e) => setSecs(e.target.value)} />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave}>Save</Button>
        </div>
      </div>
    </Modal>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   EXERCISE CARD
   ═══════════════════════════════════════════════════════════════════ */

function WorkoutExerciseCard({
  workoutExerciseId,
  title,
  exercise,
  onDelete,
  onStart,
  onFinish,
  onMoveUp,
  onMoveDown,
  startedAt,
  completedAt,
  isActive,
  isSessionActive,
  allowEdit,
  isInGrid
}: {
  workoutExerciseId: string;
  title: string;
  exercise: Exercise;
  muscleMap: Map<string, MuscleGroup>;
  onDelete?: () => void;
  onStart: () => void;
  onFinish: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  startedAt?: string;
  completedAt?: string;
  isActive: boolean;
  isSessionActive: boolean;
  allowEdit?: boolean;
  isInGrid?: boolean;
}) {
  const sets = useLiveQuery(
    () => db.setEntries.where("workoutExerciseId").equals(workoutExerciseId).sortBy("setNumber"),
    [workoutExerciseId]
  );

  const lastSet = useMemo(() => {
    if (!sets || sets.length === 0) return null;
    return sets[sets.length - 1];
  }, [sets]);

  // Phase 3: Smart pre-fill from last set in this session
  const [reps, setReps] = useState("8");
  const [weight, setWeight] = useState("20");

  // Smart pre-fill: most recent set from a PREVIOUS session of this exercise
  const prevSessionSet = useLiveQuery(async () => {
    const allWEs = await db.workoutExercises
      .where("exerciseId")
      .equals(exercise.id)
      .filter((we) => we.id !== workoutExerciseId)
      .toArray();
    if (allWEs.length === 0) return null;
    const prevSets = await db.setEntries
      .where("workoutExerciseId")
      .anyOf(allWEs.map((we) => we.id))
      .sortBy("createdAt");
    return prevSets.length > 0 ? prevSets[prevSets.length - 1] : null;
  }, [exercise.id, workoutExerciseId]);

  // Pre-fill from current session's last set
  useEffect(() => {
    if (lastSet) {
      setReps(String(lastSet.reps));
      setWeight(String(lastSet.weight));
    }
  }, [lastSet]);

  // Pre-fill from previous session — only when no sets logged yet in current session
  useEffect(() => {
    if (prevSessionSet && !lastSet) {
      setReps(String(prevSessionSet.reps));
      setWeight(String(prevSessionSet.weight));
    }
  }, [prevSessionSet, lastSet]);

  const isFinished = Boolean(completedAt);
  const isTimerActive = isActive && !isFinished && Boolean(startedAt);
  const [elapsed, setElapsed] = useState(() => computeElapsed(startedAt));
  const durationSeconds = computeDurationSeconds(startedAt, completedAt);
  const [expanded, setExpanded] = useState(false);
  const [showTimeModal, setShowTimeModal] = useState(false);

  const handleTimeSave = async (durationSecs: number) => {
    await updateExerciseTime(workoutExerciseId, durationSecs);
  };
  const [editMode, setEditMode] = useState(false);
  const [showAddConfirm, setShowAddConfirm] = useState<{ reps: number; weight: number } | null>(null);

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

  /* ── Completed (finished) exercise card ── */
  if (isFinished && !isActive) {
    const summary = summarizeSets(sets ?? []);

    return (
      <div className={cn("transition-all duration-200", isInGrid && expanded && "col-span-2")}>
        <TimeEditorModal
          isOpen={showTimeModal}
          onClose={() => setShowTimeModal(false)}
          onSave={handleTimeSave}
          initialDurationSeconds={durationSeconds}
        />
        {/* Add-set confirmation modal */}
        <Modal
          isOpen={!!showAddConfirm}
          onClose={() => setShowAddConfirm(null)}
          title="Add set?"
          description={showAddConfirm ? `${showAddConfirm.reps} reps × ${showAddConfirm.weight} kg` : ""}
          footer={
            <div className="flex gap-3">
              <Button variant="secondary" onClick={() => setShowAddConfirm(null)}>Cancel</Button>
              <Button onClick={async () => {
                if (!showAddConfirm) return;
                await addSetToWorkoutExercise(workoutExerciseId, {
                  reps: showAddConfirm.reps,
                  weight: showAddConfirm.weight,
                  notes: undefined
                });
                setShowAddConfirm(null);
              }}>
                <Check className="h-3.5 w-3.5 mr-1.5" /> Confirm
              </Button>
            </div>
          }
        >
          <p className="text-sm text-muted-foreground px-1">This will be added to the set log.</p>
        </Modal>

        {!expanded ? (
          /* ── Collapsed tile ── */
          <button
            onClick={() => setExpanded(true)}
            className="group flex w-full items-center gap-3 rounded-2xl border border-border/30 bg-card/75 backdrop-blur-lg shadow-e1 px-4 py-3 text-left transition-all duration-200 ease-spring hover:bg-card/85 active:bg-card/95"
          >
            <Check className="h-4 w-4 shrink-0 text-success transition-transform duration-300 group-hover:-rotate-12 group-hover:scale-125 group-active:rotate-0" strokeWidth={2.5} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate">{title}</p>
              <p className="text-xs text-muted-foreground truncate">
                {formatSetsInline(sets ?? [])} · {formatDurationRounded(durationSeconds)}
              </p>
            </div>
            <div className="flex items-center gap-0.5 shrink-0">
              {allowEdit && (
                <>
                  <span
                    role="button"
                    onClick={(e) => { e.stopPropagation(); setShowTimeModal(true); }}
                    className="group border border-transparent hover:border-primary/20 flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-medium text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                  >
                    <span className="max-w-0 overflow-hidden whitespace-nowrap transition-all duration-300 group-hover:max-w-[5rem]">
                      {/* edit duration */}
                    </span>
                    <Clock className="h-3.5 w-3.5 duration-300 group-hover:-rotate-12 group-active:rotate-0" />
                  </span>
                  <span
                    role="button"
                    onClick={(e) => { e.stopPropagation(); setEditMode(true); setExpanded(true); }}
                    className="group border border-transparent hover:border-primary/20 flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-medium text-muted-foreground hover:text-primary hover:bg-primary/10 active:bg-primary/20 transition-colors"
                  >
                    <span className="max-w-0 overflow-hidden whitespace-nowrap transition-all duration-300 group-hover:max-w-[5.5rem]">
                      {/* edit exercise */}
                    </span>
                    <PenLine className="h-3.5 w-3.5 duration-300 group-hover:-rotate-12 group-active:rotate-0" />
                  </span>
                </>
              )}
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
          </button>
        ) : (
          /* ── Expanded view ── */
          <div className="rounded-2xl border border-border/30 bg-card/75 backdrop-blur-lg shadow-e1 overflow-hidden animate-fade-up">
            {/* Expanded header */}
            <button
              onClick={() => { setExpanded(false); setEditMode(false); }}
              className="group flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-card/70 transition-colors duration-200"
            >
              <Check className="h-4 w-4 shrink-0 text-success transition-transform duration-300 group-hover:-rotate-12 group-hover:scale-125 group-active:rotate-0" strokeWidth={2.5} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{title}</p>
                <p className="text-[10px] text-muted-foreground">
                  {formatDurationLong(durationSeconds)} · {summary.totalReps} reps · {summary.totalVolume}kg vol
                </p>
              </div>
              <div className="flex items-center gap-0.5 shrink-0">
                {allowEdit && (
                  <>
                    <span
                      role="button"
                      onClick={(e) => { e.stopPropagation(); setShowTimeModal(true); }}
                      className="group border border-transparent hover:border-primary/20 flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-medium text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                    >
                      <span className="max-w-0 overflow-hidden whitespace-nowrap transition-all duration-300 group-hover:max-w-[5rem]">
                        {/* edit duration */}
                      </span>
                      <Clock className="h-3.5 w-3.5 duration-300 group-hover:-rotate-12 group-active:rotate-0" />
                    </span>
                    <span
                      role="button"
                      onClick={(e) => { e.stopPropagation(); setEditMode(!editMode); }}
                      className={cn(
                        "group border hover:border-primary/20 flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-medium transition-colors",
                        editMode
                          ? "text-primary bg-primary/10 border-primary/20"
                          : "border-transparent text-muted-foreground hover:text-primary hover:bg-primary/10"
                      )}
                    >
                      <span className="max-w-0 overflow-hidden whitespace-nowrap transition-all duration-300 group-hover:max-w-[5.5rem]">
                        {/* edit exercise */}
                      </span>
                      <PenLine className="h-3.5 w-3.5 duration-300 group-hover:-rotate-12 group-active:rotate-0" />
                    </span>
                    {onDelete && editMode && (
                      <span
                        role="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (window.confirm("Archive this exercise from the session? (It can be restored from the settings)")) {
                            onDelete();
                          }
                        }}
                        className="rounded-full p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors group/archive"
                        title="Archive exercise"
                      >
                        <Archive className="h-3.5 w-3.5 transition-transform duration-300 group-hover/archive:scale-110" />
                      </span>
                    )}
                  </>
                )}
                <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
            </button>

            {/* Set chips */}
            <div className="px-4 pb-3 space-y-2">
              {(sets ?? []).length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {(sets ?? []).map((setEntry) => (
                    editMode ? (
                      <SetChip
                        key={setEntry.id}
                        setEntry={setEntry}
                        onUpdate={updateSet}
                        onDelete={deleteSet}
                        requireConfirm
                      />
                    ) : (
                      <span
                        key={setEntry.id}
                        className="inline-flex items-center gap-1.5 rounded-full border border-border/30 bg-background/40 px-2.5 py-1 text-xs"
                      >
                        <span className="font-semibold text-primary/70">#{setEntry.setNumber}</span>
                        <span className="text-muted-foreground">{setEntry.reps}×{setEntry.weight}kg</span>
                      </span>
                    )
                  ))}
                </div>
              )}

              {/* Add set form — only in editMode */}
              {editMode && (
                <div className="flex items-center gap-3 pt-2 mt-1 border-t border-border/20">
                  <StepperInput
                    value={reps}
                    onChange={setReps}
                    step={1}
                    min={0}
                    label="reps"
                    inputMode="numeric"
                    size="sm"
                  />
                  <span className="text-xs text-muted-foreground">×</span>
                  <StepperInput
                    value={weight}
                    onChange={setWeight}
                    step={2.5}
                    min={0}
                    label="kg"
                    inputMode="decimal"
                    size="sm"
                  />
                  <Button
                    size="sm"
                    onClick={() => setShowAddConfirm({ reps: Number(reps) || 0, weight: Number(weight) || 0 })}
                    className="h-8 rounded-full px-3 text-xs ml-auto self-start mt-0.5"
                  >
                    + Add
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  /* ── Pending (not started) exercise ── */
  if (!startedAt && !isFinished) {
    if (!isSessionActive && allowEdit) {
      if (!editMode) {
        return (
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/15 last:border-0 rounded-2xl bg-card/30 backdrop-blur-sm">
            <p className="text-[13px] font-medium text-muted-foreground/60 line-through decoration-muted-foreground/30 truncate">{title}</p>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-[10px] font-normal text-muted-foreground bg-muted/40">Unfinished</Badge>
              <span
                role="button"
                onClick={(e) => { e.stopPropagation(); setEditMode(true); }}
                className="group border border-transparent hover:border-primary/20 flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-medium text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors cursor-pointer"
                title="Edit retroactively"
              >
                <span className="max-w-0 overflow-hidden whitespace-nowrap transition-all duration-300 group-hover:max-w-[5.5rem]">
                  edit exercise
                </span>
                <PenLine className="h-3.5 w-3.5 duration-300 group-hover:-rotate-12 group-active:rotate-0" />
              </span>
            </div>
          </div>
        );
      }
      // If editMode is true, it falls through to the Active Card below.
    } else {
      return (
        <div className="group flex items-center gap-2 border-b border-border/15 bg-transparent px-2 py-2 last:border-0 hover:bg-card/25 transition-colors duration-200">
          <div className="flex flex-col gap-0 border-r border-border/15 pr-2 self-stretch justify-center">
            {onMoveUp && (
              <button onClick={onMoveUp} className="text-muted-foreground/40 hover:text-primary transition-colors p-0.5">
                <ChevronUp className="h-4 w-4" />
              </button>
            )}
            {onMoveDown && (
              <button onClick={onMoveDown} className="text-muted-foreground/40 hover:text-primary transition-colors p-0.5">
                <ChevronDown className="h-4 w-4" />
              </button>
            )}
          </div>
          <div className="min-w-0 flex-1 pl-1">
            <p className="text-[13px] font-medium text-foreground/80 truncate">{title}</p>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={onStart}
              className="flex items-center gap-1.5 rounded-full bg-primary/10 border border-primary/20 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/20 active:scale-95 transition-all duration-150"
            >
              <Play className="h-3 w-3 fill-current" />
              Start
            </button>
            {onDelete && (
              <Button size="icon" variant="ghost" onClick={onDelete} className="h-7 w-7 text-muted-foreground hover:text-destructive">
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
      );
    }
  }

  /* ── Active exercise card (full interactive view) ── */
  return (
    <>
      <TimeEditorModal
        isOpen={showTimeModal}
        onClose={() => setShowTimeModal(false)}
        onSave={handleTimeSave}
        initialDurationSeconds={durationSeconds}
      />
      <div
        className={cn(
          "rounded-2xl border-2 bg-card/90 backdrop-blur-lg shadow-e2 overflow-hidden transition-all duration-200 ease-spring",
          isActive
            ? "border-primary/20 shadow-[0_0_20px_-8px_hsl(var(--primary)/0.15)]"
            : isFinished && allowEdit
              ? "border-border/30"
              : "border-border/20"
        )}
      >
        {/* Card header */}
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border/20">
          <div className="flex items-center gap-2.5 min-w-0">
            <p className="font-semibold text-sm tracking-tight truncate">{title}</p>
            {isTimerActive && (
              <Badge className="bg-success/15 text-success border-success/20 px-2 py-0 text-[10px] font-mono">
                {formatTimer(elapsed)}
              </Badge>
            )}
            {isFinished && allowEdit && (
              <Badge variant="outline" className="px-2 py-0 text-[10px]">Done</Badge>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            {(isActive || allowEdit) && (
              <span
                role="button"
                onClick={(e) => { e.stopPropagation(); setShowTimeModal(true); }}
                className="group flex border border-transparent hover:border-primary/20 items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-medium text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors cursor-pointer"
                title="Edit time"
              >
                <span className="max-w-0 overflow-hidden whitespace-nowrap transition-all duration-300 group-hover:max-w-[5rem]">
                  {/* edit duration */}
                </span>
                <Clock className="h-3.5 w-3.5 duration-300 group-hover:-rotate-12 group-active:rotate-0" />
              </span>
            )}
            {isActive && (
              <span
                role="button"
                title="Toggle edit mode"
                onClick={(e) => { e.stopPropagation(); setEditMode(!editMode); }}
                className={cn(
                  "group flex border hover:border-primary/20 items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-medium transition-colors cursor-pointer",
                  editMode
                    ? "text-primary bg-primary/10 border-primary/20"
                    : "border-transparent text-muted-foreground hover:text-primary hover:bg-primary/10"
                )}
              >
                <span className="max-w-0 overflow-hidden whitespace-nowrap transition-all duration-300 group-hover:max-w-[5.5rem]">
                  {/* edit exercise */}
                </span>
                <PenLine className="h-3.5 w-3.5 duration-300 group-hover:-rotate-12 group-active:rotate-0" />
              </span>
            )}
            {isActive && (
              <Button size="sm" variant="secondary" onClick={onFinish} className="h-7 rounded-full px-3 text-[11px]">
                Finish
              </Button>
            )}
            {!isActive && !isFinished && isSessionActive && (
              <Button size="sm" variant="secondary" onClick={onStart} className="h-7 rounded-full px-3 text-[11px]">
                Start
              </Button>
            )}
            {onDelete && editMode && (
              <Button
                size="icon"
                variant="ghost"
                onClick={() => {
                  if (window.confirm("Archive this exercise from the session? (It can be restored from the settings)")) {
                    onDelete();
                  }
                }}
                className="h-7 w-7 text-muted-foreground hover:text-destructive group/archive"
                title="Archive exercise"
              >
                <Archive className="h-3.5 w-3.5 transition-transform duration-300 group-hover/archive:scale-110" />
              </Button>
            )}
          </div>
        </div>

        {/* Compact set chips */}
        <div className="px-4 py-3 space-y-2">
          {(sets ?? []).length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] text-muted-foreground mr-0.5">{(sets ?? []).length} set{(sets ?? []).length === 1 ? "" : "s"}</span>
              {(sets ?? []).map((setEntry) => (
                editMode ? (
                  <SetChip
                    key={setEntry.id}
                    setEntry={setEntry}
                    onUpdate={updateSet}
                    onDelete={deleteSet}
                    requireConfirm={false}
                  />
                ) : (
                  <span
                    key={setEntry.id}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border/30 bg-background/40 px-2.5 py-1 text-xs animate-in zoom-in-95 duration-150"
                  >
                    <span className="font-semibold text-primary/70">#{setEntry.setNumber}</span>
                    <span className="text-muted-foreground">{setEntry.reps}×{setEntry.weight}kg</span>
                  </span>
                )
              ))}
            </div>
          )}

          {/* Smart Quick Add */}
          <div className="space-y-2 pt-1">
            {/* Row 1: Steppers */}
            <div className="flex items-center gap-2">
              <StepperInput
                value={reps}
                onChange={setReps}
                step={1}
                min={0}
                label="reps"
                inputMode="numeric"
                size="md"
              />
              <span className="text-xs text-muted-foreground mb-4">×</span>
              <StepperInput
                value={weight}
                onChange={setWeight}
                step={2.5}
                min={0}
                label="kg"
                inputMode="decimal"
                size="md"
              />
            </div>
            {/* Row 2: Log + Repeat buttons — full width, below steppers */}
            <div className="flex items-center gap-2">
              <Button onClick={addSet} className="h-11 flex-1 rounded-full text-sm font-semibold">
                Log
              </Button>
              {lastSet && (
                <Button variant="secondary" onClick={quickRepeat} className="h-11 rounded-full px-4 text-sm" title="Repeat last set">
                  <RotateCcw className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   SET CHIP
   ═══════════════════════════════════════════════════════════════════ */

function SetChip({
  setEntry,
  onUpdate,
  onDelete,
  requireConfirm
}: {
  setEntry: SetEntry;
  onUpdate: (setEntry: SetEntry, patch: Partial<SetEntry>) => void;
  onDelete: (id: string) => void;
  requireConfirm?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [editReps, setEditReps] = useState(String(setEntry.reps));
  const [editWeight, setEditWeight] = useState(String(setEntry.weight));
  const [showConfirm, setShowConfirm] = useState(false);

  const handleConfirmSave = () => {
    onUpdate(setEntry, { reps: Number(editReps) || 0, weight: Number(editWeight) || 0 });
    setShowConfirm(false);
    setEditing(false);
  };

  if (editing) {
    return (
      <>
        <Modal
          isOpen={showConfirm}
          onClose={() => setShowConfirm(false)}
          title="Save changes?"
          description="Update this set?"
          footer={
            <div className="flex gap-3">
              <Button variant="secondary" onClick={() => setShowConfirm(false)}>Cancel</Button>
              <Button onClick={handleConfirmSave}>
                <Check className="h-3.5 w-3.5 mr-1.5" /> Save
              </Button>
            </div>
          }
        >
          <div className="rounded-xl border border-border/20 bg-muted/20 px-4 py-3">
            <p className="text-sm">
              Set <span className="font-semibold text-primary">#{setEntry.setNumber}</span>:{" "}
              <span className="font-semibold">{editReps} reps × {editWeight}kg</span>
            </p>
          </div>
        </Modal>

        <div className="flex items-center gap-1.5 rounded-xl border border-primary/15 bg-accent/20 px-2 py-1.5 animate-in zoom-in-95 duration-100">
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
              if (requireConfirm) {
                setShowConfirm(true);
              } else {
                onUpdate(setEntry, { reps: Number(editReps) || 0, weight: Number(editWeight) || 0 });
                setEditing(false);
              }
            }}
            className="text-success hover:text-success/80 p-0.5"
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
      </>
    );
  }

  return (
    <button
      onClick={() => {
        setEditReps(String(setEntry.reps));
        setEditWeight(String(setEntry.weight));
        setEditing(true);
      }}
      className="inline-flex items-center gap-1.5 rounded-full border border-border/30 bg-background/40 px-2.5 py-1 text-xs transition-all duration-200 ease-spring hover:border-primary/15 hover:bg-accent/20"
    >
      <span className="font-semibold text-primary/70">#{setEntry.setNumber}</span>
      <span className="text-muted-foreground">{setEntry.reps}×{setEntry.weight}kg</span>
    </button>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   MONTH HISTORY STRIP
   ═══════════════════════════════════════════════════════════════════ */

type MonthHistoryStripProps = {
  today: string;
  monthWorkoutMap: Map<string, Workout[]>;
  exerciseMap: Map<string, Exercise>;
  muscleMap: Map<string, MuscleGroup>;
  selectedDate: string;
  onSelectDate: (date: string) => void;
  historyPopoverDate: string | null;
  onSetHistoryPopoverDate: (date: string | null) => void;
  onCopyAsTemplate: (workoutId: string) => void;
  copyBusy: boolean;
};

function MonthHistoryStrip({
  today,
  monthWorkoutMap,
  exerciseMap,
  muscleMap,
  selectedDate,
  onSelectDate,
  historyPopoverDate,
  onSetHistoryPopoverDate,
  onCopyAsTemplate,
  copyBusy,
}: MonthHistoryStripProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const todayRef = useRef<HTMLButtonElement>(null);

  // Build the 30-day range (oldest → today)
  const days = useMemo(() => {
    const end = new Date();
    const start = subDays(end, 29);
    return eachDayOfInterval({ start, end });
  }, []);

  // Scroll today into view on mount
  useEffect(() => {
    todayRef.current?.scrollIntoView({ behavior: "auto", inline: "center", block: "nearest" });
  }, []);

  const hasWorkout = (dateStr: string) => (monthWorkoutMap.get(dateStr)?.length ?? 0) > 0;
  const isToday = (dateStr: string) => dateStr === today;

  return (
    <div className="relative">
      {/* Strip container */}
      <div
        ref={scrollRef}
        className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-1.5 px-0.5"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {days.map((day) => {
          const dateStr = localDateIso(day);
          const dayLabel = format(day, "d");
          const weekLabel = format(day, "EEE");
          const hasW = hasWorkout(dateStr);
          const isTodayCell = isToday(dateStr);
          const isSelected = dateStr === selectedDate;
          const isPopoverOpen = historyPopoverDate === dateStr;

          return (
            <div key={dateStr} className="relative flex-shrink-0">
              <button
                ref={isTodayCell ? todayRef : undefined}
                onClick={() => {
                  onSelectDate(dateStr);
                  if (hasW && !isTodayCell) {
                    onSetHistoryPopoverDate(isPopoverOpen ? null : dateStr);
                  } else {
                    onSetHistoryPopoverDate(null);
                  }
                }}
                className={cn(
                  "flex flex-col items-center gap-0.5 rounded-2xl px-2 py-2 transition-all duration-200 ease-spring min-w-[44px]",
                  isTodayCell
                    ? "bg-primary text-primary-foreground shadow-[0_4px_14px_-4px_hsl(var(--primary)/0.4)]"
                    : isSelected
                      ? "bg-accent/60 text-foreground backdrop-blur-sm"
                      : hasW
                        ? "bg-card/60 hover:bg-card/80 border border-border/25 hover:border-primary/20 backdrop-blur-sm"
                        : "hover:bg-muted/30 text-muted-foreground"
                )}
              >
                <span className={cn(
                  "text-[10px] font-medium",
                  isTodayCell ? "text-primary-foreground/70" : "text-muted-foreground"
                )}>
                  {weekLabel}
                </span>
                <span className={cn(
                  "text-sm font-bold leading-none",
                  isTodayCell ? "text-primary-foreground" : hasW ? "text-foreground" : "text-muted-foreground"
                )}>
                  {dayLabel}
                </span>
                {/* Workout dot */}
                <div className="h-1.5 w-1.5 rounded-full mt-0.5">
                  {hasW && (
                    <div className={cn(
                      "h-1.5 w-1.5 rounded-full",
                      isTodayCell ? "bg-primary-foreground/60" : "bg-primary/60"
                    )} />
                  )}
                </div>
              </button>

              {/* Popover for past workout days */}
              {isPopoverOpen && hasW && !isTodayCell && (
                <WorkoutHistoryPopover
                  dateStr={dateStr}
                  workouts={monthWorkoutMap.get(dateStr) ?? []}
                  exerciseMap={exerciseMap}
                  muscleMap={muscleMap}
                  onCopyAsTemplate={onCopyAsTemplate}
                  onClose={() => onSetHistoryPopoverDate(null)}
                  copyBusy={copyBusy}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Workout History Popover ── */

function WorkoutHistoryPopover({
  dateStr,
  workouts,
  exerciseMap,
  muscleMap,
  onCopyAsTemplate,
  onClose,
  copyBusy,
}: {
  dateStr: string;
  workouts: Workout[];
  exerciseMap: Map<string, Exercise>;
  muscleMap: Map<string, MuscleGroup>;
  onCopyAsTemplate: (workoutId: string) => void;
  onClose: () => void;
  copyBusy: boolean;
}) {
  // Use the first/most-recent completed workout
  const workout = workouts.find((w) => w.status === "completed") ?? workouts[0];

  const workoutExercises = useLiveQuery(
    () => db.workoutExercises.where("workoutId").equals(workout.id).sortBy("orderIndex"),
    [workout.id]
  );

  // Compute top-5 muscles by frequency (count of exercises targeting each muscle)
  const topMuscles = useMemo(() => {
    if (!workoutExercises) return [];
    const freq = new Map<string, number>();
    workoutExercises.forEach((we) => {
      const ex = exerciseMap.get(we.exerciseId);
      if (!ex) return;
      const ids = [...ex.primaryMuscleIds, ...ex.secondaryMuscleIds];
      ids.forEach((id) => freq.set(id, (freq.get(id) ?? 0) + 1));
    });
    return Array.from(freq.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id]) => muscleMap.get(id)?.name ?? id);
  }, [workoutExercises, exerciseMap, muscleMap]);

  const exerciseCount = workoutExercises?.length ?? 0;
  const dateLabel = formatLocalDate(dateStr, "EEE, MMM d");

  return (
    <div
      className="absolute left-1/2 top-full mt-2 z-50 -translate-x-1/2 w-56 rounded-2xl border border-border/30 bg-card/95 backdrop-blur-xl shadow-[0_16px_40px_-12px_hsl(var(--foreground)/0.2)] animate-fade-up"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="px-4 pt-3 pb-2 border-b border-border/20">
        <p className="text-xs font-semibold text-foreground">{dateLabel}</p>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          {exerciseCount} exercise{exerciseCount !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Top muscles */}
      {topMuscles.length > 0 && (
        <div className="px-4 py-2.5">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Top muscles</p>
          <div className="flex flex-wrap gap-1.5">
            {topMuscles.map((m, i) => (
              <span
                key={m}
                className={cn(
                  "inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-medium border",
                  i === 0
                    ? "bg-primary/10 text-primary border-primary/20"
                    : i === 1
                      ? "bg-primary/7 text-primary/80 border-primary/15"
                      : "bg-muted/60 text-muted-foreground border-border/40"
                )}
              >
                {m}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* CTA */}
      <div className="px-3 pb-3">
        <button
          onClick={() => onCopyAsTemplate(workout.id)}
          disabled={copyBusy}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 active:scale-[0.98] transition-all duration-150 disabled:opacity-50"
        >
          <Dumbbell className="h-3.5 w-3.5" />
          Use as today&apos;s template
        </button>
        <button
          onClick={onClose}
          className="mt-1.5 w-full rounded-xl px-3 py-1.5 text-[11px] text-muted-foreground hover:bg-muted/30 transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  );
}
