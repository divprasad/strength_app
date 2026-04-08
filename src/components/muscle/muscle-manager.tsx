"use client";

import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { differenceInCalendarDays, differenceInCalendarWeeks, parseISO } from "date-fns";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { db } from "@/lib/db";
import { createMuscleGroup } from "@/lib/repository";
import { cn, nowIso } from "@/lib/utils";
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
  const [editError, setEditError] = useState<string | null>(null);

  const exercisesByMuscle = useMemo(() => {
    const map = new Map<string, string[]>();
    (exercises ?? []).forEach((ex) => {
      [...ex.primaryMuscleIds, ...ex.secondaryMuscleIds].forEach((id) => {
        if (!map.has(id)) map.set(id, []);
        map.get(id)!.push(ex.name);
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
    if (!normalized) {
      setEditError("Name cannot be empty");
      return;
    }
    const duplicate = await db.muscleGroups
      .where("name")
      .equalsIgnoreCase(normalized)
      .and((m) => m.id !== id)
      .first();
    if (duplicate) {
      setEditError("Muscle group already exists");
      return;
    }
    await db.muscleGroups.update(id, { name: normalized, updatedAt: nowIso() });
    setEditingId(null);
    setEditingName("");
    setEditError(null);
  }

  const muscleCount = muscles?.length ?? 0;

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs text-muted-foreground px-1 mb-3">
          {muscleCount} muscle group{muscleCount === 1 ? "" : "s"}
        </p>

        {/* 1-column list */}
        <ul className="flex flex-col gap-2 stagger-children">
          {(muscles ?? []).map((muscle) => {
            const exerciseNames = exercisesByMuscle.get(muscle.id) ?? [];
            const exerciseCount = exerciseNames.length;
            const seenDate = lastSeenByMuscle?.get(muscle.id);
            const isUnused = exerciseCount === 0;

            return (
              <li
                key={muscle.id}
                className={cn(
                  "group relative rounded-2xl border border-border/30 bg-card/60 backdrop-blur-sm hover:bg-card/85 transition-all duration-200 ease-spring p-3.5",
                  isUnused && "opacity-50"
                )}
              >
                {editingId === muscle.id ? (
                  <div className="flex flex-col gap-2">
                    <Input
                      value={editingName}
                      onChange={(e) => {
                        setEditingName(e.target.value);
                        setEditError(null);
                      }}
                      className={cn("h-8 w-full rounded-lg text-sm", editError && "border-destructive")}
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Enter") { e.preventDefault(); saveEdit(muscle.id); }
                        if (e.key === "Escape") { setEditingId(null); setEditError(null); }
                      }}
                    />
                    {editError && (
                      <p className="text-[10px] text-destructive leading-none -mt-1">{editError}</p>
                    )}
                    <div className="flex gap-1.5">
                      <Button size="sm" className="h-7 flex-1 rounded-lg text-xs" onClick={() => saveEdit(muscle.id)}>
                        Save
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 rounded-lg px-2 text-xs" onClick={() => { setEditingId(null); setEditError(null); }}>
                        ✕
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-start justify-between gap-4">
                      <p className="text-sm font-medium text-foreground">{muscle.name}</p>
                      {seenDate && (
                        <span className="text-xs text-muted-foreground shrink-0 mt-0.5">
                          {relativeTime(seenDate)}
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex items-center justify-between">
                      <div className="min-w-0 pr-6">
                        {exerciseCount > 0 ? (
                          <p className="text-xs text-muted-foreground truncate">
                            {exerciseCount} ex <span className="text-muted-foreground/60 mx-1">|</span> {exerciseNames.join(", ")}
                          </p>
                        ) : (
                          <p className="text-xs text-muted-foreground italic truncate">no exercises</p>
                        )}
                      </div>
                      <button
                        onClick={() => {
                          setEditingId(muscle.id);
                          setEditingName(muscle.name);
                          setEditError(null);
                        }}
                        className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 p-1.5 rounded-md hover:bg-muted/50"
                        title="Edit muscle group"
                      >
                        <Edit2 className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                    </div>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      {/* Add form — moved to bottom */}
      <div className="pt-2">
        <form className="flex gap-2" onSubmit={form.handleSubmit(onSubmit)}>
          <Input
            placeholder="Add muscle group..."
            {...form.register("name")}
            className="flex-1 rounded-xl bg-card/40 backdrop-blur-sm border-border/30 shadow-none"
          />
          <Button type="submit" size="sm" className="shrink-0 rounded-xl px-4 h-10">
            <Plus className="h-4 w-4 mr-1" />
            Add
          </Button>
        </form>
        {form.formState.errors.name?.message ? (
          <p className="text-sm text-destructive mt-1.5 px-1">{form.formState.errors.name.message}</p>
        ) : null}
      </div>
    </div>
  );
}
