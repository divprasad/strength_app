import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

const DEFAULT_SETTINGS = {
  id: "default",
  volumePrimaryMultiplier: 1.0,
  volumeSecondaryMultiplier: 0.5,
  gymFee: null,
  gymFeePeriodDays: null,
  gymFeeTargetPerSession: null,
  appScale: 1.0,
};

export async function GET() {
  try {
    const settings = await prisma.settings.findUnique({ where: { id: "default" } });
    return NextResponse.json({ settings: settings ?? DEFAULT_SETTINGS });
  } catch (error) {
    logger.error("settings", error);
    return NextResponse.json({ settings: DEFAULT_SETTINGS });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      volumePrimaryMultiplier,
      volumeSecondaryMultiplier,
      gymFee,
      gymFeePeriodDays,
      gymFeeTargetPerSession,
      appScale,
    } = body;

    const settings = await prisma.settings.upsert({
      where: { id: "default" },
      update: {
        ...(volumePrimaryMultiplier !== undefined && { volumePrimaryMultiplier }),
        ...(volumeSecondaryMultiplier !== undefined && { volumeSecondaryMultiplier }),
        ...(gymFee !== undefined && { gymFee }),
        ...(gymFeePeriodDays !== undefined && { gymFeePeriodDays }),
        ...(gymFeeTargetPerSession !== undefined && { gymFeeTargetPerSession }),
        ...(appScale !== undefined && { appScale }),
      },
      create: {
        id: "default",
        volumePrimaryMultiplier: volumePrimaryMultiplier ?? 1.0,
        volumeSecondaryMultiplier: volumeSecondaryMultiplier ?? 0.5,
        gymFee: gymFee ?? null,
        gymFeePeriodDays: gymFeePeriodDays ?? null,
        gymFeeTargetPerSession: gymFeeTargetPerSession ?? null,
        appScale: appScale ?? 1.0,
      },
    });

    logger.info("settings", `Settings saved (scale=${settings.appScale}, gymFee=${settings.gymFee})`);
    return NextResponse.json({ settings });
  } catch (error) {
    logger.error("settings", error);
    return NextResponse.json({ error: "Failed to save settings" }, { status: 500 });
  }
}
