"use client";

import { format, formatDistanceToNowStrict, parseISO } from "date-fns";
import { useLiveQuery } from "dexie-react-hooks";
import { useRouter } from "next/navigation";
import { useState, useRef, useCallback, useEffect } from "react";
import { getWeeklyMetrics, get30DaySummary } from "@/lib/analytics";
import { db } from "@/lib/db";
import { localDateIso } from "@/lib/utils";
import { getWorkoutBundle } from "@/lib/repository";
import { ArrowRight, Check, ChevronDown, ChevronUp, Edit2, Flame } from "lucide-react";
import { collapseSetGroups, formatCollapsedSets } from "@/lib/format-sets";
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
  const muscles = useLiveQuery(() => db.muscleGroups.toArray(), []);
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

  /* ── Press-and-hold CTA state ── */
  const [holdProgress, setHoldProgress] = useState(0);
  const [isHolding, setIsHolding] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const holdTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const holdCompleteRef = useRef(false);

  const HOLD_DURATION_MS = 800; // total hold time
  const TICK_MS = 16; // ~60fps

  const clearHoldTimer = useCallback(() => {
    if (holdTimerRef.current) {
      clearInterval(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  }, []);

  const startHold = useCallback(() => {
    holdCompleteRef.current = false;
    setIsHolding(true);
    setHoldProgress(0);
    const startTime = Date.now();
    holdTimerRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / HOLD_DURATION_MS, 1);
      setHoldProgress(progress);
      if (progress >= 1 && !holdCompleteRef.current) {
        holdCompleteRef.current = true;
        clearInterval(holdTimerRef.current!);
        holdTimerRef.current = null;
        router.push("/workouts");
      }
    }, TICK_MS);
  }, [router, clearHoldTimer]);

  const cancelHold = useCallback(() => {
    clearHoldTimer();
    setIsHolding(false);
    setHoldProgress(0);
  }, [clearHoldTimer]);

  // Cleanup on unmount
  useEffect(() => () => clearHoldTimer(), [clearHoldTimer]);

  return (
    <div className="space-y-4">
      {/* ── Part A: Compact Dashboard Header ── */}
      <div className="rounded-3xl border border-border/60 bg-gradient-to-br from-card/95 via-card/90 to-accent/10 px-5 py-5 shadow-e3">
        {/* ── Date heading with press-and-hold CTA ── */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div
            className={cn(
              "relative select-none rounded-2xl px-4 py-3 transition-all duration-200 cursor-pointer overflow-hidden",
              isHovering || isHolding
                ? "bg-primary/8 border border-primary/20 shadow-[0_4px_16px_-6px_hsl(var(--primary)/0.2)]"
                : "border border-transparent"
            )}
            onMouseEnter={() => setIsHovering(true)}
            onMouseLeave={() => { setIsHovering(false); cancelHold(); }}
            onMouseDown={startHold}
            onMouseUp={cancelHold}
            onTouchStart={startHold}
            onTouchEnd={cancelHold}
            onTouchCancel={cancelHold}
            onContextMenu={(e) => e.preventDefault()}
          >
            {/* Fill progress bar */}
            {isHolding && (
              <div
                className="absolute inset-0 bg-primary/12 transition-none"
                style={{ width: `${holdProgress * 100}%` }}
              />
            )}
            <div className="relative z-10">
              <h1 className="text-2xl font-semibold tracking-[-0.04em]">
                {format(new Date(), "EEEE")}{" "}
                <span className="text-sm font-normal text-muted-foreground">{format(new Date(), "MMM d")}</span>
              </h1>
              {(isHovering || isHolding) && (
                <p className="mt-1 flex items-center gap-1.5 text-xs font-medium text-primary/70 animate-in fade-in duration-150">
                  <ArrowRight className="h-3 w-3" />
                  {isHolding ? "hold to log…" : `Log ${format(new Date(), "EEE, MMM d")}`}
                </p>
              )}
            </div>
          </div>
          {recentWorkout && (
            <span className="mt-3 shrink-0 text-xs text-muted-foreground/70">
              Last workout: {formatDistanceToNowStrict(parseISO(recentWorkout.sessionEndedAt ?? recentWorkout.sessionStartedAt ?? recentWorkout.updatedAt), { addSuffix: true })}
            </span>
          )}
        </div>

        {/* Weekly Calendar with Inverted Volume Bars */}
        <div className="grid grid-cols-7 gap-2">
          {(metrics?.perDay ?? []).map((day) => {
            const maxVol = Math.max(...dailyVolumes, 1);
            const intensity = day.volume / maxVol;
            const isToday = day.date === todayIso;
            const barHeight = day.volume > 0 ? Math.max(6, intensity * 28) : 0;
            return (
              <div
                key={day.date}
                className={cn(
                  "flex flex-col items-center rounded-xl px-1 py-1.5 transition-colors",
                  isToday ? "bg-accent/50 ring-1 ring-primary/20" : "bg-background/40"
                )}
              >
                {/* Day label */}
                <span className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                  {format(parseISO(day.date), "EEE")}
                </span>
                {/* Inverted bar — grows downward */}
                <div className="mt-1 flex w-full justify-center" style={{ minHeight: "32px" }}>
                  {barHeight > 0 ? (
                    <div
                      className={cn(
                        "w-full max-w-[22px] rounded-b-md transition-all",
                        intensity > 0.6
                          ? "bg-primary"
                          : intensity > 0.3
                            ? "bg-primary/60"
                            : "bg-primary/30"
                      )}
                      style={{ height: `${barHeight}px` }}
                    />
                  ) : (
                    <div className="w-full max-w-[22px] h-[3px] rounded-full bg-muted-foreground/10 mt-0" />
                  )}
                </div>
                {/* Volume label */}
                {day.volume > 0 && (
                  <span className="mt-1 text-[9px] font-medium text-primary/70 tabular-nums">
                    {Math.round(day.volume).toLocaleString()}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Part B: Consolidated Stats Strip ── */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-border/50 bg-card/80 px-4 py-3.5 shadow-e2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Weekly Volume</p>
          <p className="mt-1 text-2xl font-semibold tracking-[-0.04em] tabular-nums">
            {Math.round(metrics?.totalVolume ?? 0).toLocaleString()}<span className="ml-1 text-sm font-normal text-muted-foreground">kg</span>
          </p>
          <p className="mt-0.5 text-[10px] text-muted-foreground">this week</p>
        </div>

        <div className="rounded-2xl border border-border/50 bg-card/80 px-4 py-3.5 shadow-e2">
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

      {/* ── Past 4 Weeks Overview ── */}
      {summary30 && (
        <div className="rounded-2xl border border-border/40 bg-card/60 px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground mb-2">Last 4 weeks</p>
          <div className="flex items-center justify-between gap-4">
            <p className="text-xs font-medium text-foreground">
              {summary30.completedCount} sessions · {summary30.totalVolume.toLocaleString()}kg
            </p>
            {summary30.weeklyVolumes && summary30.weeklyVolumes.some(v => v > 0) && (
              <MiniSparkline values={summary30.weeklyVolumes} className="text-muted-foreground" />
            )}
          </div>
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
                title="No workouts yet"
                description="Start logging to build your history."
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
      <div className="h-12 animate-pulse rounded-2xl border border-border/40 bg-card/40" />
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
        className="flex w-full items-center gap-3 rounded-2xl border border-border/50 bg-card/60 px-4 py-3 text-left transition-all hover:bg-card/80"
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
    <div className="rounded-2xl border border-border/50 bg-card/70 overflow-hidden">
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
                  <span className="text-[10px] text-muted-foreground">
                    {formatCollapsedSets(collapseSetGroups(item.sets))}
                  </span>
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
