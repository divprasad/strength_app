"use client";

import { format, formatDistanceToNowStrict, parseISO } from "date-fns";
import { useLiveQuery } from "dexie-react-hooks";
import { useRouter } from "next/navigation";
import { useState, useRef, useCallback, useEffect } from "react";
import { getWeeklyMetrics, get28DaySummary } from "@/lib/analytics";
import { db } from "@/lib/db";
import { localDateIso } from "@/lib/utils";
import { getWorkoutBundle } from "@/lib/repository";
import { ArrowRight, Check, ChevronDown, ChevronUp, Edit2, Flame, Trophy } from "lucide-react";
import { collapseSetGroups, formatCollapsedSets } from "@/lib/format-sets";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import { computeDurationSeconds, formatDurationLong, formatDurationRounded, formatTimeOfDay } from "@/lib/time";
import type { Workout, MuscleGroup } from "@/types/domain";

/* ─── helpers ─── */

function formatRelativeShort(iso: string): string {
  const dist = formatDistanceToNowStrict(parseISO(iso));
  return dist
    .replace(/ years?/, "y")
    .replace(/ months?/, "mo")
    .replace(/ weeks?/, "w")
    .replace(/ days?/, "d")
    .replace(/ hours?/, "h")
    .replace(/ minutes?/, "m")
    .replace(/ seconds?/, "s") + " ago";
}

function MiniSparkline({ values, className }: { values: number[]; className?: string }) {
  const max = Math.max(...values, 1);
  return (
    <div className={cn("flex items-end gap-[3px]", className)}>
      {values.map((v, i) => (
        <div
          key={i}
          className="w-[5px] rounded-sm bg-current opacity-60 transition-all duration-500 ease-spring"
          style={{ height: `${Math.max(3, (v / max) * 20)}px` }}
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
  const summary28 = useLiveQuery(() => get28DaySummary(), []);
  const settings = useLiveQuery(() => db.settings.get("default"), []);

  const topMuscles = Object.entries(metrics?.byMuscle ?? {})
    .map(([muscleId, volume]) => {
      const muscle = muscles?.find((m) => m.id === muscleId);
      return { id: muscleId, muscleName: muscle?.name ?? "Unknown", volume, exists: !!muscle };
    })
    .filter((m) => m.exists)
    .sort((a, b) => b.volume - a.volume)
    .slice(0, 3);

  const recentWorkout = recent?.[0];
  const dailyVolumes = (metrics?.perDay ?? []).map(d => d.volume);

  /* ── Press-and-hold CTA state ── */
  const [holdProgress, setHoldProgress] = useState(0);
  const [isHolding, setIsHolding] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const holdTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const holdCompleteRef = useRef(false);

  const HOLD_DURATION_MS = 800;
  const TICK_MS = 16;

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
  }, [router]);

  const cancelHold = useCallback(() => {
    clearHoldTimer();
    setIsHolding(false);
    setHoldProgress(0);
  }, [clearHoldTimer]);

  // Cleanup on unmount
  useEffect(() => () => clearHoldTimer(), [clearHoldTimer]);

  return (
    <div className="space-y-4 stagger-children">
      {/* ── Part A: Dashboard Hero ── */}
      <div className="rounded-2xl border border-border/30 bg-gradient-to-br from-card/90 via-card/85 to-transparent px-5 py-5 shadow-e2 backdrop-blur-lg">
        {/* Date heading with press-and-hold CTA */}
        <div className="flex items-start justify-between gap-3 mb-5">
          <div
            className={cn(
              "relative select-none rounded-xl px-4 py-3 transition-all duration-200 ease-spring cursor-pointer overflow-hidden active:scale-[0.98]",
              isHovering || isHolding
                ? "bg-primary/8 ring-1 ring-primary/15 shadow-[0_0_20px_-6px_hsl(var(--primary)/0.15)]"
                : ""
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
                className="absolute inset-0 bg-primary/10 transition-none rounded-xl"
                style={{ width: `${holdProgress * 100}%` }}
              />
            )}
            <div className="relative z-10">
              <h1 className="text-2xl font-bold tracking-[-0.04em]">
                {format(new Date(), "EEEE")}{" "}
                <span className="text-sm font-normal text-muted-foreground/70">{format(new Date(), "MMM d")}</span>
              </h1>
              {(isHovering || isHolding) && (
                <p className="mt-1 flex items-center gap-1.5 text-xs font-medium text-primary/80 animate-fade-in">
                  <ArrowRight className="h-3 w-3" />
                  {isHolding ? "hold to log…" : "start logging"}
                </p>
              )}
            </div>
          </div>
          {recentWorkout && (
            <span className="mt-3 shrink-0 text-[11px] text-muted-foreground/50 tabular-nums">
              Last: {formatRelativeShort(recentWorkout.sessionEndedAt ?? recentWorkout.sessionStartedAt ?? recentWorkout.updatedAt)}
            </span>
          )}
        </div>

        {/* Weekly Calendar with Volume Bars */}
        <div className="grid grid-cols-7 gap-1.5">
          {(metrics?.perDay ?? []).map((day) => {
            const maxVol = Math.max(...dailyVolumes, 1);
            const intensity = day.volume / maxVol;
            const isToday = day.date === todayIso;
            const barHeight = day.volume > 0 ? Math.max(6, intensity * 32) : 0;
            return (
              <div
                key={day.date}
                className={cn(
                  "flex flex-col items-center rounded-xl px-1 py-2 transition-all duration-300",
                  isToday ? "bg-primary/8 ring-1 ring-primary/15" : ""
                )}
              >
                <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground/70">
                  {format(parseISO(day.date), "EEE")}
                </span>
                <div className="mt-1.5 flex w-full justify-center" style={{ minHeight: "36px" }}>
                  {barHeight > 0 ? (
                    <div
                      className={cn(
                        "w-full max-w-[20px] rounded-md transition-all duration-500 ease-spring",
                        intensity > 0.6
                          ? "bg-gradient-to-t from-primary to-primary/70"
                          : intensity > 0.3
                            ? "bg-primary/50"
                            : "bg-primary/25"
                      )}
                      style={{ height: `${barHeight}px` }}
                    />
                  ) : (
                    <div className="w-full max-w-[20px] h-[2px] rounded-full bg-border/60 mt-0" />
                  )}
                </div>
                {day.volume > 0 && (
                  <span className="mt-1 text-[9px] font-medium text-primary/60 tabular-nums">
                    {Math.round(day.volume).toLocaleString()}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Part B: Stats Grid ── */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-border/30 bg-card/75 px-4 py-3.5 shadow-e1 backdrop-blur-lg">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/70">Weekly Volume</p>
          <p className="mt-1.5 text-2xl font-bold tracking-[-0.04em] tabular-nums animate-count-up">
            {Math.round(metrics?.totalVolume ?? 0).toLocaleString()}<span className="ml-1 text-sm font-normal text-muted-foreground/60">kg</span>
          </p>
          <p className="mt-0.5 text-[10px] text-muted-foreground/50">this week</p>
        </div>

        <div className="rounded-2xl border border-border/30 bg-card/75 px-4 py-3.5 shadow-e1 backdrop-blur-lg">
          <div className="flex items-center gap-1.5">
            <Flame className="h-3 w-3 text-muted-foreground/60" />
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/70">Focus</p>
          </div>
          {topMuscles.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-1">
              {topMuscles.map((item) => (
                <Badge key={item.id} className="bg-primary/8 text-primary/70 border-primary/10 px-2 py-0 text-[10px] font-medium">
                  {item.muscleName}
                </Badge>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-xs text-muted-foreground/50">None yet</p>
          )}
        </div>
      </div>

      {/* ── Gym Cost Per Session Card ── */}
      {summary28 && (
        <GymCostCard
          sessionCount={summary28.completedCount}
          totalVolume={summary28.totalVolume}
          weeklyVolumes={summary28.weeklyVolumes}
          gymFee={settings?.gymFee ?? 48}
          targetCost={settings?.gymFeeTargetPerSession ?? 3}
        />
      )}

      {/* ── Part C: Recent Workouts ── */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between px-1">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground/70">Recent Sessions</p>
          <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground/60 hover:text-foreground" onClick={() => router.push("/history")}>
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
          <Card className="border-dashed border-border/40">
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

/* ─── Gym Cost Per Session Card ─── */

interface GymCostCardProps {
  sessionCount: number;
  totalVolume: number;
  weeklyVolumes: number[];
  gymFee: number;
  targetCost: number;
}

function GymCostCard({ sessionCount, totalVolume, weeklyVolumes, gymFee, targetCost }: GymCostCardProps) {
  const sessionsNeeded = Math.ceil(gymFee / targetCost);
  const costPerSession = sessionCount > 0 ? gymFee / sessionCount : gymFee;
  const progress = Math.min(sessionCount / sessionsNeeded, 1);
  const targetHit = costPerSession <= targetCost && sessionCount > 0;

  const costColor = targetHit
    ? "hsl(152, 56%, 39%)"
    : costPerSession <= targetCost * 2
      ? "hsl(38, 92%, 50%)"
      : "hsl(4, 72%, 50%)";

  const costColorClass = targetHit
    ? "text-success"
    : costPerSession <= targetCost * 2
      ? "text-amber-500"
      : "text-destructive";

  // SVG ring parameters
  const size = 76;
  const strokeWidth = 4;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - progress);

  return (
    <div className="rounded-2xl border border-border/30 bg-gradient-to-br from-card/85 to-card/65 px-5 py-4 shadow-e1 backdrop-blur-lg relative overflow-hidden">
      {/* Subtle background glow when target hit */}
      {targetHit && (
        <div className="absolute inset-0 bg-success/5 animate-fade-in" />
      )}

      <div className="relative z-10">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/70">
            Last 4 weeks
          </p>
          {targetHit && (
            <div className="flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 animate-scale-in">
              <Trophy className="h-3 w-3 text-success" />
              <span className="text-[10px] font-semibold text-success">Target hit!</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-5">
          {/* Circular progress ring */}
          <div className="relative shrink-0">
            <svg width={size} height={size} className="-rotate-90">
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke="hsl(var(--border) / 0.5)"
                strokeWidth={strokeWidth}
              />
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={costColor}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                className="transition-all duration-700 ease-spring"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={cn("text-lg font-bold tabular-nums tracking-[-0.03em]", costColorClass)}>
                €{costPerSession.toFixed(costPerSession < 10 ? 2 : 0)}
              </span>
              <span className="text-[7px] font-medium text-muted-foreground/60 uppercase tracking-wider">per session</span>
            </div>
          </div>

          {/* Stats & progress */}
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-sm font-medium text-foreground">
                {sessionCount} session{sessionCount !== 1 ? "s" : ""}
              </p>
              <p className="text-[10px] text-muted-foreground/60 tabular-nums">
                {totalVolume.toLocaleString()}kg
              </p>
            </div>

            {weeklyVolumes.some(v => v > 0) && (
              <MiniSparkline values={weeklyVolumes} className="text-muted-foreground/50" />
            )}

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[9px] text-muted-foreground/60">
                  {targetHit ? "🎯 " : ""}{sessionCount}/{sessionsNeeded} sessions
                </span>
                <span className="text-[9px] text-muted-foreground/60 tabular-nums">
                  Target: €{targetCost.toFixed(2)}
                </span>
              </div>
              <div className="h-1 w-full rounded-full bg-border/40 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700 ease-spring"
                  style={{
                    width: `${progress * 100}%`,
                    background: `linear-gradient(to right, ${costColor}99, ${costColor})`,
                  }}
                />
              </div>
            </div>
          </div>
        </div>
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
      <div className="h-12 animate-shimmer rounded-2xl border border-border/30 bg-gradient-to-r from-card/40 via-card/60 to-card/40" />
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
        className="flex w-full items-start gap-3 rounded-2xl border border-border/30 bg-card/60 px-4 py-3 text-left transition-all duration-200 ease-spring hover:bg-card/80 hover:shadow-e1 backdrop-blur-sm"
      >
        <Check className="h-4 w-4 shrink-0 text-success mt-0.5" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium truncate">{dateStr}</p>
          <p className="text-xs text-muted-foreground/60 truncate mt-0.5">
            {formatDurationRounded(durationSeconds)} · {topMusclesStr || "No muscles"} · {totalReps} reps · {Math.round(totalVolume).toLocaleString()}kg
          </p>
        </div>
        <div className="flex flex-col items-end shrink-0 gap-0.5">
          <span className="text-xs text-muted-foreground/50 tabular-nums">{timeStr}</span>
          <ChevronDown className="h-2.5 w-2.5 text-muted-foreground/40" />
        </div>
      </button>
    );
  }

  return (
    <div className="rounded-2xl border border-border/30 bg-card/70 overflow-hidden backdrop-blur-sm animate-scale-in">
      <button
        onClick={() => setExpanded(false)}
        className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-card/90 transition-colors"
      >
        <Check className="h-4 w-4 shrink-0 text-success mt-0.5" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium truncate">{dateStr}</p>
          <p className="text-[10px] text-muted-foreground/60 mt-0.5">
            {formatDurationRounded(durationSeconds)} · {totalReps} reps · {Math.round(totalVolume).toLocaleString()}kg vol
          </p>
        </div>
        <div className="flex flex-col items-end shrink-0 gap-0.5">
          <span className="text-xs text-muted-foreground/50 tabular-nums">{timeStr}</span>
          <ChevronUp className="h-2.5 w-2.5 text-muted-foreground/40" />
        </div>
      </button>
      <div className="border-t border-border/20 px-4 py-3 space-y-2">
        {bundle.items.map((item) => {
          const exerciseDuration = computeDurationSeconds(item.workoutExercise.startedAt, item.workoutExercise.completedAt);
          return (
            <div key={item.workoutExercise.id} className="flex items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium truncate">{item.exercise.name}</p>
                <div className="flex flex-wrap gap-1 mt-0.5">
                  <span className="text-[10px] text-muted-foreground/60">
                    {formatCollapsedSets(collapseSetGroups(item.sets))}
                  </span>
                </div>
              </div>
              <span className="text-[10px] text-muted-foreground/50 tabular-nums shrink-0">{formatDurationLong(exerciseDuration)}</span>
            </div>
          );
        })}
        <div className="flex gap-2 pt-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 rounded-full border border-border/30 px-3 text-[11px]"
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
