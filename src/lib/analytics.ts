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
export async function get30DaySummary(): Promise<{ completedCount: number; totalVolume: number; weeklyVolumes: number[] }> {
  const thirtyDaysAgo = subDays(new Date(), 30);
  const startStr = format(thirtyDaysAgo, "yyyy-MM-dd");
  const endStr = format(new Date(), "yyyy-MM-dd");

  return db.transaction("r", [db.workouts, db.workoutExercises, db.exercises, db.setEntries, db.settings], async () => {
    const allWorkouts = await db.workouts
      .where("date")
      .between(startStr, endStr, true, true)
      .toArray();
    
    const workouts = allWorkouts.filter(w => w.status !== "archived");
    const settings = (await db.settings.get("default")) ?? { volumePrimaryMultiplier: 1, volumeSecondaryMultiplier: 0.5 };

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

    // Compute 4-week volume trend
    const weeklyVolumes: number[] = [];
    for (let i = 3; i >= 0; i--) {
      const wkStart = startOfWeek(subWeeks(new Date(), i), { weekStartsOn: 1 });
      const wkEnd = endOfWeek(subWeeks(new Date(), i), { weekStartsOn: 1 });
      const days = eachDayOfInterval({ start: wkStart, end: wkEnd });
      let wkVol = 0;
      for (const day of days) {
        const key = format(day, "yyyy-MM-dd");
        wkVol += volumeByDate[key] ?? 0;
      }
      weeklyVolumes.push(Math.round(wkVol));
    }

    return {
      completedCount: workouts.length,
      totalVolume: Math.round(totalVolume),
      weeklyVolumes
    };
  });
}
