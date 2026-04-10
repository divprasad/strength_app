import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { Exercise } from "@/types/domain";
import { logger } from "@/lib/logger";

export async function GET() {
  try {
    const exercises = await prisma.exercise.findMany();
    return NextResponse.json({ exercises });
  } catch (error) {
    logger.error("exercises", error);
    return NextResponse.json({ error: "Fetch failed" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const { exercises }: { exercises: Exercise[] } = await request.json();

  if (!exercises || !Array.isArray(exercises)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  logger.info("exercises", `Syncing ${exercises.length} exercises`);

  try {
    await prisma.$transaction(
      exercises.map((e) => {
        const now = new Date();
        const createdAt = e.createdAt ? new Date(e.createdAt) : now;
        const updatedAt = e.updatedAt ? new Date(e.updatedAt) : now;

        const primaryMuscleIds = Array.isArray(e.primaryMuscleIds) ? e.primaryMuscleIds : [];
        const secondaryMuscleIds = Array.isArray(e.secondaryMuscleIds) ? e.secondaryMuscleIds : [];

        return prisma.exercise.upsert({
          where: { name: e.name },
          update: {
            category: e.category,
            equipment: e.equipment,
            primaryMuscleIds: JSON.stringify(primaryMuscleIds),
            secondaryMuscleIds: JSON.stringify(secondaryMuscleIds),
            notes: e.notes,
            updatedAt: isNaN(updatedAt.getTime()) ? now : updatedAt
          },
          create: {
            id: e.id,
            name: e.name,
            category: e.category,
            equipment: e.equipment,
            primaryMuscleIds: JSON.stringify(primaryMuscleIds),
            secondaryMuscleIds: JSON.stringify(secondaryMuscleIds),
            notes: e.notes,
            createdAt: isNaN(createdAt.getTime()) ? now : createdAt,
            updatedAt: isNaN(updatedAt.getTime()) ? now : updatedAt
          }
        });
      })
    );

    logger.info("exercises", `Synced ${exercises.length} exercises OK`);
    return NextResponse.json({ status: "ok", count: exercises.length });
  } catch (error) {
    logger.error("exercises", error);
    return NextResponse.json({ error: "Sync failed" }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    await prisma.exercise.deleteMany();
    logger.warn("exercises", "All exercises cleared");
    return NextResponse.json({ status: "ok", message: "All exercises cleared" });
  } catch (error) {
    logger.error("exercises", error);
    return NextResponse.json({ error: "Clear failed" }, { status: 500 });
  }
}
