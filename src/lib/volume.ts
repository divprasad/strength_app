import type { AppSettings, Exercise, SetEntry } from "@/types/domain";

export interface VolumeAttribution {
  total: number;
  byMuscle: Record<string, number>;
}

export function setVolume(setEntry: SetEntry): number {
  return setEntry.reps * setEntry.weight;
}

export function attributedVolumeForExercise(
  exercise: Exercise,
  setEntries: SetEntry[],
  settings: AppSettings
): VolumeAttribution {
  const total = setEntries.reduce((sum, setEntry) => sum + setVolume(setEntry), 0);
  const byMuscle: Record<string, number> = {};

  for (const muscleId of exercise.primaryMuscleIds) {
    byMuscle[muscleId] = (byMuscle[muscleId] ?? 0) + total * settings.volumePrimaryMultiplier;
  }

  for (const muscleId of exercise.secondaryMuscleIds) {
    byMuscle[muscleId] = (byMuscle[muscleId] ?? 0) + total * settings.volumeSecondaryMultiplier;
  }

  return { total, byMuscle };
}

export function e1rm(weight: number, reps: number): number {
  if (weight <= 0 || reps <= 0) return 0;
  return weight * (1 + reps / 30);
}
