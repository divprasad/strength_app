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
      exercises.map((e) =>
        prisma.exercise.upsert({
          where: { id: e.id },
          update: {
            name: e.name,
            category: e.category,
            equipment: e.equipment,
            primaryMuscleIds: JSON.stringify(e.primaryMuscleIds),
            secondaryMuscleIds: JSON.stringify(e.secondaryMuscleIds),
            notes: e.notes,
            updatedAt: new Date(e.updatedAt)
          },
          create: {
            id: e.id,
            name: e.name,
            category: e.category,
            equipment: e.equipment,
            primaryMuscleIds: JSON.stringify(e.primaryMuscleIds),
            secondaryMuscleIds: JSON.stringify(e.secondaryMuscleIds),
            notes: e.notes,
            createdAt: new Date(e.createdAt),
            updatedAt: new Date(e.updatedAt)
          }
        })
      )
    );

    return NextResponse.json({ status: "ok", count: exercises.length });
  } catch (error) {
    console.error("Failed to sync exercises:", error);
    return NextResponse.json({ error: "Sync failed" }, { status: 500 });
  }
}
