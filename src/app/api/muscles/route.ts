import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { MuscleGroup } from "@/types/domain";

export async function POST(request: NextRequest) {
  const { muscleGroups }: { muscleGroups: MuscleGroup[] } = await request.json();

  if (!muscleGroups || !Array.isArray(muscleGroups)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  try {
    await prisma.$transaction(
      muscleGroups.map((m) =>
        prisma.muscleGroup.upsert({
          where: { id: m.id },
          update: { name: m.name, updatedAt: new Date(m.updatedAt) },
          create: { id: m.id, name: m.name, createdAt: new Date(m.createdAt), updatedAt: new Date(m.updatedAt) }
        })
      )
    );

    return NextResponse.json({ status: "ok", count: muscleGroups.length });
  } catch (error) {
    console.error("Failed to sync muscles:", error);
    return NextResponse.json({ error: "Sync failed" }, { status: 500 });
  }
}
