import { NextRequest, NextResponse } from "next/server";
import { upsertWorkoutSession } from "@/server/repositories/workout-repository";
import type { WorkoutBundle } from "@/types/domain";

type Payload = {
  action: "start" | "finish" | "sync";
  bundle: WorkoutBundle;
};

export async function POST(request: NextRequest) {
  const payload = (await request.json()) as Payload;
  if (!payload?.bundle?.workout?.id) {
    return NextResponse.json({ error: "Missing bundle" }, { status: 400 });
  }

  const workout = await upsertWorkoutSession(payload.bundle);

  return NextResponse.json({
    status: "ok",
    action: payload.action,
    workout
  });
}
