"use client";

import { useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { Exercise, MuscleGroup } from "@/types/domain";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { nowIso } from "@/lib/utils";

const schema = z.object({
  name: z.string().trim().min(2),
  category: z.string().trim().optional(),
  equipment: z.string().trim().optional(),
  primaryMuscleIds: z.array(z.string()).min(1, "Choose at least one primary muscle"),
  secondaryMuscleIds: z.array(z.string()).optional(),
  notes: z.string().trim().optional()
});

type FormValues = z.infer<typeof schema>;

interface ExerciseFormProps {
  muscles: MuscleGroup[];
  initial?: Exercise;
  onSubmit: (payload: Omit<Exercise, "id" | "createdAt" | "updatedAt"> | Exercise) => Promise<void>;
  onCancel?: () => void;
}

export function ExerciseForm({ muscles, initial, onSubmit, onCancel }: ExerciseFormProps) {
  const defaults: FormValues = useMemo(
    () => ({
      name: initial?.name ?? "",
      category: initial?.category ?? "",
      equipment: initial?.equipment ?? "",
      primaryMuscleIds: initial?.primaryMuscleIds ?? [],
      secondaryMuscleIds: initial?.secondaryMuscleIds ?? [],
      notes: initial?.notes ?? ""
    }),
    [initial]
  );

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    values: defaults
  });

  function applyValidationIssues(error: unknown) {
    if (!(error instanceof z.ZodError)) {
      form.setError("root", { message: error instanceof Error ? error.message : "Unable to save exercise." });
      return;
    }

    for (const issue of error.issues) {
      const field = issue.path[0];
      if (field === "name" || field === "primaryMuscleIds" || field === "secondaryMuscleIds" || field === "notes" || field === "category" || field === "equipment") {
        form.setError(field, { message: issue.message });
      }
    }
  }

  async function submit(values: FormValues) {
    const payload = {
      name: values.name.trim(),
      category: values.category?.trim() || undefined,
      equipment: values.equipment?.trim() || undefined,
      primaryMuscleIds: values.primaryMuscleIds,
      secondaryMuscleIds: values.secondaryMuscleIds ?? [],
      notes: values.notes?.trim() || undefined
    };

    if (initial) {
      await onSubmit({
        ...initial,
        ...payload,
        updatedAt: nowIso()
      });
      return;
    }

    await onSubmit(payload);
    form.reset({
      name: "",
      category: "",
      equipment: "",
      primaryMuscleIds: [],
      secondaryMuscleIds: [],
      notes: ""
    });
  }

  const handleValidSubmit = form.handleSubmit(
    async (values) => {
      form.clearErrors("root");
      try {
        await submit(values);
      } catch (error) {
        applyValidationIssues(error);
      }
    },
    (errors) => {
      form.clearErrors("root");
      if (errors.name || errors.primaryMuscleIds) {
        return;
      }
      form.setError("root", { message: "Fix the highlighted fields and try again." });
    }
  );

  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        void handleValidSubmit(event).catch((error: unknown) => {
          applyValidationIssues(error);
        });
      }}
    >
      <div>
        <Label htmlFor="name">Name</Label>
        <Input id="name" placeholder="Incline Dumbbell Press" {...form.register("name")} />
        {form.formState.errors.name ? <p className="mt-1 text-sm text-destructive">{form.formState.errors.name.message}</p> : null}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="category">Category</Label>
          <Input id="category" placeholder="Push" {...form.register("category")} />
        </div>
        <div>
          <Label htmlFor="equipment">Equipment</Label>
          <Input id="equipment" placeholder="Dumbbell" {...form.register("equipment")} />
        </div>
      </div>

      <div>
        <Label>Primary Muscles</Label>
        <div className="grid grid-cols-2 gap-2 rounded-lg border p-3">
          {muscles.map((muscle) => (
            <label key={muscle.id} className="flex items-center gap-2 text-sm">
              <input type="checkbox" value={muscle.id} {...form.register("primaryMuscleIds")} />
              {muscle.name}
            </label>
          ))}
        </div>
        {form.formState.errors.primaryMuscleIds ? (
          <p className="mt-1 text-sm text-destructive">{form.formState.errors.primaryMuscleIds.message}</p>
        ) : null}
      </div>

      <div>
        <Label>Secondary Muscles</Label>
        <div className="grid grid-cols-2 gap-2 rounded-lg border p-3">
          {muscles.map((muscle) => (
            <label key={`${muscle.id}-secondary`} className="flex items-center gap-2 text-sm">
              <input type="checkbox" value={muscle.id} {...form.register("secondaryMuscleIds")} />
              {muscle.name}
            </label>
          ))}
        </div>
      </div>

      <div>
        <Label htmlFor="notes">Notes</Label>
        <Textarea id="notes" placeholder="Optional cues" {...form.register("notes")} />
      </div>

      <div className="flex gap-2">
        <Button type="submit">{initial ? "Save Changes" : "Create Exercise"}</Button>
        {onCancel ? (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
      </div>
      {form.formState.errors.root ? <p className="text-sm text-destructive">{form.formState.errors.root.message}</p> : null}
    </form>
  );
}
