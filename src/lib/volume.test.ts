import { describe, expect, it } from "vitest";
import { attributedVolumeForExercise, e1rm, setVolume } from "@/lib/volume";
import type { AppSettings, Exercise, SetEntry } from "@/types/domain";

const settings: AppSettings = {
  id: "default",
  volumePrimaryMultiplier: 1,
  volumeSecondaryMultiplier: 0.5
};

const exercise: Exercise = {
  id: "exercise_bench",
  name: "Bench Press",
  primaryMuscleIds: ["chest", "triceps"],
  secondaryMuscleIds: ["front_delts"],
  createdAt: "2026-03-20T09:00:00.000Z",
  updatedAt: "2026-03-20T09:00:00.000Z"
};

const setEntries: SetEntry[] = [
  {
    id: "set_1",
    workoutExerciseId: "workout_exercise_1",
    setNumber: 1,
    reps: 5,
    weight: 100,
    createdAt: "2026-03-20T09:10:00.000Z",
    updatedAt: "2026-03-20T09:10:00.000Z"
  },
  {
    id: "set_2",
    workoutExerciseId: "workout_exercise_1",
    setNumber: 2,
    reps: 8,
    weight: 80,
    createdAt: "2026-03-20T09:12:00.000Z",
    updatedAt: "2026-03-20T09:12:00.000Z"
  }
];

describe("volume helpers", () => {
  it("computes set volume from reps and weight", () => {
    expect(setVolume(setEntries[0])).toBe(500);
  });

  it("attributes total volume across primary and secondary muscles", () => {
    expect(attributedVolumeForExercise(exercise, setEntries, settings)).toEqual({
      total: 1140,
      byMuscle: {
        chest: 1140,
        triceps: 1140,
        front_delts: 570
      }
    });
  });

  it("returns zero e1rm for non-positive values", () => {
    expect(e1rm(0, 5)).toBe(0);
    expect(e1rm(100, 0)).toBe(0);
  });

  it("calculates the e1rm estimate for valid inputs", () => {
    expect(e1rm(100, 5)).toBeCloseTo(116.67, 2);
  });
});
