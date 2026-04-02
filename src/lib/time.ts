import { format, parseISO } from "date-fns";
import type { Exercise, MuscleGroup } from "@/types/domain";

export function computeDurationSeconds(start?: string, end?: string): number {
  if (!start) return 0;
  const startMs = Date.parse(start);
  if (Number.isNaN(startMs)) return 0;
  const endMs = end ? Date.parse(end) : Date.now();
  if (Number.isNaN(endMs)) return 0;
  return Math.max(0, Math.floor((endMs - startMs) / 1000));
}

export function formatDurationLong(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const parts = [];
  if (hours) parts.push(`${hours}h`);
  if (minutes) parts.push(`${minutes}m`);
  if (!parts.length || seconds) parts.push(`${seconds}s`);
  return parts.join(" ");
}

export function formatDurationRounded(totalSeconds: number): string {
  const minutes = Math.round(totalSeconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

export function formatTimeOfDay(iso?: string) {
  if (!iso) return "—";
  const parsed = parseISO(iso);
  if (Number.isNaN(parsed.getTime())) return "—";
  return format(parsed, "p");
}

export type MuscleTimeEntry = {
  muscleId: string;
  name: string;
  seconds: number;
  tags: Array<"primary" | "secondary">;
};

export function muscleTimeSummary(
  exercise: Exercise,
  durationSeconds: number,
  muscles: Map<string, MuscleGroup>
): MuscleTimeEntry[] {
  if (!durationSeconds || !exercise) return [];
  const contributions = new Map<string, { seconds: number; tags: Set<"primary" | "secondary"> }>();

  const add = (muscleId: string, multiplier: number, tag: "primary" | "secondary") => {
    if (!muscleId) return;
    const seconds = durationSeconds * multiplier;
    const current = contributions.get(muscleId);
    if (current) {
      current.seconds += seconds;
      current.tags.add(tag);
      return;
    }
    contributions.set(muscleId, { seconds, tags: new Set([tag]) });
  };

  exercise.primaryMuscleIds.forEach((id) => add(id, 1, "primary"));
  exercise.secondaryMuscleIds.forEach((id) => add(id, 0.5, "secondary"));

  return Array.from(contributions.entries())
    .map(([muscleId, data]) => ({
      muscleId,
      name: muscles.get(muscleId)?.name ?? "Unknown muscle",
      seconds: Math.round(data.seconds),
      tags: Array.from(data.tags)
    }))
    .filter((entry) => entry.seconds > 0)
    .sort((a, b) => b.seconds - a.seconds);
}
