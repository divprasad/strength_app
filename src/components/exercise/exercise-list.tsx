"use client";

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { createExercise, deleteExercise } from "@/lib/repository";
import type { Exercise } from "@/types/domain";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { ExerciseForm } from "@/components/exercise/exercise-form";

export function ExerciseList() {
  const muscles = useLiveQuery(() => db.muscles.orderBy("name").toArray(), []);
  const exercises = useLiveQuery(() => db.exercises.orderBy("name").toArray(), []);
  const [editing, setEditing] = useState<Exercise | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [error, setError] = useState<string | null>(null);

  const filteredExercises = (exercises ?? []).filter((ex) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      ex.name.toLowerCase().includes(q) ||
      ex.category?.toLowerCase().includes(q) ||
      ex.equipment?.toLowerCase().includes(q)
    );
  });

  const exerciseCount = filteredExercises.length;

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

  async function handleDelete(exerciseId: string) {
    if (!confirm("Are you sure you want to delete this exercise?")) return;
    try {
      setError(null);
      await deleteExercise(exerciseId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete exercise.");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div className="relative flex-1 w-full max-w-sm">
          <Input 
            placeholder="Search exercises..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-background"
          />
        </div>
        <Button onClick={handleOpenCreate} className="shrink-0 w-full sm:w-auto">
          + New Exercise
        </Button>
      </div>

      <Card className="overflow-hidden border-none shadow-none bg-transparent">
        <CardContent className="p-0">
          <div className="flex items-center justify-between mb-3 px-1 text-sm text-muted-foreground font-medium">
            <span>{exerciseCount} exercise{exerciseCount === 1 ? "" : "s"} found</span>
          </div>
          
          {filteredExercises.length > 0 ? (
            <ul className="space-y-2">
              {filteredExercises.map((exercise) => (
                <li
                  key={exercise.id}
                  className="rounded-2xl border border-border/60 bg-card/60 hover:bg-card/80 transition-colors p-4 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between group"
                >
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <p className="font-semibold tracking-tight text-foreground truncate">{exercise.name}</p>
                    <div className="flex flex-wrap gap-1.5 items-center">
                      {exercise.category && (
                        <Badge className="bg-primary/10 text-primary border-transparent px-2 py-0 text-[10px] uppercase font-bold tracking-wider">{exercise.category}</Badge>
                      )}
                      {exercise.equipment && exercise.equipment.trim() !== "" && (
                        <Badge variant="outline" className="border-border/50 text-muted-foreground px-2 py-0 text-[10px] font-normal italic">
                          {exercise.equipment}
                        </Badge>
                      )}
                      <div className="flex flex-wrap gap-1 border-l border-border/40 pl-2 ml-1">
                        {exercise.primaryMuscleIds?.map(id => {
                          const muscle = muscles?.find(m => m.id === id);
                          return muscle ? (
                            <span key={id} className="text-[11px] font-medium text-muted-foreground bg-muted/50 px-1.5 rounded-md">
                              {muscle.name}
                            </span>
                          ) : null;
                        })}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 w-full sm:w-auto opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                    <Button size="sm" variant="secondary" className="flex-1 sm:flex-none" onClick={() => handleOpenEdit(exercise)}>
                      Edit
                    </Button>
                    <Button size="sm" variant="destructive" className="flex-1 sm:flex-none" onClick={() => handleDelete(exercise.id)}>
                      Delete
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <Card className="border-dashed bg-transparent border-border/60 shadow-none">
               <EmptyState 
                title={searchQuery ? "No matching exercises" : "No exercises yet"} 
                description={searchQuery ? "Try adjusting your search terms." : "Create your first custom movement to start logging."} 
              />
            </Card>
          )}
        </CardContent>
      </Card>

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
