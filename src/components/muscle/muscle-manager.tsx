"use client";

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { db } from "@/lib/db";
import { createMuscleGroup, deleteMuscleGroup } from "@/lib/repository";
import { nowIso } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const schema = z.object({
  name: z.string().trim().min(2, "Name is too short")
});

type FormValues = z.infer<typeof schema>;

export function MuscleManager() {
  const muscles = useLiveQuery(() => db.muscles.orderBy("name").toArray(), []);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "" }
  });

  async function onSubmit(values: FormValues) {
    const duplicate = await db.muscles.where("name").equalsIgnoreCase(values.name).first();
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
    const duplicate = await db.muscles
      .where("name")
      .equalsIgnoreCase(normalized)
      .and((m) => m.id !== id)
      .first();
    if (duplicate) return;

    await db.muscles.update(id, { name: normalized, updatedAt: nowIso() });
    setEditingId(null);
    setEditingName("");
  }

  async function handleDelete(id: string) {
    try {
      setDeleteError(null);
      await deleteMuscleGroup(id);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Unable to delete muscle group.");
    }
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-4">
        <CardTitle>Muscle Groups</CardTitle>
        <CardDescription>Maintain the muscle taxonomy used in exercise setup, timing, and analytics.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form className="flex gap-2" onSubmit={form.handleSubmit(onSubmit)}>
          <Input placeholder="Add custom muscle group" {...form.register("name")} />
          <Button type="submit">Add</Button>
        </form>
        {form.formState.errors.name ? <p className="text-sm text-destructive">{form.formState.errors.name.message}</p> : null}
        {deleteError ? <p className="text-sm text-destructive">{deleteError}</p> : null}

        <ul className="space-y-2">
          {(muscles ?? []).map((muscle) => (
            <li
              key={muscle.id}
              className="flex items-center gap-2 rounded-[1.1rem] border border-border/70 bg-background/58 p-3 shadow-[inset_0_1px_0_hsl(0_0%_100%/0.4)]"
            >
              {editingId === muscle.id ? (
                <>
                  <Input value={editingName} onChange={(e) => setEditingName(e.target.value)} className="h-9" />
                  <Button size="sm" onClick={() => saveEdit(muscle.id)}>
                    Save
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                    Cancel
                  </Button>
                </>
              ) : (
                <>
                  <p className="flex-1 text-sm">{muscle.name}</p>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setEditingId(muscle.id);
                      setEditingName(muscle.name);
                    }}
                  >
                    Edit
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => handleDelete(muscle.id)}>
                    Delete
                  </Button>
                </>
              )}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
