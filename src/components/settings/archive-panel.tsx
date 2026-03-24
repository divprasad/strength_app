"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { format, parseISO } from "date-fns";
import { ArchiveRestore, Trash2 } from "lucide-react";
import { db } from "@/lib/db";
import { restoreWorkout, deleteWorkout } from "@/lib/repository";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";

export function ArchivePanel() {
  const archivedWorkouts = useLiveQuery(
    () => db.workouts.filter(w => w.status === "archived").sortBy("updatedAt"),
    []
  );

  const count = archivedWorkouts?.length ?? 0;

  async function handleRestore(id: string) {
    await restoreWorkout(id);
  }

  async function handleDelete(id: string) {
    if (window.confirm("This action cannot be undone. Are you sure you want to permanently delete this workout and all its data?")) {
      await deleteWorkout(id);
    }
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-4">
        <CardTitle>Archived Workouts</CardTitle>
        <CardDescription>
          {count} workout{count === 1 ? "" : "s"} hidden from your history and analytics. You can restore them or delete them permanently.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {archivedWorkouts && archivedWorkouts.length > 0 ? (
          <ul className="space-y-3">
            {archivedWorkouts.reverse().map((workout) => (
              <li
                key={workout.id}
                className="flex items-center justify-between gap-3 rounded-[1.3rem] border border-border/70 bg-background/58 p-4 shadow-[inset_0_1px_0_hsl(0_0%_100%/0.4)]"
              >
                <div className="min-w-0">
                  <p className="font-medium">{workout.name || workout.date}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Logged: {format(parseISO(workout.sessionEndedAt ?? workout.sessionStartedAt ?? workout.createdAt), "PPp")}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="hover:bg-accent/80 hover:text-accent-foreground border border-border/70"
                    title="Restore Workout"
                    onClick={() => handleRestore(workout.id)}
                  >
                    <ArchiveRestore className="mr-2 h-4 w-4" />
                    Restore
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    title="Permanently Delete Workout"
                    onClick={() => handleDelete(workout.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            title="No archived workouts"
            description="Workouts you archive from the dashboard will appear here."
          />
        )}
      </CardContent>
    </Card>
  );
}
