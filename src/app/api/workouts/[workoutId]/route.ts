import { NextResponse } from "next/server";
import { getWorkoutById } from "@/server/repositories/workout-repository";

type Params = {
  workoutId: string;
};

export async function GET(_: Request, context: { params: Promise<Params> }) {
  const { workoutId } = await context.params;
  const workout = await getWorkoutById(workoutId);

  if (!workout) {
    return NextResponse.json({ error: "Workout not found" }, { status: 404 });
  }

  return NextResponse.json({ workout });
}
