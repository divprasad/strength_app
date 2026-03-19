"use client";

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { db } from "@/lib/db";
import { createMuscleGroup } from "@/lib/repository";
import { nowIso } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const schema = z.object({
  name: z.string().trim().min(2, "Name is too short")
});

type FormValues = z.infer<typeof schema>;

export function MuscleManager() {
  const muscles = useLiveQuery(() => db.muscles.orderBy("name").toArray(), []);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Muscle Groups</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <form className="flex gap-2" onSubmit={form.handleSubmit(onSubmit)}>
          <Input placeholder="Add custom muscle group" {...form.register("name")} />
          <Button type="submit">Add</Button>
        </form>
        {form.formState.errors.name ? <p className="text-sm text-destructive">{form.formState.errors.name.message}</p> : null}

        <ul className="space-y-2">
          {(muscles ?? []).map((muscle) => (
            <li key={muscle.id} className="flex items-center gap-2 rounded-lg border p-2">
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
                    variant="ghost"
                    onClick={() => {
                      setEditingId(muscle.id);
                      setEditingName(muscle.name);
                    }}
                  >
                    Edit
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => db.muscles.delete(muscle.id)}>
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
