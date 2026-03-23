import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { WorkoutBundle } from "@/types/domain";

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

      // 2. Upsert WorkoutExercises and their Sets
      for (const item of bundle.items) {
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
export async function DELETE() {
  try {
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
