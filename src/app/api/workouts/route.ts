import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { WorkoutBundle } from "@/types/domain";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import { logger } from "@/lib/logger";

/**
 * Computes a content fingerprint from the actual user data in the DB.
 *
 * Uses aggregates over the full dataset so that edits to any record
 * (not just the most recently created one) are detected.
 *
 * Covers:
 *   - New/deleted workouts, sets, exercises, muscles (counts)
 *   - Edits to reps or weight on ANY set (sum of all reps + sum of all weights)
 *   - Workout completions (count of completed workouts)
 *   - Settings value changes (gym fee, multipliers, scale)
 *   - Exercise and muscle renames (hash of all names)
 *   - Workout notes changes (hash of all notes)
 *
 * Immune to: SQLite WAL checkpointing, Prisma @updatedAt no-op touches,
 * background sync heartbeats that upsert identical data.
 */
async function contentFingerprint(): Promise<string> {
  const [
    workoutCount,
    completedWorkoutCount,
    setAgg,
    exerciseCount,
    muscleCount,
    exercises,
    muscles,
    settings,
    workoutNotes,
  ] = await Promise.all([
    prisma.workout.count(),
    prisma.workout.count({ where: { status: "completed" } }),
    // Aggregate over ALL sets — catches any reps/weight edit anywhere
    prisma.setEntry.aggregate({
      _count: { id: true },
      _sum: { reps: true, weight: true },
    }),
    prisma.exercise.count(),
    prisma.muscleGroup.count(),
    // All exercise names — catches any rename
    prisma.exercise.findMany({ select: { id: true, name: true }, orderBy: { id: "asc" } }),
    // All muscle names — catches any rename
    prisma.muscleGroup.findMany({ select: { id: true, name: true }, orderBy: { id: "asc" } }),
    // Settings actual values — catches gym fee / multiplier / scale changes
    prisma.settings.findFirst({
      select: {
        volumePrimaryMultiplier: true,
        volumeSecondaryMultiplier: true,
        gymFee: true,
        gymFeePeriodDays: true,
        gymFeeTargetPerSession: true,
        appScale: true,
      },
    }),
    // Workout notes — catches note edits on any workout
    prisma.workout.findMany({ select: { id: true, notes: true }, orderBy: { id: "asc" } }),
  ]);

  const exerciseNameHash = crypto
    .createHash("md5")
    .update(exercises.map((e) => `${e.id}:${e.name}`).join(","))
    .digest("hex");

  const muscleNameHash = crypto
    .createHash("md5")
    .update(muscles.map((m) => `${m.id}:${m.name}`).join(","))
    .digest("hex");

  const notesHash = crypto
    .createHash("md5")
    .update(workoutNotes.map((w) => `${w.id}:${w.notes ?? ""}`).join(","))
    .digest("hex");

  const raw = [
    workoutCount,
    completedWorkoutCount,
    setAgg._count.id,
    setAgg._sum.reps ?? 0,
    setAgg._sum.weight ?? 0,
    exerciseCount,
    muscleCount,
    exerciseNameHash,
    muscleNameHash,
    notesHash,
    settings?.volumePrimaryMultiplier ?? "",
    settings?.volumeSecondaryMultiplier ?? "",
    settings?.gymFee ?? "",
    settings?.gymFeePeriodDays ?? "",
    settings?.gymFeeTargetPerSession ?? "",
    settings?.appScale ?? "",
  ].join("|");

  return crypto.createHash("md5").update(raw).digest("hex");
}

type Payload = {
  action: "start" | "finish" | "sync";
  userId: string;
  bundle: WorkoutBundle;
};

export async function POST(request: NextRequest) {
  const payload = (await request.json()) as Payload;
  const { bundle, userId } = payload;

  if (!bundle) {
    return NextResponse.json({ error: "Missing bundle" }, { status: 400 });
  }

  // ── Rolling Backup ──────────────────────────────────────────────────────────
  // Derives the live DB path from DATABASE_URL so it works in both local dev
  // (file:./dev.db → prisma/dev.db) and Docker (file:./strength_diary.db → /app/prisma/strength_diary.db).
  // Backups are written to prisma/backups/ as:
  //   1_strength_diary_YYYY-MM-DD_VOLUMEkg_BU.db  ← newest
  //   2_strength_diary_...                          ← previous
  //   N_strength_diary_...                          ← oldest (infinite, never deleted)
  try {
    const dbUrl = process.env.DATABASE_URL ?? "file:./dev.db";
    const dbFile = dbUrl.replace(/^file:/, "");
    // Prisma resolves relative paths from the schema location = process.cwd()/prisma
    const sourceDbPath = dbFile.startsWith("/")
      ? dbFile
      : path.join(process.cwd(), "prisma", dbFile);

    const [lastWorkout, totalWorkouts] = await Promise.all([
      prisma.workout.findFirst({ orderBy: { date: "desc" } }),
      prisma.workout.count(),
    ]);
    const lastWorkoutDate = lastWorkout ? lastWorkout.date : "none";

    // Compute volume of the last workout (reps × weight across all its sets)
    let lastWorkoutVolume = 0;
    if (lastWorkout) {
      const sets = await prisma.setEntry.findMany({
        where: { workoutExercise: { workoutId: lastWorkout.id } },
        select: { reps: true, weight: true },
      });
      lastWorkoutVolume = Math.round(
        sets.reduce((sum, s) => sum + (s.reps ?? 0) * (s.weight ?? 0), 0)
      );
    }

    const backupDir = path.join(process.cwd(), "prisma", "backups");
    await fs.mkdir(backupDir, { recursive: true });

    // Check DB file exists before attempting backup
    await fs.access(sourceDbPath);

    // Read existing numbered backup files
    const allFiles = await fs.readdir(backupDir);
    const buFiles = allFiles
      .map((f) => ({ name: f, num: parseInt(f.match(/^(\d+)_/)?.[1] ?? "0", 10) }))
      .filter((f) => f.num > 0 && f.name.endsWith("_BU.db"))
      .sort((a, b) => b.num - a.num); // highest number first

    // ── Content-fingerprint guard ─────────────────────────────────────────
    // Compare a semantic fingerprint of the actual data (counts + createdAt +
    // key field values) against the last saved fingerprint in backups/.fingerprint.
    // This is immune to SQLite internal churn (@updatedAt no-ops, WAL checkpoints).
    const fingerprintFile = path.join(backupDir, ".fingerprint");
    const currentFingerprint = await contentFingerprint();
    let savedFingerprint: string | null = null;
    try {
      savedFingerprint = (await fs.readFile(fingerprintFile, "utf-8")).trim();
    } catch {
      // No fingerprint file yet — first run
    }

    if (savedFingerprint === currentFingerprint) {
      logger.info("backup", `Skipping — data unchanged (fingerprint: ${currentFingerprint})`);
      // Fall through to the Prisma transaction without creating a backup.
    } else {
      // Data has meaningfully changed — rotate and create a new backup.
      // Rotate: rename N → N+1 (process highest first to avoid clobbering)
      for (const { name, num } of buFiles) {
        const oldPath = path.join(backupDir, name);
        const newName = name.replace(/^\d+_/, `${num + 1}_`);
        await fs.rename(oldPath, path.join(backupDir, newName));
      }

      // Write new backup as slot 1
      const slot1Name = `1_strength_diary_${lastWorkoutDate}_${lastWorkoutVolume}kg_BU.db`;
      await fs.copyFile(sourceDbPath, path.join(backupDir, slot1Name));

      // Persist the new fingerprint
      await fs.writeFile(fingerprintFile, currentFingerprint, "utf-8");

      const isFirst = buFiles.length === 0;
      logger.info("backup", `${
        isFirst ? "First" : "Rolling"
      } backup created: ${slot1Name} (total: ${buFiles.length + 1}, workouts: ${totalWorkouts})`);
    }
  } catch (backupError) {
    logger.warn("backup", `Skipping backup: ${backupError}`);
  }

  try {
    // We use a transaction to ensure atomicity
    await prisma.$transaction(async (tx) => {
      // 1. Upsert Workout
      await tx.workout.upsert({
        where: { id: bundle.workout.id },
        update: {
          name: bundle.workout.name || `Workout ${bundle.workout.date}`,
          date: bundle.workout.date,
          notes: bundle.workout.notes,
          status: bundle.workout.status,
          userId: userId,
          sessionStartedAt: bundle.workout.sessionStartedAt ? new Date(bundle.workout.sessionStartedAt) : null,
          sessionEndedAt: bundle.workout.sessionEndedAt ? new Date(bundle.workout.sessionEndedAt) : null,
        },
        create: {
          id: bundle.workout.id,
          name: bundle.workout.name || `Workout ${bundle.workout.date}`,
          date: bundle.workout.date,
          notes: bundle.workout.notes,
          status: bundle.workout.status,
          userId: userId,
          sessionStartedAt: bundle.workout.sessionStartedAt ? new Date(bundle.workout.sessionStartedAt) : null,
          sessionEndedAt: bundle.workout.sessionEndedAt ? new Date(bundle.workout.sessionEndedAt) : null,
        },
      });

      // Track incoming IDs to handle deletions
      const incomingExerciseIds = bundle.items.map(item => item.workoutExercise.id);
      const incomingSetIds = bundle.items.flatMap(item => item.sets.map(s => s.id));

      // Find and delete removed WorkoutExercises
      const existingExercises = await tx.workoutExercise.findMany({
        where: { workoutId: bundle.workout.id },
        select: { id: true }
      });
      const exercisesToDelete = existingExercises.map(e => e.id).filter(id => !incomingExerciseIds.includes(id));

      if (exercisesToDelete.length > 0) {
        await tx.setEntry.deleteMany({
          where: { workoutExerciseId: { in: exercisesToDelete } }
        });
        await tx.workoutExercise.deleteMany({
          where: { id: { in: exercisesToDelete } }
        });
      }

      // Find and delete removed Sets within remaining exercises
      if (incomingExerciseIds.length > 0) {
        const existingSets = await tx.setEntry.findMany({
          where: { workoutExerciseId: { in: incomingExerciseIds } },
          select: { id: true }
        });
        const setsToDelete = existingSets.map(s => s.id).filter(id => !incomingSetIds.includes(id));
        if (setsToDelete.length > 0) {
          await tx.setEntry.deleteMany({
            where: { id: { in: setsToDelete } }
          });
        }
      }

      // 2. Upsert WorkoutExercises and their Sets
      for (const item of bundle.items) {
        if (item.exercise) {
          await tx.exercise.upsert({
            where: { id: item.exercise.id },
            update: {
              name: item.exercise.name,
              category: item.exercise.category ?? null,
              equipment: item.exercise.equipment ?? null,
              primaryMuscleIds: JSON.stringify(item.exercise.primaryMuscleIds || []),
              secondaryMuscleIds: JSON.stringify(item.exercise.secondaryMuscleIds || []),
              notes: item.exercise.notes ?? null,
            },
            create: {
              id: item.exercise.id,
              name: item.exercise.name,
              category: item.exercise.category ?? null,
              equipment: item.exercise.equipment ?? null,
              primaryMuscleIds: JSON.stringify(item.exercise.primaryMuscleIds || []),
              secondaryMuscleIds: JSON.stringify(item.exercise.secondaryMuscleIds || []),
              notes: item.exercise.notes ?? null,
            }
          });
        }

        await tx.workoutExercise.upsert({
          where: { id: item.workoutExercise.id },
          update: {
            orderIndex: item.workoutExercise.orderIndex,
            exerciseId: item.workoutExercise.exerciseId,
            startedAt: item.workoutExercise.startedAt ? new Date(item.workoutExercise.startedAt) : null,
            completedAt: item.workoutExercise.completedAt ? new Date(item.workoutExercise.completedAt) : null,
          },
          create: {
            id: item.workoutExercise.id,
            workoutId: bundle.workout.id,
            exerciseId: item.workoutExercise.exerciseId,
            orderIndex: item.workoutExercise.orderIndex,
            startedAt: item.workoutExercise.startedAt ? new Date(item.workoutExercise.startedAt) : null,
            completedAt: item.workoutExercise.completedAt ? new Date(item.workoutExercise.completedAt) : null,
          },
        });

        for (const setEntry of item.sets) {
          await tx.setEntry.upsert({
            where: { id: setEntry.id },
            update: {
              setNumber: setEntry.setNumber,
              weight: setEntry.weight,
              reps: setEntry.reps,
              type: (setEntry as unknown as Record<string, unknown>).type as string || "normal",
              notes: setEntry.notes,
              completedAt: setEntry.completedAt ? new Date(setEntry.completedAt) : null,
            },
            create: {
              id: setEntry.id,
              workoutExerciseId: item.workoutExercise.id,
              setNumber: setEntry.setNumber,
              weight: setEntry.weight,
              reps: setEntry.reps,
              type: (setEntry as unknown as Record<string, unknown>).type as string || "normal",
              notes: setEntry.notes,
              completedAt: setEntry.completedAt ? new Date(setEntry.completedAt) : null,
            },
          });
        }
      }
    });

    logger.info("workouts", `Synced workout ${bundle.workout.id} (action: ${payload.action})`);
    return NextResponse.json({ status: "ok", action: payload.action });
  } catch (error) {
    logger.error("workouts", error);
    return NextResponse.json({ error: "Persistence failed" }, { status: 500 });
  }
}

export async function GET() {
  try {
    const workouts = await prisma.workout.findMany({
      include: {
        exercises: {
          include: {
            sets: true,
          },
          orderBy: {
            orderIndex: "asc",
          },
        },
      },
      orderBy: {
        date: "desc",
      },
    });

    return NextResponse.json({ workouts });
  } catch (error) {
    logger.error("workouts", error);
    return NextResponse.json({ error: "Fetch failed" }, { status: 500 });
  }
}
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (id) {
      await prisma.$transaction([
        prisma.setEntry.deleteMany({
          where: { workoutExercise: { workoutId: id } }
        }),
        prisma.workoutExercise.deleteMany({
          where: { workoutId: id }
        }),
        prisma.workout.delete({
          where: { id }
        })
      ]);
      return NextResponse.json({ status: "ok", message: `Workout ${id} deleted` });
    }

    await prisma.$transaction([
      prisma.setEntry.deleteMany(),
      prisma.workoutExercise.deleteMany(),
      prisma.workout.deleteMany()
    ]);
    logger.warn("workouts", "All workouts cleared");
    return NextResponse.json({ status: "ok", message: "All workouts cleared" });
  } catch (error) {
    logger.error("workouts", error);
    return NextResponse.json({ error: "Clear failed" }, { status: 500 });
  }
}
