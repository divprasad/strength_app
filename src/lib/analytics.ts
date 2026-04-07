import { eachDayOfInterval, endOfWeek, format, parseISO, startOfWeek, subDays, subWeeks } from "date-fns";
import { db } from "@/lib/db";
import { attributedVolumeForExercise, e1rm } from "@/lib/volume";
import type { AppSettings } from "@/types/domain";

export interface WeeklyMetrics {
  totalVolume: number;
  byExercise: Record<string, number>;
  byMuscle: Record<string, number>;
  perDay: { date: string; volume: number }[];
}

export interface ExerciseProgressPoint {
  date: string;
  maxWeight: number;
  totalVolume: number;
  bestE1rm: number;
}

export async function getWeeklyMetrics(anchorDateIso: string): Promise<WeeklyMetrics> {
  const start = startOfWeek(parseISO(anchorDateIso), { weekStartsOn: 1 });
  const end = endOfWeek(parseISO(anchorDateIso), { weekStartsOn: 1 });

  return db.transaction("r", [db.workouts, db.workoutExercises, db.exercises, db.setEntries, db.settings], async () => {
    const allWorkouts = await db.workouts.where("date").between(format(start, "yyyy-MM-dd"), format(end, "yyyy-MM-dd"), true, true).toArray();
    const workouts = allWorkouts.filter(w => w.status !== "archived");
    const settings =
      (await db.settings.get("default")) ??
      ({ id: "default", volumePrimaryMultiplier: 1, volumeSecondaryMultiplier: 0.5 } as AppSettings);

    const byExercise: Record<string, number> = {};
    const byMuscle: Record<string, number> = {};
    const perDay = eachDayOfInterval({ start, end }).map((date) => ({
      date: format(date, "yyyy-MM-dd"),
      volume: 0
    }));

    for (const workout of workouts) {
      const day = perDay.find((d) => d.date === workout.date);
      const workoutExercises = await db.workoutExercises.where("workoutId").equals(workout.id).toArray();

      for (const item of workoutExercises) {
        const exercise = await db.exercises.get(item.exerciseId);
        if (!exercise) continue;

        const sets = await db.setEntries.where("workoutExerciseId").equals(item.id).toArray();
        const attribution = attributedVolumeForExercise(exercise, sets, settings);

        byExercise[exercise.name] = (byExercise[exercise.name] ?? 0) + attribution.total;
        if (day) {
          day.volume += attribution.total;
        }

        for (const [muscleId, volume] of Object.entries(attribution.byMuscle)) {
          byMuscle[muscleId] = (byMuscle[muscleId] ?? 0) + volume;
        }
      }
    }

    const totalVolume = Object.values(byExercise).reduce((sum, value) => sum + value, 0);

    return { totalVolume, byExercise, byMuscle, perDay };
  });
}

export async function getExerciseProgress(exerciseId: string, weeksBack = 12): Promise<ExerciseProgressPoint[]> {
  const today = new Date();
  const start = startOfWeek(subWeeks(today, weeksBack), { weekStartsOn: 1 });

  return db.transaction("r", [db.workouts, db.workoutExercises, db.setEntries], async () => {
    const allWorkouts = await db.workouts.where("date").aboveOrEqual(format(start, "yyyy-MM-dd")).toArray();
    const workouts = allWorkouts.filter(w => w.status !== "archived");
    const points: ExerciseProgressPoint[] = [];

    for (const workout of workouts) {
      const items = await db.workoutExercises.where("workoutId").equals(workout.id).and((item) => item.exerciseId === exerciseId).toArray();
      if (items.length === 0) continue;

      let maxWeight = 0;
      let totalVolume = 0;
      let bestE1rm = 0;

      for (const item of items) {
        const sets = await db.setEntries.where("workoutExerciseId").equals(item.id).toArray();
        for (const setEntry of sets) {
          maxWeight = Math.max(maxWeight, setEntry.weight);
          totalVolume += setEntry.weight * setEntry.reps;
          bestE1rm = Math.max(bestE1rm, e1rm(setEntry.weight, setEntry.reps));
        }
      }

      points.push({
        date: workout.date,
        maxWeight,
        totalVolume,
        bestE1rm: Number(bestE1rm.toFixed(1))
      });
    }

    return points.sort((a, b) => a.date.localeCompare(b.date));
  });
}
/** @deprecated use getBillingPeriodSummary */
export const get28DaySummary = () => getBillingPeriodSummary();

export async function getBillingPeriodSummary(): Promise<{
  completedCount: number;
  totalVolume: number;
  weeklyVolumes: number[];
  periodDays: number;
  weekCount: number;
}> {
  return db.transaction("r", [db.workouts, db.workoutExercises, db.exercises, db.setEntries, db.settings], async () => {
    const settings = (await db.settings.get("default")) ?? { volumePrimaryMultiplier: 1, volumeSecondaryMultiplier: 0.5 };
    const periodDays = (settings as AppSettings).gymFeePeriodDays ?? 28;
    const weekCount = Math.round(periodDays / 7);

    const startStr = format(subDays(new Date(), periodDays - 1), "yyyy-MM-dd");
    const endStr = format(new Date(), "yyyy-MM-dd");

    const allWorkouts = await db.workouts
      .where("date")
      .between(startStr, endStr, true, true)
      .toArray();

    const workouts = allWorkouts.filter(w => w.status !== "archived");

    let totalVolume = 0;
    const volumeByDate: Record<string, number> = {};

    for (const workout of workouts) {
      const workoutExercises = await db.workoutExercises.where("workoutId").equals(workout.id).toArray();
      for (const item of workoutExercises) {
        const exercise = await db.exercises.get(item.exerciseId);
        if (!exercise) continue;
        const sets = await db.setEntries.where("workoutExerciseId").equals(item.id).toArray();
        const attribution = attributedVolumeForExercise(exercise, sets, settings as AppSettings);
        totalVolume += attribution.total;
        volumeByDate[workout.date] = (volumeByDate[workout.date] ?? 0) + attribution.total;
      }
    }

    // Weekly volume buckets capped to the actual billing period
    const weeklyVolumes: number[] = [];
    for (let i = weekCount - 1; i >= 0; i--) {
      const wkStart = startOfWeek(subWeeks(new Date(), i), { weekStartsOn: 1 });
      const wkEnd = endOfWeek(subWeeks(new Date(), i), { weekStartsOn: 1 });
      const days = eachDayOfInterval({ start: wkStart, end: wkEnd });
      let wkVol = 0;
      for (const day of days) {
        const key = format(day, "yyyy-MM-dd");
        if (key >= startStr && key <= endStr) {
          wkVol += volumeByDate[key] ?? 0;
        }
      }
      weeklyVolumes.push(Math.round(wkVol));
    }

    return {
      completedCount: workouts.length,
      totalVolume: Math.round(totalVolume),
      weeklyVolumes,
      periodDays,
      weekCount,
    };
  });
}

