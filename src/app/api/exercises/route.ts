import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { Exercise } from "@/types/domain";

export async function POST(request: NextRequest) {
  const { exercises }: { exercises: Exercise[] } = await request.json();

  if (!exercises || !Array.isArray(exercises)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  try {
    await prisma.$transaction(
      exercises.map((e) => {
        const now = new Date();
        const createdAt = e.createdAt ? new Date(e.createdAt) : now;
        const updatedAt = e.updatedAt ? new Date(e.updatedAt) : now;

        const primaryMuscleIds = Array.isArray(e.primaryMuscleIds) ? e.primaryMuscleIds : [];
        const secondaryMuscleIds = Array.isArray(e.secondaryMuscleIds) ? e.secondaryMuscleIds : [];

        return prisma.exercise.upsert({
          where: { id: e.id },
          update: {
            name: e.name,
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

    return NextResponse.json({ status: "ok", count: exercises.length });
  } catch (error) {
    console.error("Failed to sync exercises:", error);
    return NextResponse.json({ error: "Sync failed" }, { status: 500 });
  }
}
