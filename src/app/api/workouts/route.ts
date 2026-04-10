import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { WorkoutBundle } from "@/types/domain";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

/** Returns the MD5 hex digest of a file, or null if the file can't be read. */
async function md5File(filePath: string): Promise<string | null> {
  try {
    const buf = await fs.readFile(filePath);
    return crypto.createHash("md5").update(buf).digest("hex");
  } catch {
    return null;
  }
}

type Payload = {
  action: "start" | "finish" | "sync";
  userId: string;
  bundle: WorkoutBundle;
};

export async function POST(request: NextRequest) {
  const payload = (await request.json()) as Payload;
  const { bundle, userId } = payload;
  console.log("[API DEBUG] CWD:", process.cwd());
  console.log("[API DEBUG] DATABASE_URL:", process.env.DATABASE_URL);

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

    // Skip backup if the live DB is identical to the latest backup (slot 1).
    // This prevents churn on syncs that don't change any data on disk.
    const latestBackup = buFiles.find((f) => f.num === 1);
    if (latestBackup) {
      const [liveHash, backupHash] = await Promise.all([
        md5File(sourceDbPath),
        md5File(path.join(backupDir, latestBackup.name)),
      ]);
      if (liveHash && liveHash === backupHash) {
        console.log(`[API Backup] Skipping — DB unchanged (md5: ${liveHash})`);
        // Fall through to the Prisma transaction without creating a backup.
      } else {
        // Rotate: rename N → N+1 (process highest first to avoid clobbering)
        for (const { name, num } of buFiles) {
          const oldPath = path.join(backupDir, name);
          const newName = name.replace(/^\d+_/, `${num + 1}_`);
          await fs.rename(oldPath, path.join(backupDir, newName));
        }

        // Write new backup as slot 1
        const slot1Name = `1_strength_diary_${lastWorkoutDate}_${lastWorkoutVolume}kg_BU.db`;
        await fs.copyFile(sourceDbPath, path.join(backupDir, slot1Name));
        console.log(`[API Backup] Rolling backup created: ${slot1Name} (total backups: ${buFiles.length + 1}, ${totalWorkouts} workouts)`);
      }
    } else {
      // No existing backups at all — always create the first one
      const slot1Name = `1_strength_diary_${lastWorkoutDate}_${lastWorkoutVolume}kg_BU.db`;
      await fs.copyFile(sourceDbPath, path.join(backupDir, slot1Name));
      console.log(`[API Backup] First backup created: ${slot1Name} (${totalWorkouts} workouts)`);
    }
  } catch (backupError) {
    console.log("[API Backup] Skipping backup:", backupError);
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

    return NextResponse.json({ status: "ok", action: payload.action });
  } catch (error) {
    console.error("Failed to persist workout:", error);
    return NextResponse.json({ error: "Persistence failed" }, { status: 500 });
  }
}

export async function GET() {
  console.log("[API DEBUG GET] CWD:", process.cwd());
  console.log("[API DEBUG GET] DATABASE_URL:", process.env.DATABASE_URL);
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
    console.error("Failed to fetch workouts:", error);
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
    return NextResponse.json({ status: "ok", message: "All workouts cleared" });
  } catch (error) {
    console.error("Failed to clear workouts:", error);
    return NextResponse.json({ error: "Clear failed" }, { status: 500 });
  }
}
