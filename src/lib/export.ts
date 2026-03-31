import { csvEscape } from "@/lib/utils";
import type { ExportPayload } from "@/types/domain";

export function payloadToJson(payload: ExportPayload): string {
  return JSON.stringify(payload, null, 2);
}

export function payloadToCsvMap(payload: ExportPayload): Record<string, string> {
  return {
    muscleGroups: toCsv(
      ["id", "name", "createdAt", "updatedAt"],
      payload.muscleGroups.map((m) => [m.id, m.name, m.createdAt, m.updatedAt])
    ),
    exercises: toCsv(
      [
        "id",
        "name",
        "category",
        "equipment",
        "primaryMuscleIds",
        "secondaryMuscleIds",
        "notes",
        "createdAt",
        "updatedAt"
      ],
      payload.exercises.map((e) => [
        e.id,
        e.name,
        e.category ?? "",
        e.equipment ?? "",
        e.primaryMuscleIds.join("|"),
        e.secondaryMuscleIds.join("|"),
        e.notes ?? "",
        e.createdAt,
        e.updatedAt
      ])
    ),
    workouts: toCsv(
      ["id", "date", "status", "notes", "createdAt", "updatedAt"],
      payload.workouts.map((w) => [w.id, w.date, w.status, w.notes ?? "", w.createdAt, w.updatedAt])
    ),
    workoutExercises: toCsv(
      ["id", "workoutId", "exerciseId", "orderIndex", "createdAt"],
      payload.workoutExercises.map((we) => [we.id, we.workoutId, we.exerciseId, we.orderIndex, we.createdAt])
    ),
    setEntries: toCsv(
      ["id", "workoutExerciseId", "setNumber", "reps", "weight", "notes", "createdAt", "updatedAt"],
      payload.setEntries.map((s) => [s.id, s.workoutExerciseId, s.setNumber, s.reps, s.weight, s.notes ?? "", s.createdAt, s.updatedAt])
    )
  };
}

function toCsv(headers: string[], rows: Array<Array<string | number | undefined>>): string {
  const headerLine = headers.map(csvEscape).join(",");
  const rowLines = rows.map((row) => row.map(csvEscape).join(","));
  return [headerLine, ...rowLines].join("\n");
}
