"use client";

import { format, formatDistanceToNowStrict, parseISO } from "date-fns";
import { useLiveQuery } from "dexie-react-hooks";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { getWeeklyMetrics, get30DaySummary } from "@/lib/analytics";
import { db } from "@/lib/db";
import { localDateIso } from "@/lib/utils";
import { getWorkoutBundle } from "@/lib/repository";
import { ArrowRight, Check, ChevronDown, ChevronUp, Edit2, Flame } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import { computeDurationSeconds, formatDurationLong, formatTimeOfDay } from "@/lib/time";
import type { Workout, MuscleGroup } from "@/types/domain";

/* ─── helpers ─── */

function MiniSparkline({ values, className }: { values: number[]; className?: string }) {
  const max = Math.max(...values, 1);
  return (
    <div className={cn("flex items-end gap-[3px]", className)}>
      {values.map((v, i) => (
        <div
          key={i}
          className="w-[6px] rounded-sm bg-current opacity-70 transition-all"
          style={{ height: `${Math.max(4, (v / max) * 24)}px` }}
        />
      ))}
    </div>
  );
}

export function Dashboard() {
  const router = useRouter();
  const todayIso = localDateIso(new Date());

  const metrics = useLiveQuery(() => getWeeklyMetrics(todayIso), [todayIso]);
  const recent = useLiveQuery(() => db.workouts.orderBy("date").reverse().filter(w => w.status !== "archived").limit(5).toArray(), []);
  const muscles = useLiveQuery(() => db.muscles.toArray(), []);
  const summary30 = useLiveQuery(() => get30DaySummary(), []);

  const topMuscles = Object.entries(metrics?.byMuscle ?? {})
    .map(([muscleId, volume]) => {
      const muscle = muscles?.find((m) => m.id === muscleId);
      return { id: muscleId, muscleName: muscle?.name ?? "Unknown", volume, exists: !!muscle };
    })
    .filter((m) => m.exists)
    .sort((a, b) => b.volume - a.volume)
    .slice(0, 3);

  const workoutsThisWeek = (metrics?.perDay ?? []).filter((d) => d.volume > 0).length;
  const recentWorkout = recent?.[0];
  const dailyVolumes = (metrics?.perDay ?? []).map(d => d.volume);

  return (
    <div className="space-y-4">
      {/* ── Part A: Compact Dashboard Header ── */}
      <div className="rounded-[1.6rem] border border-border/60 bg-gradient-to-br from-card/95 via-card/90 to-accent/10 px-5 py-5 shadow-[0_16px_48px_-24px_hsl(var(--foreground)/0.35)]">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold tracking-[-0.04em]">
                {format(new Date(), "EEEE")}
              </h1>
              <span className="text-sm text-muted-foreground">{format(new Date(), "MMM d")}</span>
            </div>
            <p className="text-sm text-muted-foreground">
              {recentWorkout
                ? `Last session ${formatDistanceToNowStrict(parseISO(recentWorkout.sessionEndedAt ?? recentWorkout.sessionStartedAt ?? recentWorkout.updatedAt), { addSuffix: true })}`
                : "No sessions logged yet — start your first workout."}
            </p>
          </div>
          <Button
            className="h-11 rounded-full px-6 shadow-[0_8px_20px_-8px_hsl(var(--primary)/0.5)]"
            onClick={() => router.push("/workouts")}
          >
            Start logging
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>

        {/* Weekly Heatmap Strip */}
        <div className="mt-4 grid grid-cols-7 gap-2">
          {(metrics?.perDay ?? []).map((day) => {
            const maxVol = Math.max(...dailyVolumes, 1);
            const intensity = day.volume / maxVol;
            const isToday = day.date === todayIso;
            return (
              <div
                key={day.date}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-xl px-1.5 py-2 transition-colors",
                  isToday ? "bg-accent/50 ring-1 ring-primary/20" : "bg-background/40"
                )}
              >
                <span className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                  {format(parseISO(day.date), "EEE")}
                </span>
                <div
                  className={cn(
                    "h-2 w-full max-w-[28px] rounded-full transition-all",
                    day.volume > 0
                      ? intensity > 0.6
                        ? "bg-primary"
                        : intensity > 0.3
                          ? "bg-primary/60"
                          : "bg-primary/30"
                      : "bg-muted-foreground/10"
                  )}
                />
                {day.volume > 0 && (
                  <span className="text-[9px] font-medium text-primary/70 tabular-nums">
                    {Math.round(day.volume)}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Part B: Consolidated Stats Strip ── */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-[1.3rem] border border-border/50 bg-card/80 px-4 py-3.5 shadow-[0_12px_32px_-20px_hsl(var(--foreground)/0.25)]">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Volume</p>
          <div className="mt-1 flex items-end gap-3">
            <p className="text-2xl font-semibold tracking-[-0.04em] tabular-nums">
              {Math.round(metrics?.totalVolume ?? 0).toLocaleString()}
            </p>
            {dailyVolumes.length > 0 && (
              <MiniSparkline values={dailyVolumes} className="text-primary/60 mb-1" />
            )}
          </div>
          <p className="mt-0.5 text-[10px] text-muted-foreground">this week</p>
        </div>

        <div className="rounded-[1.3rem] border border-border/50 bg-card/80 px-4 py-3.5 shadow-[0_12px_32px_-20px_hsl(var(--foreground)/0.25)]">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Days Active</p>
          <p className="mt-1 text-2xl font-semibold tracking-[-0.04em] tabular-nums">{workoutsThisWeek}</p>
          <p className="mt-0.5 text-[10px] text-muted-foreground">this week</p>
        </div>

        <div className="rounded-[1.3rem] border border-border/50 bg-card/80 px-4 py-3.5 shadow-[0_12px_32px_-20px_hsl(var(--foreground)/0.25)]">
          <div className="flex items-center gap-1.5">
            <Flame className="h-3 w-3 text-muted-foreground" />
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Focus</p>
          </div>
          {topMuscles.length > 0 ? (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {topMuscles.map((item) => (
                <Badge key={item.id} className="bg-primary/8 text-primary/80 border-primary/12 px-2 py-0 text-[10px] font-medium">
                  {item.muscleName}
                </Badge>
              ))}
            </div>
          ) : (
            <p className="mt-1.5 text-xs text-muted-foreground">None yet</p>
          )}
        </div>
      </div>

      {/* ── 30-Day Trend ── */}
      {summary30 && (
        <div className="flex items-center gap-4 rounded-[1.2rem] border border-border/40 bg-card/60 px-4 py-3">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-foreground">
              {summary30.completedCount} sessions · {summary30.totalVolume.toLocaleString()}kg
              <span className="text-muted-foreground"> past 30 days</span>
            </p>
          </div>
          {summary30.weeklyVolumes && summary30.weeklyVolumes.some(v => v > 0) && (
            <div className="flex items-center gap-2">
              <span className="text-[9px] text-muted-foreground">4-wk</span>
              <MiniSparkline values={summary30.weeklyVolumes} className="text-muted-foreground" />
            </div>
          )}
        </div>
      )}

      {/* ── Part C: Recent Workouts (Compact Collapsed Rows) ── */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Recent Sessions</p>
          <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" onClick={() => router.push("/history")}>
            View all
          </Button>
        </div>
        {recent && recent.length > 0 ? (
          <div className="space-y-1.5">
            {recent.map((workout) => (
              <CompactWorkoutRow key={workout.id} workout={workout} muscles={muscles ?? []} />
            ))}
          </div>
        ) : (
          <Card className="border-dashed border-border/50">
            <CardContent className="pt-5">
              <EmptyState
                title="No workout history yet"
                description="Log your first workout to start building momentum."
                action={
                  <Button className="rounded-full px-5" onClick={() => router.push("/workouts")}>
                    Start logging
                  </Button>
                }
              />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

/* ─── Compact Workout Row ─── */

function CompactWorkoutRow({ workout, muscles }: { workout: Workout; muscles: MuscleGroup[] }) {
  const router = useRouter();
  const bundle = useLiveQuery(() => getWorkoutBundle(workout.id), [workout.id]);
  const [expanded, setExpanded] = useState(false);

  if (!bundle) {
    return (
      <div className="h-12 animate-pulse rounded-[1.2rem] border border-border/40 bg-card/40" />
    );
  }

  const durationSeconds = computeDurationSeconds(bundle.workout.sessionStartedAt, bundle.workout.sessionEndedAt);
  const totalReps = bundle.items.reduce((sum, item) => sum + item.sets.reduce((s, set) => s + set.reps, 0), 0);
  const totalVolume = bundle.items.reduce((sum, item) => sum + item.sets.reduce((s, set) => s + (set.reps * set.weight), 0), 0);

  // Get top muscles
  const muscleMap: Record<string, number> = {};
  bundle.items.forEach(item => {
    const vol = item.sets.reduce((s, set) => s + (set.reps * set.weight), 0);
    const primaryIds = (item.exercise.primaryMuscleIds as unknown as string[]) || [];
    [...primaryIds].forEach(id => {
      muscleMap[id] = (muscleMap[id] ?? 0) + vol;
    });
  });
  const topMusclesStr = Object.entries(muscleMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([id]) => muscles.find(m => m.id === id)?.name)
    .filter(Boolean)
    .join(", ");

  const dateStr = format(parseISO(bundle.workout.date), "EEE, MMM d");
  const timeStr = bundle.workout.sessionStartedAt ? formatTimeOfDay(bundle.workout.sessionStartedAt) : "";

  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className="flex w-full items-center gap-3 rounded-[1.2rem] border border-border/50 bg-card/60 px-4 py-3 text-left transition-all hover:bg-card/80"
      >
        <Check className="h-4 w-4 shrink-0 text-success" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium truncate">{dateStr}{timeStr ? ` · ${timeStr}` : ""}</p>
          <p className="text-xs text-muted-foreground truncate">
            {formatDurationLong(durationSeconds)} · {topMusclesStr || "No muscles"} · {totalReps} reps · {Math.round(totalVolume).toLocaleString()}kg
          </p>
        </div>
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      </button>
    );
  }

  return (
    <div className="rounded-[1.2rem] border border-border/50 bg-card/70 overflow-hidden">
      <button
        onClick={() => setExpanded(false)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-card/90 transition-colors"
      >
        <Check className="h-4 w-4 shrink-0 text-success" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium truncate">{dateStr}{timeStr ? ` · ${timeStr}` : ""}</p>
          <p className="text-[10px] text-muted-foreground">
            {formatDurationLong(durationSeconds)} · {totalReps} reps · {Math.round(totalVolume).toLocaleString()}kg vol
          </p>
        </div>
        <ChevronUp className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      </button>
      <div className="border-t border-border/30 px-4 py-3 space-y-2">
        {bundle.items.map((item) => {
          const exerciseDuration = computeDurationSeconds(item.workoutExercise.startedAt, item.workoutExercise.completedAt);
          return (
            <div key={item.workoutExercise.id} className="flex items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium truncate">{item.exercise.name}</p>
                <div className="flex flex-wrap gap-1 mt-0.5">
                  {item.sets.map((s) => (
                    <span key={s.id} className="inline-flex items-center gap-1 rounded-full border border-border/40 bg-background/50 px-2 py-0.5 text-[10px] text-muted-foreground">
                      <span className="font-semibold text-primary/60">#{s.setNumber}</span>
                      {s.reps}×{s.weight}kg
                    </span>
                  ))}
                </div>
              </div>
              <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">{formatDurationLong(exerciseDuration)}</span>
            </div>
          );
        })}
        <div className="flex gap-2 pt-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 rounded-full border border-border/50 px-3 text-[11px]"
            onClick={() => router.push(`/workouts?id=${workout.id}`)}
          >
            <Edit2 className="mr-1.5 h-3 w-3" />
            Edit
          </Button>
        </div>
      </div>
    </div>
  );
}
