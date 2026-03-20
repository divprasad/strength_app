"use client";

import { addWeeks, eachDayOfInterval, endOfWeek, format, parseISO, startOfWeek, subWeeks } from "date-fns";
import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { db } from "@/lib/db";
import { localDateIso } from "@/lib/utils";
import { PageIntro } from "@/components/layout/page-intro";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import type { MuscleGroup } from "@/types/domain";
import { computeDurationSeconds, formatDurationLong, formatTimeOfDay, muscleTimeSummary } from "@/lib/time";

export function WeeklyHistory() {
  const [anchorDate, setAnchorDate] = useState(localDateIso(new Date()));
  const [selectedDate, setSelectedDate] = useState(localDateIso(new Date()));

  const weekStart = startOfWeek(parseISO(anchorDate), { weekStartsOn: 1 });
  const weekEnd = endOfWeek(parseISO(anchorDate), { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const workouts = useLiveQuery(
    () => db.workouts.where("date").between(format(weekStart, "yyyy-MM-dd"), format(weekEnd, "yyyy-MM-dd"), true, true).toArray(),
    [anchorDate]
  );

  const muscleGroups = useLiveQuery(() => db.muscles.orderBy("name").toArray(), []);
  const muscleMap = useMemo(() => {
    const map = new Map<string, MuscleGroup>();
    (muscleGroups ?? []).forEach((muscle) => map.set(muscle.id, muscle));
    return map;
  }, [muscleGroups]);

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
            <div className="space-y-4">
              {workoutsForDate.map((entry, index) => {
                const durationSeconds = computeDurationSeconds(entry.workout.sessionStartedAt, entry.workout.sessionEndedAt);
                return (
                  <Card key={entry.workout.id} className="overflow-hidden border-white/50 bg-card/92">
                    <CardHeader className="border-b border-border/70 pb-4">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge className="bg-accent px-3 py-1 text-accent-foreground">Workout #{index + 1}</Badge>
                          <Badge>{entry.workout.status}</Badge>
                        </div>
                        <CardTitle className="text-2xl">
                          {formatTimeOfDay(entry.workout.sessionStartedAt)} · {formatDurationLong(durationSeconds)}
                        </CardTitle>
                        <p className="text-xs text-muted-foreground">
                          {entry.workout.status === "completed"
                            ? `Completed · ${formatDurationLong(durationSeconds)}`
                            : entry.workout.status === "active"
                              ? "In progress"
                              : "Draft"}
                        </p>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3 pt-5">
                      {entry.items.length > 0 ? (
                        entry.items.map((exerciseEntry) => {
                          const exerciseDuration = computeDurationSeconds(
                            exerciseEntry.item.startedAt,
                            exerciseEntry.item.completedAt ?? entry.workout.sessionEndedAt
                          );
                          const muscleTimes = exerciseEntry.exercise
                            ? muscleTimeSummary(exerciseEntry.exercise, exerciseDuration, muscleMap)
                            : [];
                          return (
                            <div
                              key={exerciseEntry.item.id}
                              className="rounded-[1.3rem] border border-border/70 bg-background/60 p-4 shadow-[inset_0_1px_0_hsl(0_0%_100%/0.42)]"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <p className="font-medium">{exerciseEntry.exercise?.name ?? "Unknown exercise"}</p>
                                <span className="text-xs text-muted-foreground">{formatDurationLong(exerciseDuration)}</span>
                              </div>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {exerciseEntry.sets.length} set{exerciseEntry.sets.length === 1 ? "" : "s"}
                              </p>
                              {muscleTimes.length > 0 && (
                                <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                                  {muscleTimes.map((muscle) => (
                                    <span key={muscle.muscleId} className="rounded-full border border-border/70 px-2.5 py-1">
                                      {muscle.name} · {formatDurationLong(muscle.seconds)} ({muscle.tags.join(", ")})
                                    </span>
                                  ))}
                                </div>
                              )}
                              <ul className="mt-3 space-y-2 text-sm">
                                {exerciseEntry.sets.map((setEntry) => (
                                  <li
                                    key={setEntry.id}
                                    className="rounded-[1rem] border border-border/65 bg-card/85 px-3 py-2 shadow-[0_12px_30px_-28px_hsl(var(--foreground)/0.4)]"
                                  >
                                    Set {setEntry.setNumber}: {setEntry.reps} reps × {setEntry.weight}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          );
                        })
                      ) : (
                        <p className="text-sm text-muted-foreground">Workout exists but has no exercises.</p>
                      )}
                    </CardContent>
                  </Card>
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
