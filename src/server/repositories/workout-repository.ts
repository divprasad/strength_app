import "server-only";

import { and, desc, eq } from "drizzle-orm";
import { createId, nowIso } from "@/lib/utils";
import { getCurrentUser } from "@/server/current-user";
import { getDb } from "@/server/db";
import { workoutExercises, workouts } from "@/server/db/schema";
import type { Workout, WorkoutBundle, WorkoutStatus } from "@/types/domain";

function toWorkout(row: typeof workouts.$inferSelect): Workout {
  return {
    id: row.id,
    date: row.date,
    status: row.status as WorkoutStatus,
    notes: row.notes ?? undefined,
    userId: row.userId,
    sessionStartedAt: row.sessionStartedAt ?? undefined,
    sessionEndedAt: row.sessionEndedAt ?? undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

function inferStatus(sessionStartedAt?: string | null, sessionEndedAt?: string | null): WorkoutStatus {
  if (!sessionStartedAt) return "draft";
  if (!sessionEndedAt) return "active";
  return "completed";
}

export async function upsertWorkoutSession(bundle: WorkoutBundle): Promise<Workout> {
  const db = getDb();
  const user = getCurrentUser();
  const workout = bundle.workout;
  const status = inferStatus(workout.sessionStartedAt, workout.sessionEndedAt);

  db.transaction((tx) => {
    tx.insert(workouts)
      .values({
        id: workout.id,
        userId: user.id,
        date: workout.date,
        status,
        notes: workout.notes ?? null,
        sessionStartedAt: workout.sessionStartedAt ?? null,
        sessionEndedAt: workout.sessionEndedAt ?? null,
        createdAt: workout.createdAt,
        updatedAt: workout.updatedAt
      })
      .onConflictDoUpdate({
        target: workouts.id,
        set: {
          userId: user.id,
          date: workout.date,
          status,
          notes: workout.notes ?? null,
          sessionStartedAt: workout.sessionStartedAt ?? null,
          sessionEndedAt: workout.sessionEndedAt ?? null,
          updatedAt: workout.updatedAt
        }
      })
      .run();
  });

  return {
    ...workout,
    status,
    userId: user.id
  };
}

export async function listWorkoutsByDate(date: string): Promise<Workout[]> {
  const db = getDb();
  const user = getCurrentUser();
  const rows = db
    .select()
    .from(workouts)
    .where(and(eq(workouts.userId, user.id), eq(workouts.date, date)))
    .orderBy(desc(workouts.updatedAt))
    .all();
  return rows.map(toWorkout);
}

export async function getWorkoutById(workoutId: string): Promise<Workout | null> {
  const user = getCurrentUser();
  const row = getDb()
    .select()
    .from(workouts)
    .where(and(eq(workouts.id, workoutId), eq(workouts.userId, user.id)))
    .get();
  return row ? toWorkout(row) : null;
}

export async function createWorkoutForDate(date: string, options?: Pick<Workout, "notes" | "sessionStartedAt" | "sessionEndedAt">): Promise<Workout> {
  const db = getDb();
  const now = nowIso();
  const user = getCurrentUser();
  const workoutId = createId("workout");
  db.insert(workouts)
    .values({
      id: workoutId,
      userId: user.id,
      date,
      status: inferStatus(options?.sessionStartedAt, options?.sessionEndedAt),
      notes: options?.notes ?? null,
      sessionStartedAt: options?.sessionStartedAt ?? null,
      sessionEndedAt: options?.sessionEndedAt ?? null,
      createdAt: now,
      updatedAt: now
    })
    .run();
  return {
    id: workoutId,
    date,
    status: inferStatus(options?.sessionStartedAt, options?.sessionEndedAt),
    notes: options?.notes,
    userId: user.id,
    sessionStartedAt: options?.sessionStartedAt,
    sessionEndedAt: options?.sessionEndedAt,
    createdAt: now,
    updatedAt: now
  };
}

export async function startWorkoutSession(workoutId: string): Promise<Workout | null> {
  const db = getDb();
  const existing = await getWorkoutById(workoutId);
  if (!existing) return null;
  if (existing.status === "active") return existing;
  const now = nowIso();
  db.update(workouts)
    .set({ status: "active", sessionStartedAt: existing.sessionStartedAt ?? now, sessionEndedAt: null, updatedAt: now })
    .where(eq(workouts.id, workoutId))
    .run();
  return { ...existing, status: "active", sessionStartedAt: existing.sessionStartedAt ?? now, sessionEndedAt: undefined, updatedAt: now };
}

export async function finishWorkoutSession(workoutId: string): Promise<Workout | null> {
  const db = getDb();
  const existing = await getWorkoutById(workoutId);
  if (!existing) return null;
  const now = nowIso();
  db.update(workouts)
    .set({ status: "completed", sessionEndedAt: now, updatedAt: now })
    .where(eq(workouts.id, workoutId))
    .run();
  return { ...existing, status: "completed", sessionEndedAt: now, updatedAt: now };
}

export async function listWorkoutExercises(workoutId: string) {
  return getDb().select().from(workoutExercises).where(eq(workoutExercises.workoutId, workoutId)).orderBy(workoutExercises.orderIndex).all();
}
