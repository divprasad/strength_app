import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { MuscleGroup } from "@/types/domain";
import { logger } from "@/lib/logger";

export async function GET() {
  try {
    const muscles = await prisma.muscleGroup.findMany();
    return NextResponse.json({ muscles });
  } catch (error) {
    logger.error("muscles", error);
    return NextResponse.json({ error: "Fetch failed" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const { muscleGroups }: { muscleGroups: MuscleGroup[] } = await request.json();

  if (!muscleGroups || !Array.isArray(muscleGroups)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  logger.info("muscles", `Syncing ${muscleGroups.length} muscle groups`);

  try {
    await prisma.$transaction(
      muscleGroups.map((m) => {
        const now = new Date();
        const createdAt = m.createdAt ? new Date(m.createdAt) : now;
        const updatedAt = m.updatedAt ? new Date(m.updatedAt) : now;

        return prisma.muscleGroup.upsert({
          where: { name: m.name },
          update: {
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

    logger.info("muscles", `Synced ${muscleGroups.length} muscle groups OK`);
    return NextResponse.json({ status: "ok", count: muscleGroups.length });
  } catch (error) {
    logger.error("muscles", error);
    return NextResponse.json({ error: "Sync failed" }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    await prisma.muscleGroup.deleteMany();
    logger.warn("muscles", "All muscle groups cleared");
    return NextResponse.json({ status: "ok", message: "All muscles cleared" });
  } catch (error) {
    logger.error("muscles", error);
    return NextResponse.json({ error: "Clear failed" }, { status: 500 });
  }
}
