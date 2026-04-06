"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Bar, BarChart, CartesianGrid, Line, LineChart, Tooltip, XAxis, YAxis } from "recharts";
import { getExerciseProgress, getWeeklyMetrics } from "@/lib/analytics";
import { db } from "@/lib/db";
import { localDateIso } from "@/lib/utils";
import { useTheme } from "@/components/layout/theme-provider";
import { PageIntro } from "@/components/layout/page-intro";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Combobox } from "@/components/ui/combobox";

/** Resolve a CSS custom property like "--primary" to a concrete color string. */
function resolveCssColor(varName: string): string {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  return raw ? `hsl(${raw})` : "#888";
}

/** Derive a secondary chart color by shifting the primary hue ~140° (near-complementary). */
function deriveSecondary(primaryHsl: string): string {
  const match = primaryHsl.match(/hsl\(\s*([\d.]+)\s+([\d.]+)%\s+([\d.]+)%\s*\)/);
  if (!match) return primaryHsl;
  const h = (parseFloat(match[1]) + 140) % 360;
  const s = Math.min(parseFloat(match[2]), 65);
  const l = parseFloat(match[3]);
  return `hsl(${h} ${s}% ${l}%)`;
}

/** Hook that returns concrete chart colors, re-resolved whenever theme/palette changes. */
function useChartColors() {
  const { theme, palette } = useTheme();
  const [colors, setColors] = useState({
    axis: "#888",
    grid: "#888",
    primary: "#888",
    secondary: "#888",
    cardBg: "#fff",
    cardBorder: "#ddd",
    cardFg: "#000",
  });

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      const primary = resolveCssColor("--primary");
      setColors({
        axis: resolveCssColor("--muted-foreground"),
        grid: resolveCssColor("--border"),
        primary,
        secondary: deriveSecondary(primary),
        cardBg: resolveCssColor("--card"),
        cardBorder: resolveCssColor("--border"),
        cardFg: resolveCssColor("--card-foreground"),
      });
    });
    return () => cancelAnimationFrame(id);
  }, [theme, palette]);

  return colors;
}

function MeasuredChart({
  height,
  children
}: {
  height: number;
  children: (size: { width: number; height: number }) => ReactNode;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const updateWidth = () => {
      setWidth(Math.max(0, Math.floor(element.getBoundingClientRect().width)));
    };

    updateWidth();

    const observer = new ResizeObserver(() => {
      updateWidth();
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={containerRef} className="min-w-0 w-full outline-none" style={{ height }}>
      {width > 0 ? children({ width, height }) : null}
    </div>
  );
}

export function AnalyticsView() {
  const today = localDateIso(new Date());
  const metrics = useLiveQuery(() => getWeeklyMetrics(today), [today]);
  const muscles = useLiveQuery(() => db.muscleGroups.toArray(), []);
  const exercises = useLiveQuery(() => db.exercises.orderBy("name").toArray(), []);
  const [exerciseId, setExerciseId] = useState("");
  const progress = useLiveQuery(() => (exerciseId ? getExerciseProgress(exerciseId) : Promise.resolve([])), [exerciseId]);
  const cc = useChartColors();

  const tooltipStyle = {
    backgroundColor: cc.cardBg,
    borderColor: cc.cardBorder,
    color: cc.cardFg,
    borderRadius: "16px",
    boxShadow: "0 16px 40px -20px rgba(0,0,0,0.3)",
    fontSize: "12px",
  };

  const muscleRows = Object.entries(metrics?.byMuscle ?? {})
    .map(([muscleId, volume]) => ({ name: muscles?.find((m) => m.id === muscleId)?.name ?? "Unknown", volume: Math.round(volume) }))
    .sort((a, b) => b.volume - a.volume)
    .slice(0, 8);

  const exerciseRows = Object.entries(metrics?.byExercise ?? {})
    .map(([name, volume]) => ({ name, volume: Math.round(volume) }))
    .sort((a, b) => b.volume - a.volume)
    .slice(0, 8);
  const activeDays = (metrics?.perDay ?? []).filter((day) => day.volume > 0).length;
  const topExercise = exerciseRows[0]?.name ?? "No data";

  return (
    <div className="space-y-5 stagger-children">
      <PageIntro
        title="Analytics"
        description="Weekly volume and progress."
        meta={
          <>
            <Badge className="bg-primary/8 text-primary/80 border-primary/10 px-3 py-1">{Math.round(metrics?.totalVolume ?? 0).toLocaleString()} kg this week</Badge>
            <Badge className="bg-muted/50 text-muted-foreground border-border/40">{activeDays} active day{activeDays === 1 ? "" : "s"}</Badge>
          </>
        }
      />

      {/* Stats Row */}
      <div className="grid gap-3 grid-cols-3">
        <div className="rounded-2xl border border-border/30 bg-card/75 p-4 text-center shadow-e1 backdrop-blur-lg">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/70">Weekly Total</p>
          <p className="mt-1.5 text-2xl font-bold tracking-[-0.04em] tabular-nums animate-count-up">
            {Math.round(metrics?.totalVolume ?? 0).toLocaleString()}
          </p>
          <p className="text-[10px] text-muted-foreground/50">kg</p>
        </div>

        <div className="rounded-2xl border border-border/30 bg-card/75 p-4 text-center shadow-e1 backdrop-blur-lg">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/70">Muscles</p>
          <p className="mt-1.5 text-2xl font-bold tracking-[-0.04em] animate-count-up">{muscleRows.length}</p>
          <p className="text-[10px] text-muted-foreground/50">tracked</p>
        </div>

        <div className="rounded-2xl border border-border/30 bg-card/75 p-4 text-center shadow-e1 backdrop-blur-lg overflow-hidden">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/70">Top Exercise</p>
          <p className="mt-1.5 text-sm font-bold tracking-[-0.02em] truncate">{topExercise}</p>
          <p className="text-[10px] text-muted-foreground/50">this week</p>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-border/30 bg-card/75 overflow-hidden shadow-e1 backdrop-blur-lg">
          <div className="px-5 pt-5 pb-3">
            <p className="text-sm font-semibold tracking-[-0.02em]">Volume by Muscle</p>
          </div>
          <div className="px-5 pb-5">
            {muscleRows.length > 0 ? (
              <MeasuredChart height={288}>
                {({ width, height }) => (
                  <BarChart width={width} height={height} data={muscleRows}>
                    <CartesianGrid strokeDasharray="4 4" vertical={false} stroke={cc.grid} opacity={0.4} />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: cc.axis }} interval={0} angle={-20} textAnchor="end" height={70} stroke={cc.grid} strokeWidth={0.5} />
                    <YAxis tick={{ fontSize: 11, fill: cc.axis }} stroke={cc.grid} strokeWidth={0.5} />
                    <Tooltip cursor={false} contentStyle={tooltipStyle} labelStyle={{ color: cc.cardFg }} />
                    <Bar dataKey="volume" fill={cc.primary} radius={[6, 6, 2, 2]} stroke={cc.primary} strokeWidth={0} opacity={0.85} />
                  </BarChart>
                )}
              </MeasuredChart>
            ) : (
              <EmptyState title="No muscle volume yet" description="Log workouts to see data." />
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-border/30 bg-card/75 overflow-hidden shadow-e1 backdrop-blur-lg">
          <div className="px-5 pt-5 pb-3">
            <p className="text-sm font-semibold tracking-[-0.02em]">Volume by Exercise</p>
          </div>
          <div className="px-5 pb-5">
            {exerciseRows.length > 0 ? (
              <MeasuredChart height={288}>
                {({ width, height }) => (
                  <BarChart width={width} height={height} data={exerciseRows}>
                    <CartesianGrid strokeDasharray="4 4" vertical={false} stroke={cc.grid} opacity={0.4} />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: cc.axis }} interval={0} angle={-20} textAnchor="end" height={70} stroke={cc.grid} strokeWidth={0.5} />
                    <YAxis tick={{ fontSize: 11, fill: cc.axis }} stroke={cc.grid} strokeWidth={0.5} />
                    <Tooltip cursor={false} contentStyle={tooltipStyle} labelStyle={{ color: cc.cardFg }} />
                    <Bar dataKey="volume" fill={cc.secondary} radius={[6, 6, 2, 2]} stroke={cc.secondary} strokeWidth={0} opacity={0.85} />
                  </BarChart>
                )}
              </MeasuredChart>
            ) : (
              <EmptyState title="No exercise volume yet" description="Log workouts to see data." />
            )}
          </div>
        </div>
      </div>

      {/* Exercise Progress */}
      <div className="rounded-2xl border border-border/30 bg-card/75 overflow-hidden shadow-e1 backdrop-blur-lg">
        <div className="px-5 pt-5 pb-3">
          <p className="text-sm font-semibold tracking-[-0.02em]">Exercise Progress</p>
          <p className="text-xs text-muted-foreground/60 mt-0.5">Track max weight and estimated 1RM over time.</p>
        </div>
        <div className="px-5 pb-5 space-y-4">
          <div className="rounded-xl border border-border/30 bg-background/40 p-3">
            <Combobox
              options={(exercises ?? []).map((e) => ({ value: e.id, label: e.name }))}
              value={exerciseId}
              onChange={setExerciseId}
              placeholder="Search exercises..."
            />
          </div>

          {exerciseId && progress && progress.length > 0 ? (
            <div className="grid gap-4 xl:grid-cols-2">
              <div className="rounded-xl border border-border/30 bg-background/30 p-4 backdrop-blur-sm">
                <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-primary/70">Max Weight</p>
                <MeasuredChart height={240}>
                  {({ width, height }) => (
                    <LineChart width={width} height={height} data={progress}>
                      <CartesianGrid strokeDasharray="4 4" stroke={cc.grid} opacity={0.3} />
                      <XAxis dataKey="date" tick={{ fontSize: 11, fill: cc.axis }} stroke={cc.grid} strokeWidth={0.5} />
                      <YAxis tick={{ fontSize: 11, fill: cc.axis }} stroke={cc.grid} strokeWidth={0.5} />
                      <Tooltip cursor={false} contentStyle={tooltipStyle} labelStyle={{ color: cc.cardFg }} />
                      <Line type="monotone" dataKey="maxWeight" stroke={cc.primary} strokeWidth={2.5} dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
                    </LineChart>
                  )}
                </MeasuredChart>
              </div>
              <div className="rounded-xl border border-border/30 bg-background/30 p-4 backdrop-blur-sm">
                <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-primary/70">Estimated 1RM</p>
                <MeasuredChart height={240}>
                  {({ width, height }) => (
                    <LineChart width={width} height={height} data={progress}>
                      <CartesianGrid strokeDasharray="4 4" stroke={cc.grid} opacity={0.3} />
                      <XAxis dataKey="date" tick={{ fontSize: 11, fill: cc.axis }} stroke={cc.grid} strokeWidth={0.5} />
                      <YAxis tick={{ fontSize: 11, fill: cc.axis }} stroke={cc.grid} strokeWidth={0.5} />
                      <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: cc.cardFg }} />
                      <Line type="monotone" dataKey="bestE1rm" stroke={cc.secondary} strokeWidth={2.5} dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
                    </LineChart>
                  )}
                </MeasuredChart>
              </div>
            </div>
          ) : (
            <EmptyState title="No progress data" description="Select an exercise to see trends." />
          )}
        </div>
      </div>
    </div>
  );
}
