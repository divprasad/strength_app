"use client";

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { differenceInCalendarDays, differenceInCalendarWeeks, format, parseISO } from "date-fns";
import { db } from "@/lib/db";
import { createExercise } from "@/lib/repository";
import type { Exercise } from "@/types/domain";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Modal } from "@/components/ui/modal";
import { ExerciseForm } from "@/components/exercise/exercise-form";
import { Edit2, Plus, Trophy } from "lucide-react";

/* ── 1RM helper (Epley formula) ── */
function estimate1RM(weight: number, reps: number): number {
  if (reps <= 0 || weight <= 0) return 0;
  if (reps === 1) return weight;
  return Math.round(weight * (1 + reps / 30));
}

/* ── Relative "last seen" label ── */
function relativeTime(dateStr: string): string {
  const today = new Date();
  const date = parseISO(dateStr);
  const days = differenceInCalendarDays(today, date);
  if (days === 0) return "today";
  if (days === 1) return "1d ago";
  if (days < 14) return `${days}d ago`;
  const weeks = differenceInCalendarWeeks(today, date);
  if (weeks < 52) return `${weeks}w ago`;
  return `${Math.floor(weeks / 52)}y ago`;
}

/* ── Per-exercise 1RM + last-seen lookup ── */
function useExerciseBests(exercises: Exercise[] | undefined) {
  return useLiveQuery(async () => {
    if (!exercises || exercises.length === 0) return {};

    const bests: Record<string, { estimated1RM: number; weight: number; reps: number; date: string }> = {};

    const allWE = await db.workoutExercises.toArray();
    const workoutCache: Record<string, string> = {};

    for (const we of allWE) {
      const exerciseId = we.exerciseId;
      if (!exercises.some(e => e.id === exerciseId)) continue;

      const sets = await db.setEntries
        .where("workoutExerciseId")
        .equals(we.id)
        .toArray();

      for (const set of sets) {
        if (set.weight <= 0 || set.reps <= 0) continue;
        const e1rm = estimate1RM(set.weight, set.reps);

        if (!bests[exerciseId] || e1rm > bests[exerciseId].estimated1RM) {
          if (!workoutCache[we.workoutId]) {
            const workout = await db.workouts.get(we.workoutId);
            workoutCache[we.workoutId] = workout?.date ?? "";
          }
          bests[exerciseId] = {
            estimated1RM: e1rm,
            weight: set.weight,
            reps: set.reps,
            date: workoutCache[we.workoutId]
          };
        }
      }
    }

    return bests;
  }, [exercises]);
}

/* ── Last-seen date per exercise ── */
function useLastSeen(exercises: Exercise[] | undefined) {
  return useLiveQuery(async () => {
    if (!exercises || exercises.length === 0) return {};

    const lastSeen: Record<string, string> = {};

    const allWE = await db.workoutExercises.toArray();
    const workoutDateCache: Record<string, string> = {};

    for (const we of allWE) {
      const exerciseId = we.exerciseId;
      if (!exercises.some(e => e.id === exerciseId)) continue;

      if (!workoutDateCache[we.workoutId]) {
        const workout = await db.workouts.get(we.workoutId);
        workoutDateCache[we.workoutId] = workout?.date ?? "";
      }

      const date = workoutDateCache[we.workoutId];
      if (!date) continue;

      if (!lastSeen[exerciseId] || date > lastSeen[exerciseId]) {
        lastSeen[exerciseId] = date;
      }
    }

    return lastSeen;
  }, [exercises]);
}

export function ExerciseList() {
  const muscles = useLiveQuery(() => db.muscleGroups.orderBy("name").toArray(), []);
  const exercises = useLiveQuery(() => db.exercises.orderBy("name").toArray(), []);
  const bests = useExerciseBests(exercises);
  const lastSeen = useLastSeen(exercises);

  const [editing, setEditing] = useState<Exercise | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filteredExercises = exercises ?? [];

  function handleOpenCreate() {
    setEditing(null);
    setError(null);
    setIsModalOpen(true);
  }

  function handleOpenEdit(exercise: Exercise) {
    setEditing(exercise);
    setError(null);
    setIsModalOpen(true);
  }

  function handleCloseModal() {
    setIsModalOpen(false);
    setEditing(null);
  }

  async function handleCreate(payload: Omit<Exercise, "id" | "createdAt" | "updatedAt">) {
    try {
      setError(null);
      await createExercise(payload);
      handleCloseModal();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create exercise.");
    }
  }

  async function handleEdit(payload: Exercise) {
    try {
      setError(null);
      const duplicate = await db.exercises
        .where("name")
        .equalsIgnoreCase(payload.name)
        .and((e) => e.id !== payload.id)
        .first();
      if (duplicate) {
        setError("Exercise name already exists.");
        return;
      }
      await db.exercises.put(payload);
      handleCloseModal();
    } catch {
      setError("Unable to update exercise.");
    }
  }

  return (
    <div className="space-y-3">

      {filteredExercises.length > 0 ? (
        <ul className="grid gap-2">
          {filteredExercises.map((exercise) => {
            const best = bests?.[exercise.id];
            const seenDate = lastSeen?.[exercise.id];
            const primaryMuscles = exercise.primaryMuscleIds
              ?.map(id => muscles?.find(m => m.id === id))
              .filter(Boolean);

            return (
              <li
                key={exercise.id}
                className="group rounded-2xl border border-border/50 bg-card/60 hover:bg-card/90 transition-all hover:shadow-[0_8px_24px_-12px_hsl(var(--foreground)/0.15)] p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  {/* Left: Name + meta */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold tracking-tight text-foreground truncate">
                        {exercise.name}
                      </p>
                      {/* Last seen chip */}
                      {seenDate && (
                        <span className="text-[10px] font-medium text-muted-foreground/60 tabular-nums shrink-0">
                          {relativeTime(seenDate)}
                        </span>
                      )}
                      <button
                        onClick={() => handleOpenEdit(exercise)}
                        className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md hover:bg-muted"
                        title="Edit exercise"
                      >
                        <Edit2 className="h-3 w-3 text-muted-foreground" />
                      </button>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                      {exercise.category && (
                        <Badge className="bg-primary/10 text-primary border-transparent px-2 py-0 text-[10px] uppercase font-bold tracking-wider">
                          {exercise.category}
                        </Badge>
                      )}
                      {exercise.equipment && exercise.equipment.trim() !== "" && (
                        <Badge variant="outline" className="border-border/50 text-muted-foreground px-2 py-0 text-[10px] font-normal">
                          {exercise.equipment}
                        </Badge>
                      )}
                      {primaryMuscles && primaryMuscles.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {primaryMuscles.map(muscle => muscle && (
                            <span
                              key={muscle.id}
                              className="text-[10px] font-medium text-muted-foreground/80 bg-muted/40 px-1.5 py-0.5 rounded-md"
                            >
                              {muscle.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right: 1RM display */}
                  <div className="shrink-0 text-right">
                    {best ? (
                      <div className="flex flex-col items-end gap-0.5">
                        <div className="flex items-center gap-1.5">
                          <Trophy className="h-3 w-3 text-amber-500/70" />
                          <span className="text-lg font-bold tabular-nums tracking-tight text-foreground">
                            {best.estimated1RM}
                          </span>
                          <span className="text-[10px] text-muted-foreground font-medium">kg</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground/60 tabular-nums">
                          {best.weight}×{best.reps}
                          {best.date && (
                            <span className="ml-1">
                              · {format(parseISO(best.date), "MMM d")}
                            </span>
                          )}
                        </p>
                      </div>
                    ) : (
                      <span className="text-[10px] text-muted-foreground/40 italic">no data</span>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <Card className="border-dashed bg-transparent border-border/60 shadow-none">
          <CardContent className="pt-5">
            <EmptyState 
              title="No exercises yet"
              description="Create your first custom movement to start logging."
            />
          </CardContent>
        </Card>
      )}

      {/* Add exercise — below the list, matching muscle manager style */}
      <div className="flex gap-2">
        <button
          onClick={handleOpenCreate}
          className="flex flex-1 items-center gap-2 rounded-xl border border-border/50 bg-background/80 px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:border-primary/30 hover:bg-card/80 transition-all text-left"
        >
          Add exercise...
        </button>
        <Button onClick={handleOpenCreate} size="sm" className="shrink-0 rounded-xl px-4">
          <Plus className="h-4 w-4 mr-1" />
          Add
        </Button>
      </div>

      <Modal 
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={editing ? `Edit ${editing.name}` : "Create Exercise"}
        description="Define how movements are grouped and tracked so logging and analytics stay consistent."
      >
        {muscles ? (
          <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2 pb-2 -mr-2">
            <ExerciseForm
              muscles={muscles}
              initial={editing ?? undefined}
              onSubmit={async (payload) => {
                if (editing) {
                  await handleEdit(payload as Exercise);
                } else {
                  await handleCreate(payload as Omit<Exercise, "id" | "createdAt" | "updatedAt">);
                }
              }}
              onCancel={handleCloseModal}
            />
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
