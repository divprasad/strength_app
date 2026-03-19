"use client";

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { createExercise } from "@/lib/repository";
import type { Exercise } from "@/types/domain";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ExerciseForm } from "@/components/exercise/exercise-form";

export function ExerciseList() {
  const muscles = useLiveQuery(() => db.muscles.orderBy("name").toArray(), []);
  const exercises = useLiveQuery(() => db.exercises.orderBy("name").toArray(), []);
  const [editing, setEditing] = useState<Exercise | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate(payload: Omit<Exercise, "id" | "createdAt" | "updatedAt">) {
    try {
      setError(null);
      await createExercise(payload);
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
      setEditing(null);
    } catch {
      setError("Unable to update exercise.");
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>{editing ? `Edit ${editing.name}` : "Create Exercise"}</CardTitle>
        </CardHeader>
        <CardContent>
          {muscles ? (
            <ExerciseForm
              muscles={muscles}
              initial={editing ?? undefined}
              onSubmit={(payload) => (editing ? handleEdit(payload as Exercise) : handleCreate(payload as Omit<Exercise, "id" | "createdAt" | "updatedAt">))}
              onCancel={editing ? () => setEditing(null) : undefined}
            />
          ) : null}
          {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Exercise Library</CardTitle>
        </CardHeader>
        <CardContent>
          {exercises && exercises.length > 0 ? (
            <ul className="space-y-2">
              {exercises.map((exercise) => (
                <li key={exercise.id} className="rounded-lg border p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <p className="font-medium">{exercise.name}</p>
                      <div className="flex flex-wrap gap-1">
                        {exercise.category ? <Badge>{exercise.category}</Badge> : null}
                        {exercise.equipment ? <Badge>{exercise.equipment}</Badge> : null}
                      </div>
                      {exercise.notes ? <p className="text-sm text-muted-foreground">{exercise.notes}</p> : null}
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="ghost" onClick={() => setEditing(exercise)}>
                        Edit
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => db.exercises.delete(exercise.id)}>
                        Delete
                      </Button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="No exercises yet" description="Create your first custom movement to start logging." />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
