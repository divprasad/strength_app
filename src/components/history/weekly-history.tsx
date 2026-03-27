"use client";

import { addWeeks, eachDayOfInterval, endOfWeek, format, parseISO, startOfWeek, subWeeks } from "date-fns";
import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { db } from "@/lib/db";
import { localDateIso } from "@/lib/utils";
import { PageIntro } from "@/components/layout/page-intro";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { computeDurationSeconds, formatDurationLong, formatTimeOfDay } from "@/lib/time";

export function WeeklyHistory() {
  const [anchorDate, setAnchorDate] = useState(localDateIso(new Date()));
  const [selectedDate, setSelectedDate] = useState(localDateIso(new Date()));

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
        eyebrow="Training Archive"
        title="History"
        description="Browse completed sessions by week, drill into each workout, and review set-level detail without changing the underlying logging flow."
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
          <CardDescription>Tap a day to load the recorded sessions for that date.</CardDescription>
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
          <CardDescription>Sessions are ordered by their recorded start time for the selected day.</CardDescription>
        </CardHeader>
        <CardContent>
          {workoutsForDate && workoutsForDate.length > 0 ? (
            <div className="space-y-3">
              {workoutsForDate.map((entry, index) => {
                const durationSeconds = computeDurationSeconds(entry.workout.sessionStartedAt, entry.workout.sessionEndedAt);
                return (
                  <div key={entry.workout.id} className="overflow-hidden rounded-[1.4rem] border border-border/60 bg-background/55 p-4 shadow-[0_12px_36px_-32px_hsl(var(--foreground)/0.5)]">
                    <div className="flex items-center justify-between border-b border-border/50 pb-3">
                      <div className="flex items-center gap-3">
                        <span className="text-[0.7rem] font-bold uppercase tracking-[0.14em] text-primary/70">Session {index + 1}</span>
                        <div className="h-4 w-px bg-border/50" />
                        <span className="text-sm font-semibold tracking-tight">
                          {formatTimeOfDay(entry.workout.sessionStartedAt)} · {formatDurationLong(durationSeconds)}
                        </span>
                      </div>
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
                              
                              <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                                {exerciseEntry.sets.map((setEntry) => (
                                  <li
                                    key={setEntry.id}
                                    className="flex items-center gap-2 rounded-lg border border-border/40 bg-card/40 px-3 py-1.5 text-xs text-muted-foreground"
                                  >
                                    <span className="font-semibold text-primary/70">#{setEntry.setNumber}</span>
                                    <span>{setEntry.reps} reps × {setEntry.weight}kg</span>
                                  </li>
                                ))}
                              </ul>
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
            <EmptyState title="No workout on this day" description="Tap another day to browse your history." />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
