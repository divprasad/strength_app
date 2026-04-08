"use client";

import { addWeeks, eachDayOfInterval, endOfWeek, format, parseISO, startOfWeek, subWeeks } from "date-fns";
import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { ChevronLeft, ChevronRight, Dumbbell, Moon } from "lucide-react";
import { useRouter } from "next/navigation";
import { db } from "@/lib/db";
import { cn, localDateIso } from "@/lib/utils";
import { addExerciseToWorkout, createWorkoutForDate, deleteWorkout, listWorkoutsByDate } from "@/lib/repository";
import { useUiStore } from "@/lib/store";
import { PageIntro } from "@/components/layout/page-intro";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
    <div className="space-y-5 stagger-children">
      <PageIntro
        title="History"
        description="Past sessions by week."
        action={
          <div className="flex items-center gap-1">
            <Button size="sm" variant="ghost" className="h-8 px-3" onClick={() => setAnchorDate(localDateIso(subWeeks(parseISO(anchorDate), 1)))}>
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <Button size="sm" variant="ghost" className="h-8 px-3" onClick={() => setAnchorDate(localDateIso(addWeeks(parseISO(anchorDate), 1)))}>
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        }
        meta={
          <>
            <Badge className="bg-primary/8 text-primary/80 border-primary/10 px-3 py-1">{format(parseISO(selectedDate), "EEE, MMM d")}</Badge>
            <Badge className="bg-muted/50 text-muted-foreground border-border/40">{loggedDays} logged day{loggedDays === 1 ? "" : "s"} this week</Badge>
          </>
        }
      />

      {/* Week View — calendar grid */}
      <div className="rounded-2xl border border-border/30 bg-card/75 p-4 shadow-e1 backdrop-blur-lg">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground/70 mb-3">Week View</p>
        <div className="grid grid-cols-7 gap-2">
          {days.map((date) => {
            const iso = format(date, "yyyy-MM-dd");
            const hasWorkout = workouts?.some((w) => w.date === iso);
            const selected = selectedDate === iso;
            const isToday = iso === localDateIso(new Date());
            return (
              <button
                key={iso}
                onClick={() => setSelectedDate(iso)}
                className={cn(
                  "relative rounded-xl border px-2 py-3 text-center transition-all duration-200 ease-spring",
                  selected
                    ? "border-primary/20 bg-primary/10 ring-1 ring-primary/20 shadow-[0_0_16px_-6px_hsl(var(--primary)/0.2)]"
                    : isToday
                      ? "border-border/40 bg-accent/30"
                      : "border-border/20 bg-card/40 hover:bg-card/70 hover:border-border/40"
                )}
              >
                <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground/70">{format(date, "EEE")}</p>
                <p className={cn("mt-1 text-lg font-bold tracking-[-0.03em]", selected ? "text-primary" : "")}>{format(date, "d")}</p>
                <p className={cn(
                  "mt-1 text-[10px] font-medium",
                  hasWorkout ? "text-success" : "text-muted-foreground/30"
                )}>
                  {hasWorkout ? "Logged" : "–"}
                </p>
                {/* Active dot indicator */}
                {hasWorkout && (
                  <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-success" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Workout detail for selected day */}
      {workoutsForDate && workoutsForDate.length > 0 ? (
        <div className="space-y-3">
          {workoutsForDate.map((entry) => {
            const durationSeconds = computeDurationSeconds(entry.workout.sessionStartedAt, entry.workout.sessionEndedAt);
            const dayLabel = format(parseISO(selectedDate), "EEE d");
            const timeLabel = formatTimeOfDay(entry.workout.sessionStartedAt);
            return (
              <div key={entry.workout.id} className="rounded-2xl border border-border/30 bg-card/75 overflow-hidden shadow-e1 backdrop-blur-lg animate-fade-up">
                {/* Session header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-border/20">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm font-semibold tracking-tight">{dayLabel}</span>
                    <span className="text-muted-foreground/30 text-xs">·</span>
                    <span className="text-sm font-semibold tracking-tight">{timeLabel}</span>
                    <span className="text-[11px] text-muted-foreground/50 tabular-nums ml-1">{formatDurationLong(durationSeconds)}</span>
                  </div>
                  <button
                    onClick={() => handleCopyAsTemplate(entry.workout.id)}
                    disabled={copyingId !== null}
                    title="Copy as today's template"
                    className="flex items-center gap-1.5 rounded-full border border-primary/15 bg-primary/5 px-2.5 py-1 text-[10px] font-medium text-primary/70 hover:bg-primary/10 hover:border-primary/30 hover:text-primary active:scale-95 transition-all duration-200 ease-spring disabled:opacity-40"
                  >
                    <Dumbbell className={cn("h-3 w-3", copyingId === entry.workout.id && "animate-pulse")} />
                    Template
                  </button>
                </div>

                {/* Exercise list */}
                <div className="px-4 py-3 space-y-3">
                  {entry.items.length > 0 ? (
                    entry.items.map((exerciseEntry) => {
                      const exerciseDuration = computeDurationSeconds(
                        exerciseEntry.item.startedAt,
                        exerciseEntry.item.completedAt ?? entry.workout.sessionEndedAt
                      );
                      return (
                        <div key={exerciseEntry.item.id} className="space-y-0.5">
                          <div className="flex items-center justify-between gap-4">
                            <p className="text-sm font-medium tracking-tight text-foreground">{exerciseEntry.exercise?.name ?? "Unknown exercise"}</p>
                            <span className="text-[10px] tabular-nums text-muted-foreground/50 shrink-0">{formatDurationLong(exerciseDuration)}</span>
                          </div>
                          <p className="text-xs text-muted-foreground/60">
                            {formatCollapsedSets(collapseSetGroups(exerciseEntry.sets))}
                          </p>
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-xs text-muted-foreground/40 italic">No exercises recorded.</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-border/30 bg-card/40 backdrop-blur-sm px-6 py-10 text-center animate-fade-up">
          <Moon className="h-8 w-8 mx-auto text-muted-foreground/20 mb-3" strokeWidth={1.5} />
          <p className="text-sm font-medium text-muted-foreground/60">Rest day</p>
          <p className="text-xs text-muted-foreground/40 mt-1">No workout logged for this day.</p>
          {selectedDate === localDateIso(new Date()) && (
            <Button
              size="sm"
              className="mt-4 rounded-full px-5"
              onClick={() => router.push("/workouts")}
            >
              <Dumbbell className="h-3.5 w-3.5 mr-1.5" />
              Start Today&apos;s Workout
            </Button>
          )}
        </div>
      )}

    </div>
  );
}
