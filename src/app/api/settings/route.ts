import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/auth";

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
  const session = await verifySession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const settings = await prisma.settings.findUnique({ where: { userId: session.userId } });
    return NextResponse.json({ settings: settings ?? DEFAULT_SETTINGS });
  } catch (error) {
    console.error("[Settings API] GET failed:", error);
    return NextResponse.json({ settings: DEFAULT_SETTINGS });
  }
}

export async function POST(request: NextRequest) {
  const session = await verifySession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
      where: { userId: session.userId },
      update: {
        ...(volumePrimaryMultiplier !== undefined && { volumePrimaryMultiplier }),
        ...(volumeSecondaryMultiplier !== undefined && { volumeSecondaryMultiplier }),
        ...(gymFee !== undefined && { gymFee }),
        ...(gymFeePeriodDays !== undefined && { gymFeePeriodDays }),
        ...(gymFeeTargetPerSession !== undefined && { gymFeeTargetPerSession }),
        ...(appScale !== undefined && { appScale }),
      },
      create: {
        userId: session.userId,
        volumePrimaryMultiplier: volumePrimaryMultiplier ?? 1.0,
        volumeSecondaryMultiplier: volumeSecondaryMultiplier ?? 0.5,
        gymFee: gymFee ?? null,
        gymFeePeriodDays: gymFeePeriodDays ?? null,
        gymFeeTargetPerSession: gymFeeTargetPerSession ?? null,
        appScale: appScale ?? 1.0,
      },
    });

    return NextResponse.json({ settings });
  } catch (error) {
    console.error("[Settings API] POST failed:", error);
    return NextResponse.json({ error: "Failed to save settings" }, { status: 500 });
  }
}
