"use client";

import { addWeeks, eachDayOfInterval, endOfWeek, format, parseISO, startOfWeek, subWeeks } from "date-fns";
import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { localDateIso } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";

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

  const selectedWorkout = workouts?.find((w) => w.date === selectedDate);
  const selectedItems = useLiveQuery(async () => {
    if (!selectedWorkout) return [];
    const items = await db.workoutExercises.where("workoutId").equals(selectedWorkout.id).sortBy("orderIndex");
    return Promise.all(
      items.map(async (item) => {
        const exercise = await db.exercises.get(item.exerciseId);
        const sets = await db.setEntries.where("workoutExerciseId").equals(item.id).sortBy("setNumber");
        return { item, exercise, sets };
      })
    );
  }, [selectedWorkout?.id]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Week View</CardTitle>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => setAnchorDate(localDateIso(subWeeks(parseISO(anchorDate), 1)))}>
              Previous
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setAnchorDate(localDateIso(addWeeks(parseISO(anchorDate), 1)))}>
              Next
            </Button>
          </div>
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
                  className={`rounded-lg border p-2 text-center text-sm ${selected ? "border-primary bg-accent" : ""}`}
                >
                  <p className="text-xs text-muted-foreground">{format(date, "EEE")}</p>
                  <p className="font-semibold">{format(date, "d")}</p>
                  <p className="text-[11px]">{hasWorkout ? "Logged" : "-"}</p>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{format(parseISO(selectedDate), "EEEE, MMM d")}</CardTitle>
        </CardHeader>
        <CardContent>
          {selectedWorkout ? (
            selectedItems && selectedItems.length > 0 ? (
              <div className="space-y-3">
                {selectedItems.map((entry) => (
                  <div key={entry.item.id} className="rounded-lg border p-3">
                    <p className="font-medium">{entry.exercise?.name ?? "Unknown exercise"}</p>
                    <p className="text-sm text-muted-foreground">
                      {entry.sets.length} set{entry.sets.length === 1 ? "" : "s"}
                    </p>
                    <ul className="mt-2 space-y-1 text-sm">
                      {entry.sets.map((setEntry) => (
                        <li key={setEntry.id}>
                          Set {setEntry.setNumber}: {setEntry.reps} reps × {setEntry.weight}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Workout exists but has no exercises.</p>
            )
          ) : (
            <EmptyState title="No workout on this day" description="Tap another day to browse your history." />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
