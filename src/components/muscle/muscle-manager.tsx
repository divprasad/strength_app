"use client";

import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { differenceInCalendarDays, differenceInCalendarWeeks, parseISO } from "date-fns";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { db } from "@/lib/db";
import { createMuscleGroup } from "@/lib/repository";
import { nowIso } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Edit2, Plus } from "lucide-react";

const schema = z.object({
  name: z.string().trim().min(2, "Name is too short")
});

type FormValues = z.infer<typeof schema>;

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

export function MuscleManager() {
  const muscles = useLiveQuery(() => db.muscleGroups.orderBy("name").toArray(), []);
  const exercises = useLiveQuery(() => db.exercises.toArray(), []);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  const exerciseCountByMuscle = useMemo(() => {
    const map = new Map<string, number>();
    (exercises ?? []).forEach((ex) => {
      [...ex.primaryMuscleIds, ...ex.secondaryMuscleIds].forEach((id) => {
        map.set(id, (map.get(id) ?? 0) + 1);
      });
    });
    return map;
  }, [exercises]);

  const lastSeenByMuscle = useLiveQuery(async () => {
    if (!muscles || muscles.length === 0) return new Map<string, string>();
    if (!exercises || exercises.length === 0) return new Map<string, string>();

    const result = new Map<string, string>();
    const allWE = await db.workoutExercises.toArray();
    const workoutDateCache: Record<string, string> = {};

    for (const we of allWE) {
      const ex = (exercises ?? []).find((e) => e.id === we.exerciseId);
      if (!ex) continue;

      if (!workoutDateCache[we.workoutId]) {
        const workout = await db.workouts.get(we.workoutId);
        if (!workout || workout.status !== "completed") {
          workoutDateCache[we.workoutId] = "";
          continue;
        }
        workoutDateCache[we.workoutId] = workout.date ?? "";
      }

      const date = workoutDateCache[we.workoutId];
      if (!date) continue;

      const muscleIds = [...ex.primaryMuscleIds, ...ex.secondaryMuscleIds];
      muscleIds.forEach((id) => {
        const existing = result.get(id);
        if (!existing || date > existing) result.set(id, date);
      });
    }

    return result;
  }, [muscles, exercises]);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "" }
  });

  async function onSubmit(values: FormValues) {
    const duplicate = await db.muscleGroups.where("name").equalsIgnoreCase(values.name).first();
    if (duplicate) {
      form.setError("name", { message: "Muscle group already exists." });
      return;
    }
    await createMuscleGroup(values.name);
    form.reset();
  }

  async function saveEdit(id: string) {
    const normalized = editingName.trim();
    if (!normalized) return;
    const duplicate = await db.muscleGroups
      .where("name")
      .equalsIgnoreCase(normalized)
      .and((m) => m.id !== id)
      .first();
    if (duplicate) return;
    await db.muscleGroups.update(id, { name: normalized, updatedAt: nowIso() });
    setEditingId(null);
    setEditingName("");
  }

  const muscleCount = muscles?.length ?? 0;

  // Count exercises per muscle group (read-only, derived from local Dexie state)
  function exerciseCount(muscleId: string): number {
    return (exercises ?? []).filter(
      (e) => (e.primaryMuscleIds as unknown as string[])?.includes(muscleId)
    ).length;
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground px-1">
        {muscleCount} muscle group{muscleCount === 1 ? "" : "s"}
      </p>

      {/* 2-column grid */}
      <ul className="grid grid-cols-2 gap-2">
        {(muscles ?? []).map((muscle) => {
          const exerciseCount = exerciseCountByMuscle.get(muscle.id) ?? 0;
          const seenDate = lastSeenByMuscle?.get(muscle.id);

          return (
            <li
              key={muscle.id}
              className="group rounded-2xl border border-border/50 bg-card/60 hover:bg-card/90 transition-all p-3.5"
            >
              {editingId === muscle.id ? (
                <div className="flex flex-col gap-2">
                  <Input
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    className="h-8 w-full rounded-lg text-sm"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") { e.preventDefault(); saveEdit(muscle.id); }
                      if (e.key === "Escape") setEditingId(null);
                    }}
                  />
                  <div className="flex gap-1.5">
                    <Button size="sm" className="h-7 flex-1 rounded-lg text-xs" onClick={() => saveEdit(muscle.id)}>
                      Save
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 rounded-lg px-2 text-xs" onClick={() => setEditingId(null)}>
                      ✕
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-1">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground leading-tight">{muscle.name}</p>
                    <div className="flex flex-wrap items-center gap-1 mt-1">
                      {exerciseCount > 0 ? (
                        <span className="text-[10px] text-muted-foreground/60">
                          {exerciseCount} ex
                        </span>
                      ) : (
                        <span className="text-[10px] text-muted-foreground/40 italic">no exercises</span>
                      )}
                      {seenDate && (
                        <>
                          <span className="text-[10px] text-muted-foreground/40">·</span>
                          <span className="text-[10px] text-muted-foreground/60 tabular-nums">
                            {relativeTime(seenDate)}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setEditingId(muscle.id);
                      setEditingName(muscle.name);
                    }}
                    className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md hover:bg-muted"
                    title="Edit muscle group"
                  >
                    <Edit2 className="h-3 w-3 text-muted-foreground" />
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {/* Add form — below the list */}
      <form className="flex gap-2" onSubmit={form.handleSubmit(onSubmit)}>
        <Input
          placeholder="Add muscle group..."
          {...form.register("name")}
          className="flex-1 rounded-xl bg-background/80 border-border/50"
        />
        <Button type="submit" size="sm" className="shrink-0 rounded-xl px-4">
          <Plus className="h-4 w-4 mr-1" />
          Add
        </Button>
      </form>
      {form.formState.errors.name ? (
        <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
      ) : null}

      <p className="text-xs text-muted-foreground px-1">
        {muscleCount} muscle group{muscleCount === 1 ? "" : "s"}
      </p>

      <div className="grid grid-cols-2 gap-2">
        {(muscles ?? []).map((muscle) => {
          const count = exerciseCount(muscle.id);
          return (
            <div
              key={muscle.id}
              className="group rounded-2xl border border-border/50 bg-card/60 hover:bg-card/90 transition-all px-4 py-3"
            >
              {editingId === muscle.id ? (
                <div className="flex items-center gap-2">
                  <Input
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    className="h-8 flex-1 rounded-lg text-sm"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") { e.preventDefault(); saveEdit(muscle.id); }
                      if (e.key === "Escape") setEditingId(null);
                    }}
                  />
                  <Button size="sm" className="h-8 rounded-lg px-3 text-xs" onClick={() => saveEdit(muscle.id)}>
                    Save
                  </Button>
                  <Button size="sm" variant="ghost" className="h-8 rounded-lg px-2 text-xs" onClick={() => setEditingId(null)}>
                    ✕
                  </Button>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{muscle.name}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {count} exercise{count === 1 ? "" : "s"}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setEditingId(muscle.id);
                      setEditingName(muscle.name);
                    }}
                    className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md hover:bg-muted mt-0.5"
                    title="Edit muscle group"
                  >
                    <Edit2 className="h-3 w-3 text-muted-foreground" />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
