"use client";

import { formatDistanceToNowStrict, parseISO } from "date-fns";
import { useLiveQuery } from "dexie-react-hooks";
import { useRouter } from "next/navigation";
import { getWeeklyMetrics } from "@/lib/analytics";
import { db } from "@/lib/db";
import { localDateIso } from "@/lib/utils";
import { ArrowRight, Flame, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";

export function Dashboard() {
  const router = useRouter();
  const todayIso = localDateIso(new Date());

  const metrics = useLiveQuery(() => getWeeklyMetrics(todayIso), [todayIso]);
  const recent = useLiveQuery(() => db.workouts.orderBy("date").reverse().limit(5).toArray(), []);
  const muscles = useLiveQuery(() => db.muscles.toArray(), []);

  const topMuscles = Object.entries(metrics?.byMuscle ?? {})
    .map(([muscleId, volume]) => ({
      muscleName: muscles?.find((m) => m.id === muscleId)?.name ?? "Unknown",
      volume
    }))
    .sort((a, b) => b.volume - a.volume)
    .slice(0, 3);

  const workoutsThisWeek = (metrics?.perDay ?? []).filter((d) => d.volume > 0).length;
  const recentWorkout = recent?.[0];

  return (
    <div className="space-y-6 md:space-y-8">
      <section className="relative overflow-hidden rounded-[2rem] border border-white/50 bg-[linear-gradient(135deg,hsl(var(--foreground))_0%,hsl(var(--primary))_58%,hsl(var(--accent))_140%)] px-5 py-6 text-primary-foreground shadow-[0_26px_80px_-34px_hsl(var(--foreground)/0.7)] md:px-8 md:py-8">
        <div className="absolute inset-y-0 right-0 hidden w-1/3 bg-[radial-gradient(circle_at_top,hsl(var(--primary-foreground)/0.22),transparent_64%)] md:block" />
        <div className="relative grid gap-6 md:grid-cols-[minmax(0,1.8fr)_minmax(250px,1fr)] md:items-end">
          <div className="space-y-4">
            <Badge className="border border-white/20 bg-white/10 px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-primary-foreground">
              Editorial Athletic
            </Badge>
            <div className="space-y-3">
              <p className="text-sm font-medium text-primary-foreground/70">Today&apos;s training window</p>
              <h1 className="max-w-xl text-4xl font-semibold tracking-[-0.05em] md:text-5xl">
                Build momentum with a clean session start and a tighter weekly rhythm.
              </h1>
              <p className="max-w-2xl text-sm text-primary-foreground/78 md:text-base">
                Open the logger fast, keep your weekly volume visible, and stay on top of the sessions that actually move your plan forward.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button
                className="h-12 rounded-full bg-white px-6 text-foreground hover:bg-white/92"
                onClick={() => router.push("/workouts")}
              >
                Start logging
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <div className="flex items-center gap-3 rounded-full border border-white/16 bg-white/10 px-4 py-3 text-sm text-primary-foreground/78">
                <Sparkles className="h-4 w-4" />
                {recentWorkout
                  ? `Last session ${formatDistanceToNowStrict(parseISO(recentWorkout.updatedAt), { addSuffix: true })}`
                  : "No recent session yet. Your next workout sets the baseline."}
              </div>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3 md:grid-cols-1">
            <div className="rounded-[1.4rem] border border-white/12 bg-black/16 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-primary-foreground/62">Weekly volume</p>
              <p className="mt-3 text-3xl font-semibold tracking-[-0.04em]">{Math.round(metrics?.totalVolume ?? 0)}</p>
              <p className="mt-1 text-sm text-primary-foreground/72">reps × weight</p>
            </div>
            <div className="rounded-[1.4rem] border border-white/12 bg-black/16 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-primary-foreground/62">Sessions logged</p>
              <p className="mt-3 text-3xl font-semibold tracking-[-0.04em]">{workoutsThisWeek}</p>
              <p className="mt-1 text-sm text-primary-foreground/72">active days this week</p>
            </div>
            <div className="rounded-[1.4rem] border border-white/12 bg-black/16 p-4">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-primary-foreground/62">
                <Flame className="h-3.5 w-3.5" />
                Focus muscles
              </div>
              {topMuscles.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {topMuscles.map((item) => (
                    <Badge
                      key={item.muscleName}
                      className="bg-white/12 px-3 py-1 text-primary-foreground ring-1 ring-white/12"
                    >
                      {item.muscleName}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-sm text-primary-foreground/72">No logged volume yet.</p>
              )}
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="overflow-hidden border-white/50 bg-card/88 shadow-[0_20px_55px_-36px_hsl(var(--foreground)/0.4)]">
          <CardHeader className="pb-3">
            <CardDescription className="text-[0.72rem] font-semibold uppercase tracking-[0.2em] text-primary/70">
              Weekly Volume
            </CardDescription>
            <CardTitle className="text-3xl">{Math.round(metrics?.totalVolume ?? 0)}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Total workload across all logged sets this week.</p>
          </CardContent>
        </Card>
        <Card className="overflow-hidden border-white/50 bg-card/88 shadow-[0_20px_55px_-36px_hsl(var(--foreground)/0.4)]">
          <CardHeader className="pb-3">
            <CardDescription className="text-[0.72rem] font-semibold uppercase tracking-[0.2em] text-primary/70">
              Workout Days
            </CardDescription>
            <CardTitle className="text-3xl">{workoutsThisWeek}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Distinct days with non-zero volume in the current week.</p>
          </CardContent>
        </Card>
        <Card className="overflow-hidden border-white/50 bg-card/88 shadow-[0_20px_55px_-36px_hsl(var(--foreground)/0.4)]">
          <CardHeader className="pb-3">
            <CardDescription className="text-[0.72rem] font-semibold uppercase tracking-[0.2em] text-primary/70">
              Top Muscles
            </CardDescription>
            <CardTitle className="text-3xl">{topMuscles.length > 0 ? topMuscles[0]?.muscleName : "None yet"}</CardTitle>
          </CardHeader>
          <CardContent>
            {topMuscles.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {topMuscles.map((item) => (
                  <Badge key={item.muscleName} className="bg-accent px-3 py-1 text-accent-foreground">
                    {item.muscleName}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Log a workout to start seeing weekly emphasis.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-white/50 bg-card/88 shadow-[0_20px_55px_-36px_hsl(var(--foreground)/0.4)]">
        <CardHeader className="flex flex-col gap-2 border-b border-border/70 pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <CardDescription className="text-[0.72rem] font-semibold uppercase tracking-[0.2em] text-primary/70">
              Recent activity
            </CardDescription>
            <CardTitle className="mt-2 text-2xl">Recent Workouts</CardTitle>
          </div>
          <p className="max-w-md text-sm text-muted-foreground">Review your latest logged sessions and jump back into the logger without leaving the dashboard.</p>
        </CardHeader>
        <CardContent className="pt-5">
          {recent && recent.length > 0 ? (
            <ul className="space-y-3">
              {recent.map((workout) => (
                <li
                  key={workout.id}
                  className="flex items-center justify-between gap-3 rounded-[1.3rem] border border-border/70 bg-background/72 p-4 shadow-[0_18px_40px_-36px_hsl(var(--foreground)/0.65)]"
                >
                  <div className="min-w-0">
                    <p className="font-medium">{workout.date}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {workout.status} · Updated {formatDistanceToNowStrict(parseISO(workout.updatedAt), { addSuffix: true })}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    className="rounded-full border border-border/70 bg-card px-4 hover:bg-accent"
                    onClick={() => router.push("/workouts")}
                  >
                    Open
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              title="No workout history yet"
              description="Log your first workout to start building weekly momentum and recent-session history."
              action={
                <Button className="rounded-full px-5" onClick={() => router.push("/workouts")}>
                  Start logging
                </Button>
              }
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
