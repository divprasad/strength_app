"use client";

import { addWeeks, eachDayOfInterval, endOfWeek, format, parseISO, startOfWeek, subWeeks } from "date-fns";
import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { ChevronLeft, ChevronRight, Dumbbell } from "lucide-react";
import { useRouter } from "next/navigation";
import { db } from "@/lib/db";
import { cn, localDateIso } from "@/lib/utils";
import { addExerciseToWorkout, createWorkoutForDate, deleteWorkout, listWorkoutsByDate } from "@/lib/repository";
import { useUiStore } from "@/lib/store";
import { PageIntro } from "@/components/layout/page-intro";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { computeDurationSeconds, formatDurationLong, formatTimeOfDay } from "@/lib/time";
import { collapseSetGroups, formatCollapsedSets } from "@/lib/format-sets";

export function WeeklyHistory() {
  const [anchorDate, setAnchorDate] = useState(localDateIso(new Date()));
  const [selectedDate, setSelectedDate] = useState(localDateIso(new Date()));
  const [copyingId, setCopyingId] = useState<string | null>(null);

  const router = useRouter();
  const setStoreSelectedDate = useUiStore((s) => s.setSelectedDate);
  const setActiveWorkoutId = useUiStore((s) => s.setActiveWorkoutId);

  async function handleCopyAsTemplate(workoutId: string) {
    setCopyingId(workoutId);
    try {
      const todayStr = localDateIso(new Date());
      const sourceExercises = await db.workoutExercises
        .where("workoutId")
        .equals(workoutId)
        .sortBy("orderIndex");
      const todayWorkouts = await listWorkoutsByDate(todayStr);
      for (const w of todayWorkouts) {
        if (w.status === "draft") await deleteWorkout(w.id);
      }
      const newWorkout = await createWorkoutForDate(todayStr);
      for (const we of sourceExercises) {
        await addExerciseToWorkout(newWorkout.id, we.exerciseId);
      }
      setStoreSelectedDate(todayStr);
      setActiveWorkoutId(newWorkout.id);
      router.push("/workouts");
    } finally {
      setCopyingId(null);
    }
  }

  const weekStart = startOfWeek(parseISO(anchorDate), { weekStartsOn: 1 });
  const weekEnd = endOfWeek(parseISO(anchorDate), { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const workouts = useLiveQuery(
    () => db.workouts.where("date").between(format(weekStart, "yyyy-MM-dd"), format(weekEnd, "yyyy-MM-dd"), true, true).toArray().then(arr => arr.filter(w => w.status !== "archived")),
    [anchorDate]
  );



  const workoutsForDate = useLiveQuery(async () => {
    const dateWorkouts = await db.workouts.where("date").equals(selectedDate).toArray();
    const sorted = dateWorkouts.sort((a, b) => (a.sessionStartedAt ?? a.createdAt).localeCompare(b.sessionStartedAt ?? b.createdAt));
    return Promise.all(
      sorted.map(async (workout) => {
        const items = await db.workoutExercises.where("workoutId").equals(workout.id).sortBy("orderIndex");
        const details = await Promise.all(
          items.map(async (item) => {
            const exercise = await db.exercises.get(item.exerciseId);
            const sets = await db.setEntries.where("workoutExerciseId").equals(item.id).sortBy("setNumber");
            return { item, exercise, sets };
          })
        );
        return { workout, items: details };
      })
    );
  }, [selectedDate]);
  const loggedDays = new Set((workouts ?? []).map((workout) => workout.date)).size;

  return (
    <div className="space-y-6">
      <PageIntro
        title="History"
        description="Past sessions by week."
        action={
          <>
            <Button size="sm" variant="ghost" onClick={() => setAnchorDate(localDateIso(subWeeks(parseISO(anchorDate), 1)))}>
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setAnchorDate(localDateIso(addWeeks(parseISO(anchorDate), 1)))}>
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </>
        }
        meta={
          <>
            <Badge className="bg-accent px-3 py-1 text-accent-foreground">{format(parseISO(selectedDate), "EEE, MMM d")}</Badge>
            <Badge>{loggedDays} logged day{loggedDays === 1 ? "" : "s"} this week</Badge>
          </>
        }
      />

      <Card className="overflow-hidden">
        <CardHeader className="pb-4">
          <CardTitle>Week View</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-2">
            {days.map((date) => {
              const iso = format(date, "yyyy-MM-dd");
              const hasWorkout = workouts?.some((w) => w.date === iso);
              const selected = selectedDate === iso;
              return (
                <button
                  key={iso}
                  onClick={() => setSelectedDate(iso)}
                  className={`rounded-[1.2rem] border px-2 py-3 text-center text-sm shadow-[inset_0_1px_0_hsl(0_0%_100%/0.45)] transition-colors ${
                    selected
                      ? "border-primary/20 bg-accent/80 text-foreground"
                      : "border-border/70 bg-background/55 hover:border-border hover:bg-card"
                  }`}
                >
                  <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{format(date, "EEE")}</p>
                  <p className="mt-1 text-lg font-semibold tracking-[-0.03em]">{format(date, "d")}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">{hasWorkout ? "Logged" : "-"}</p>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader className="pb-4">
          <CardTitle>{format(parseISO(selectedDate), "EEEE, MMM d")}</CardTitle>
        </CardHeader>
        <CardContent>
          {workoutsForDate && workoutsForDate.length > 0 ? (
            <div className="space-y-3">
              {workoutsForDate.map((entry, index) => {
                const durationSeconds = computeDurationSeconds(entry.workout.sessionStartedAt, entry.workout.sessionEndedAt);
                return (
                  <div key={entry.workout.id} className="overflow-hidden rounded-2xl border border-border/60 bg-background/55 p-4 shadow-e2">
                    <div className="flex items-center justify-between border-b border-border/50 pb-3">
                      <div className="flex items-center gap-3">
                        <span className="text-[0.7rem] font-bold uppercase tracking-[0.14em] text-primary/70">Session {index + 1}</span>
                        <div className="h-4 w-px bg-border/50" />
                        <span className="text-sm font-semibold tracking-tight">
                          {formatTimeOfDay(entry.workout.sessionStartedAt)} · {formatDurationLong(durationSeconds)}
                        </span>
                      </div>
                      <button
                        onClick={() => handleCopyAsTemplate(entry.workout.id)}
                        disabled={copyingId !== null}
                        title="Copy as today's template"
                        className="flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/5 px-2.5 py-1 text-[10px] font-medium text-primary/70 hover:bg-primary/12 hover:border-primary/50 hover:text-primary active:scale-95 transition-all duration-200 disabled:opacity-40"
                      >
                        <Dumbbell className={cn("h-3 w-3", copyingId === entry.workout.id && "animate-pulse")} />
                        Template
                      </button>
                    </div>
                    
                    <div className="mt-4 space-y-4">
                      {entry.items.length > 0 ? (
                        entry.items.map((exerciseEntry) => {
                          const exerciseDuration = computeDurationSeconds(
                            exerciseEntry.item.startedAt,
                            exerciseEntry.item.completedAt ?? entry.workout.sessionEndedAt
                          );
                          return (
                            <div key={exerciseEntry.item.id} className="space-y-2">
                              <div className="flex items-center justify-between gap-4">
                                <p className="text-sm font-medium tracking-tight text-foreground">{exerciseEntry.exercise?.name ?? "Unknown exercise"}</p>
                                <span className="text-[10px] tabular-nums text-muted-foreground">{formatDurationLong(exerciseDuration)}</span>
                              </div>
                              
                              <div className="mt-1">
                                <p className="text-xs text-muted-foreground">
                                  {formatCollapsedSets(collapseSetGroups(exerciseEntry.sets))}
                                </p>
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <p className="text-xs text-muted-foreground italic">No exercises recorded.</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState title="Rest day" description="No workout logged." />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
