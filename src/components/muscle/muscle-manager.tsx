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
import { Input } from "@/components/ui/input";
import { Edit2, Plus } from "lucide-react";

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

  const muscleCount = muscles?.length ?? 0;

  return (
    <div className="space-y-4">
      <form className="flex gap-2" onSubmit={form.handleSubmit(onSubmit)}>
        <Input
          placeholder="Add muscle group..."
          {...form.register("name")}
          className="flex-1 rounded-xl bg-background/80 border-border/50"
        />
        <Button type="submit" size="sm" className="shrink-0 rounded-xl px-4">
          <Plus className="h-4 w-4 mr-1" />
          Add
        </Button>
      </form>
      {form.formState.errors.name ? (
        <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
      ) : null}

      <p className="text-xs text-muted-foreground px-1">
        {muscleCount} muscle group{muscleCount === 1 ? "" : "s"}
      </p>

      <ul className="grid gap-2">
        {(muscles ?? []).map((muscle) => (
          <li
            key={muscle.id}
            className="group rounded-2xl border border-border/50 bg-card/60 hover:bg-card/90 transition-all p-3.5 px-4"
          >
            {editingId === muscle.id ? (
              <div className="flex items-center gap-2">
                <Input
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  className="h-8 flex-1 rounded-lg text-sm"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") { e.preventDefault(); saveEdit(muscle.id); }
                    if (e.key === "Escape") setEditingId(null);
                  }}
                />
                <Button size="sm" className="h-8 rounded-lg px-3 text-xs" onClick={() => saveEdit(muscle.id)}>
                  Save
                </Button>
                <Button size="sm" variant="ghost" className="h-8 rounded-lg px-3 text-xs" onClick={() => setEditingId(null)}>
                  Cancel
                </Button>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-foreground">{muscle.name}</p>
                <button
                  onClick={() => {
                    setEditingId(muscle.id);
                    setEditingName(muscle.name);
                  }}
                  className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md hover:bg-muted"
                  title="Edit muscle group"
                >
                  <Edit2 className="h-3 w-3 text-muted-foreground" />
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
