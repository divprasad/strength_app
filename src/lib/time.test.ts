import { describe, expect, it } from "vitest";
import { computeDurationSeconds, formatDurationLong, muscleTimeSummary } from "@/lib/time";
import type { Exercise, MuscleGroup } from "@/types/domain";

const exercise: Exercise = {
  id: "exercise_1",
  name: "Overhead Press",
  primaryMuscleIds: ["shoulders"],
  secondaryMuscleIds: ["triceps", "shoulders"],
  createdAt: "2026-03-20T09:00:00.000Z",
  updatedAt: "2026-03-20T09:00:00.000Z"
};

const muscles = new Map<string, MuscleGroup>([
  [
    "shoulders",
    {
      id: "shoulders",
      name: "Shoulders",
      createdAt: "2026-03-20T09:00:00.000Z",
      updatedAt: "2026-03-20T09:00:00.000Z"
    }
  ]
]);

describe("time helpers", () => {
  it("returns zero for missing, invalid, or reversed durations", () => {
    expect(computeDurationSeconds()).toBe(0);
    expect(computeDurationSeconds("not-a-date", "2026-03-20T10:00:00.000Z")).toBe(0);
    expect(computeDurationSeconds("2026-03-20T10:00:00.000Z", "2026-03-20T09:59:00.000Z")).toBe(0);
  });

  it("returns the duration in seconds for valid timestamps", () => {
    expect(computeDurationSeconds("2026-03-20T10:00:00.000Z", "2026-03-20T10:05:30.000Z")).toBe(330);
  });

  it("formats durations across seconds, minutes, and hours", () => {
    expect(formatDurationLong(5)).toBe("5s");
    expect(formatDurationLong(65)).toBe("1m 5s");
    expect(formatDurationLong(3665)).toBe("1h 1m 5s");
  });

  it("summarizes muscle time with rounding, ordering, and combined tags", () => {
    expect(muscleTimeSummary(exercise, 101, muscles)).toEqual([
      {
        muscleId: "shoulders",
        name: "Shoulders",
        seconds: 152,
        tags: ["primary", "secondary"]
      },
      {
        muscleId: "triceps",
        name: "Unknown muscle",
        seconds: 51,
        tags: ["secondary"]
      }
    ]);
  });
});
