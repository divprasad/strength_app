import { describe, expect, it } from "vitest";
import { payloadToCsvMap, payloadToJson } from "@/lib/export";
import type { ExportPayload } from "@/types/domain";

const payload: ExportPayload = {
  exportedAt: "2026-03-20T10:00:00.000Z",
  version: "1",
  settings: {
    id: "default",
    volumePrimaryMultiplier: 1,
    volumeSecondaryMultiplier: 0.5
  },
  muscleGroups: [
    {
      id: "muscle_1",
      name: 'Chest, "Upper"',
      createdAt: "2026-03-20T09:00:00.000Z",
      updatedAt: "2026-03-20T09:00:00.000Z"
    }
  ],
  exercises: [
    {
      id: "exercise_1",
      name: "Incline Press",
      category: "push",
      equipment: "barbell",
      primaryMuscleIds: ["muscle_1"],
      secondaryMuscleIds: ["muscle_2"],
      notes: "Line 1\nLine 2",
      createdAt: "2026-03-20T09:05:00.000Z",
      updatedAt: "2026-03-20T09:05:00.000Z"
    }
  ],
  workouts: [
    {
      id: "workout_1",
      date: "2026-03-20",
      status: "completed",
      notes: 'Felt "strong"',
      createdAt: "2026-03-20T09:00:00.000Z",
      updatedAt: "2026-03-20T09:45:00.000Z"
    }
  ],
  workoutExercises: [
    {
      id: "workout_exercise_1",
      workoutId: "workout_1",
      exerciseId: "exercise_1",
      orderIndex: 0,
      createdAt: "2026-03-20T09:10:00.000Z"
    }
  ],
  setEntries: [
    {
      id: "set_1",
      workoutExerciseId: "workout_exercise_1",
      setNumber: 1,
      reps: 8,
      weight: 80,
      notes: "Paused, controlled",
      createdAt: "2026-03-20T09:15:00.000Z",
      updatedAt: "2026-03-20T09:15:00.000Z"
    }
  ]
};

describe("export helpers", () => {
  it("serializes the full payload as formatted JSON", () => {
    expect(JSON.parse(payloadToJson(payload))).toEqual(payload);
  });

  it("returns a CSV document for each export section", () => {
    expect(Object.keys(payloadToCsvMap(payload)).sort()).toEqual([
      "exercises",
      "muscle_groups",
      "set_entries",
      "workout_exercises",
      "workouts"
    ]);
  });

  it("escapes commas, quotes, and newlines in CSV output", () => {
    const csvMap = payloadToCsvMap(payload);

    expect(csvMap.muscle_groups).toContain('"Chest, ""Upper"""');
    expect(csvMap.exercises).toContain('"Line 1\nLine 2"');
    expect(csvMap.workouts).toContain('"Felt ""strong"""');
    expect(csvMap.set_entries).toContain("Paused, controlled");
  });
});
