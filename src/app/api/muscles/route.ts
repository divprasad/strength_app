import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { MuscleGroup } from "@/types/domain";

export async function GET() {
  try {
    const muscles = await prisma.muscleGroup.findMany();
    return NextResponse.json({ muscles });
  } catch (error) {
    console.error("Failed to fetch muscles:", error);
    return NextResponse.json({ error: "Fetch failed" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const { muscleGroups }: { muscleGroups: MuscleGroup[] } = await request.json();

  if (!muscleGroups || !Array.isArray(muscleGroups)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  try {
    await prisma.$transaction(
      muscleGroups.map((m) => {
        const now = new Date();
        const createdAt = m.createdAt ? new Date(m.createdAt) : now;
        const updatedAt = m.updatedAt ? new Date(m.updatedAt) : now;

        return prisma.muscleGroup.upsert({
          where: { id: m.id },
          update: {
            name: m.name,
            updatedAt: isNaN(updatedAt.getTime()) ? now : updatedAt
          },
          create: {
            id: m.id,
            name: m.name,
            createdAt: isNaN(createdAt.getTime()) ? now : createdAt,
            updatedAt: isNaN(updatedAt.getTime()) ? now : updatedAt
          }
        });
      })
    );

    return NextResponse.json({ status: "ok", count: muscleGroups.length });
  } catch (error) {
    console.error("Failed to sync muscles:", error);
    if (error instanceof Error) {
      console.error("Prisma error detail:", error.message);
    }
    return NextResponse.json({ error: "Sync failed" }, { status: 500 });
  }
}
