import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/auth";
import type { Exercise } from "@/types/domain";

export async function GET() {
  const session = await verifySession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const exercises = await prisma.exercise.findMany({
      where: {
        OR: [{ userId: null }, { userId: session.userId }]
      }
    });
    return NextResponse.json({ exercises });
  } catch (error) {
    console.error("Failed to fetch exercises:", error);
    return NextResponse.json({ error: "Fetch failed" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await verifySession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { exercises }: { exercises: Exercise[] } = await request.json();

  if (!exercises || !Array.isArray(exercises)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  console.log(`[SYNC] Attempting to sync ${exercises.length} exercises. IDs:`, exercises.map(e => e.id));

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
            userId: session.userId,
            createdAt: isNaN(createdAt.getTime()) ? now : createdAt,
            updatedAt: isNaN(updatedAt.getTime()) ? now : updatedAt
          }
        });
      })
    );

    return NextResponse.json({ status: "ok", count: exercises.length });
  } catch (error) {
    console.error("Failed to sync exercises:", error);
    if (error instanceof Error) {
      console.error("Prisma error detail:", error.message);
    }
    return NextResponse.json({ error: "Sync failed" }, { status: 500 });
  }
}
export async function DELETE() {
  const session = await verifySession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    await prisma.exercise.deleteMany({
      where: { userId: session.userId }
    });
    return NextResponse.json({ status: "ok", message: "User exercises cleared" });
  } catch (error) {
    console.error("Failed to clear exercises:", error);
    return NextResponse.json({ error: "Clear failed" }, { status: 500 });
  }
}
