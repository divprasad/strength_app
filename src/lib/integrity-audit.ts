import { db } from "@/lib/db";
import type { IntegrityAuditReport, IntegrityIssue, IntegrityIssueSeverity, AppSettings } from "@/types/domain";

function addIssue(
  issues: IntegrityIssue[],
  entity: string,
  severity: IntegrityIssueSeverity,
  message: string,
  id?: string,
  details?: Record<string, unknown>
) {
  issues.push({ entity, id, severity, message, details });
}

function hasFinitePositiveNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

export async function runIntegrityAudit(): Promise<IntegrityAuditReport> {
  const [workouts, workoutExercises, setEntries, exercises, muscles, settings] = await Promise.all([
    db.workouts.toArray(),
    db.workoutExercises.toArray(),
    db.setEntries.toArray(),
    db.exercises.toArray(),
    db.muscles.toArray(),
    db.settings.get("default")
  ]);

  const issues: IntegrityIssue[] = [];
  const workoutIds = new Set(workouts.map((workout) => workout.id));
  const exerciseIds = new Set(exercises.map((exercise) => exercise.id));
  const muscleIds = new Set(muscles.map((muscle) => muscle.id));
  const workoutExerciseIds = new Set(workoutExercises.map((item) => item.id));

  if (!settings) {
    addIssue(issues, "settings", "error", "Missing default app settings row.", "default");
  } else {
    const typedSettings = settings as AppSettings;
    if (!hasFinitePositiveNumber(typedSettings.volumePrimaryMultiplier)) {
      addIssue(issues, "settings", "error", "Invalid volumePrimaryMultiplier.", "default", {
        value: typedSettings.volumePrimaryMultiplier
      });
    }
    if (!hasFinitePositiveNumber(typedSettings.volumeSecondaryMultiplier)) {
      addIssue(issues, "settings", "error", "Invalid volumeSecondaryMultiplier.", "default", {
        value: typedSettings.volumeSecondaryMultiplier
      });
    }
  }

  const workoutDates = new Map<string, string[]>();
  for (const workout of workouts) {
    const existing = workoutDates.get(workout.date) ?? [];
    existing.push(workout.id);
    workoutDates.set(workout.date, existing);
  }

  for (const workoutExercise of workoutExercises) {
    if (!workoutIds.has(workoutExercise.workoutId)) {
      addIssue(issues, "workoutExercise", "error", "WorkoutExercise references a missing workout.", workoutExercise.id, {
        workoutId: workoutExercise.workoutId
      });
    }
    if (!exerciseIds.has(workoutExercise.exerciseId)) {
      addIssue(issues, "workoutExercise", "error", "WorkoutExercise references a missing exercise.", workoutExercise.id, {
        exerciseId: workoutExercise.exerciseId
      });
    }
  }

  for (const setEntry of setEntries) {
    if (!workoutExerciseIds.has(setEntry.workoutExerciseId)) {
      addIssue(issues, "setEntry", "error", "SetEntry references a missing workout exercise.", setEntry.id, {
        workoutExerciseId: setEntry.workoutExerciseId
      });
    }
  }

  for (const exercise of exercises) {
    const missingPrimary = exercise.primaryMuscleIds.filter((id) => !muscleIds.has(id));
    const missingSecondary = exercise.secondaryMuscleIds.filter((id) => !muscleIds.has(id));
    if (missingPrimary.length > 0) {
      addIssue(issues, "exercise", "error", "Exercise references missing primary muscle IDs.", exercise.id, {
        missingMuscleIds: missingPrimary
      });
    }
    if (missingSecondary.length > 0) {
      addIssue(issues, "exercise", "error", "Exercise references missing secondary muscle IDs.", exercise.id, {
        missingMuscleIds: missingSecondary
      });
    }
  }

  const orderGroups = new Map<string, string[]>();
  for (const workoutExercise of workoutExercises) {
    if (!workoutIds.has(workoutExercise.workoutId) || !exerciseIds.has(workoutExercise.exerciseId)) continue;
    const key = `${workoutExercise.workoutId}:${workoutExercise.orderIndex}`;
    const list = orderGroups.get(key) ?? [];
    list.push(workoutExercise.id);
    orderGroups.set(key, list);
  }
  for (const [key, ids] of orderGroups) {
    if (ids.length > 1) {
      const [workoutId, orderIndex] = key.split(":");
      addIssue(issues, "workoutExercise", "warning", "Duplicate orderIndex within a workout.", ids[0], {
        workoutId,
        orderIndex: Number(orderIndex),
        conflictingIds: ids
      });
    }
  }

  const setGroups = new Map<string, string[]>();
  for (const setEntry of setEntries) {
    if (!workoutExerciseIds.has(setEntry.workoutExerciseId)) continue;
    const key = `${setEntry.workoutExerciseId}:${setEntry.setNumber}`;
    const list = setGroups.get(key) ?? [];
    list.push(setEntry.id);
    setGroups.set(key, list);
  }
  for (const [key, ids] of setGroups) {
    if (ids.length > 1) {
      const [workoutExerciseId, setNumber] = key.split(":");
      addIssue(issues, "setEntry", "warning", "Duplicate setNumber within a workout exercise.", ids[0], {
        workoutExerciseId,
        setNumber: Number(setNumber),
        conflictingIds: ids
      });
    }
  }

  for (const [date, workoutIdsForDate] of workoutDates) {
    if (workoutIdsForDate.length <= 1) continue;
    const runningWorkoutIds = workoutIdsForDate.filter((id) => {
      const candidate = workouts.find((item) => item.id === id);
      return Boolean(candidate?.sessionStartedAt && !candidate.sessionEndedAt);
    });
    if (runningWorkoutIds.length > 1) {
      addIssue(issues, "workout", "warning", "Multiple workouts on the same date are currently running.", workoutIdsForDate[0], {
        date,
        runningWorkoutIds
      });
    }
  }

  for (const workout of workouts) {
    const expectedStatus = !workout.sessionStartedAt
      ? "draft"
      : workout.sessionEndedAt
        ? "completed"
        : "active";
    if (workout.status !== expectedStatus) {
      addIssue(issues, "workout", "warning", "Workout status does not match session timestamps.", workout.id, {
        status: workout.status,
        expectedStatus,
        sessionStartedAt: workout.sessionStartedAt,
        sessionEndedAt: workout.sessionEndedAt
      });
    }
    if (workout.sessionStartedAt && workout.sessionEndedAt) {
      const started = Date.parse(workout.sessionStartedAt);
      const ended = Date.parse(workout.sessionEndedAt);
      if (!Number.isNaN(started) && !Number.isNaN(ended) && ended < started) {
        addIssue(issues, "workout", "error", "Workout ended before it started.", workout.id, {
          sessionStartedAt: workout.sessionStartedAt,
          sessionEndedAt: workout.sessionEndedAt
        });
      }
    }
  }

  const errorCount = issues.filter((issue) => issue.severity === "error").length;
  const warningCount = issues.filter((issue) => issue.severity === "warning").length;

  return {
    ok: issues.length === 0,
    summary: {
      total: issues.length,
      errors: errorCount,
      warnings: warningCount
    },
    issues
  };
}

export async function healDatabase(): Promise<{ healedCount: number }> {
  const [exercises, muscles, workoutExercises, setEntries] = await Promise.all([
    db.exercises.toArray(),
    db.muscles.toArray(),
    db.workoutExercises.toArray(),
    db.setEntries.toArray()
  ]);

  const muscleIdSet = new Set(muscles.map((m) => m.id));
  let healedCount = 0;

  // 1. Heal Muscle Links (Exercises)
  for (const exercise of exercises) {
    const missingPrimary = exercise.primaryMuscleIds.filter((id) => !muscleIdSet.has(id));
    const missingSecondary = exercise.secondaryMuscleIds.filter((id) => !muscleIdSet.has(id));

    if (missingPrimary.length > 0 || missingSecondary.length > 0) {
      const newPrimary = exercise.primaryMuscleIds.filter(id => muscleIdSet.has(id));
      const newSecondary = exercise.secondaryMuscleIds.filter(id => muscleIdSet.has(id));

      await db.exercises.update(exercise.id, {
        primaryMuscleIds: newPrimary,
        secondaryMuscleIds: newSecondary,
        updatedAt: new Date().toISOString()
      });
      healedCount++;
    }
  }

  // 2. Heal Duplicate WorkoutExercise Order
  const workoutGroups = new Map<string, typeof workoutExercises>();
  workoutExercises.forEach(we => {
    const list = workoutGroups.get(we.workoutId) || [];
    list.push(we);
    workoutGroups.set(we.workoutId, list);
  });

  for (const [, items] of workoutGroups) {
    const sorted = [...items].sort((a, b) => a.orderIndex - b.orderIndex);
    let needsReorder = false;
    for (let i = 0; i < sorted.length; i++) {
      if (sorted[i].orderIndex !== i) {
        needsReorder = true;
        break;
      }
    }

    if (needsReorder) {
      for (let i = 0; i < sorted.length; i++) {
        if (sorted[i].orderIndex !== i) {
          await db.workoutExercises.update(sorted[i].id, { orderIndex: i });
          healedCount++;
        }
      }
    }
  }

  // 3. Heal Duplicate Set Numbers
  const workoutExerciseGroups = new Map<string, typeof setEntries>();
  setEntries.forEach(se => {
    const list = workoutExerciseGroups.get(se.workoutExerciseId) || [];
    list.push(se);
    workoutExerciseGroups.set(se.workoutExerciseId, list);
  });

  for (const [, items] of workoutExerciseGroups) {
    const sorted = [...items].sort((a, b) => a.setNumber - b.setNumber);
    let needsResequence = false;
    for (let i = 0; i < sorted.length; i++) {
      if (sorted[i].setNumber !== i + 1) {
        needsResequence = true;
        break;
      }
    }

    if (needsResequence) {
      for (let i = 0; i < sorted.length; i++) {
        const newNumber = i + 1;
        if (sorted[i].setNumber !== newNumber) {
          await db.setEntries.update(sorted[i].id, { 
            setNumber: newNumber,
            updatedAt: new Date().toISOString()
          });
          healedCount++;
        }
      }
    }
  }

  return { healedCount };
}
