"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Bar, BarChart, CartesianGrid, Line, LineChart, Tooltip, XAxis, YAxis } from "recharts";
import { getExerciseProgress, getWeeklyMetrics } from "@/lib/analytics";
import { db } from "@/lib/db";
import { localDateIso } from "@/lib/utils";
import { PageIntro } from "@/components/layout/page-intro";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

const axisColor = "#6b7280";
const gridColor = "rgba(148, 163, 184, 0.24)";
const primaryBar = "#0f7c90";
const accentBar = "#cb8f24";
const primaryLine = "#0f7c90";
const accentLine = "#cb8f24";
const tooltipStyle = {
  backgroundColor: "rgba(255, 255, 255, 0.97)",
  borderColor: "rgba(148, 163, 184, 0.28)",
  borderRadius: "18px",
  boxShadow: "0 24px 60px -36px rgba(15, 23, 42, 0.45)"
} as const;

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
    <div ref={containerRef} className="min-w-0 w-full" style={{ height }}>
      {width > 0 ? children({ width, height }) : null}
    </div>
  );
}

export function AnalyticsView() {
  const today = localDateIso(new Date());
  const metrics = useLiveQuery(() => getWeeklyMetrics(today), [today]);
  const muscles = useLiveQuery(() => db.muscles.toArray(), []);
  const exercises = useLiveQuery(() => db.exercises.orderBy("name").toArray(), []);
  const [exerciseId, setExerciseId] = useState("");
  const progress = useLiveQuery(() => (exerciseId ? getExerciseProgress(exerciseId) : Promise.resolve([])), [exerciseId]);

  const muscleRows = Object.entries(metrics?.byMuscle ?? {})
    .map(([muscleId, volume]) => ({ name: muscles?.find((m) => m.id === muscleId)?.name ?? "Unknown", volume: Math.round(volume) }))
    .sort((a, b) => b.volume - a.volume)
    .slice(0, 8);

  const exerciseRows = Object.entries(metrics?.byExercise ?? {})
    .map(([name, volume]) => ({ name, volume: Math.round(volume) }))
    .sort((a, b) => b.volume - a.volume)
    .slice(0, 8);
  const activeDays = (metrics?.perDay ?? []).filter((day) => day.volume > 0).length;
  const topExercise = exerciseRows[0]?.name ?? "No exercise data";

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Performance Readout"
        title="Analytics"
        description="Track weekly workload, spot which muscles and exercises are carrying the most volume, and review progress without changing how anything is logged."
        meta={
          <>
            <Badge className="bg-accent px-3 py-1 text-accent-foreground">Weekly volume {Math.round(metrics?.totalVolume ?? 0)}</Badge>
            <Badge>{activeDays} active day{activeDays === 1 ? "" : "s"}</Badge>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="overflow-hidden">
          <CardHeader className="pb-3">
            <CardDescription className="text-[0.72rem] font-semibold uppercase tracking-[0.2em] text-primary/70">
              Weekly Total
            </CardDescription>
            <CardTitle className="text-3xl">{Math.round(metrics?.totalVolume ?? 0)}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Formula: set volume = reps × weight. Primary muscles count 100%, secondary muscles count 50%.
            </p>
          </CardContent>
        </Card>
        <Card className="overflow-hidden">
          <CardHeader className="pb-3">
            <CardDescription className="text-[0.72rem] font-semibold uppercase tracking-[0.2em] text-primary/70">
              Muscles Tracked
            </CardDescription>
            <CardTitle className="text-3xl">{muscleRows.length}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Top eight muscles by weighted volume are shown in the weekly chart.</p>
          </CardContent>
        </Card>
        <Card className="overflow-hidden">
          <CardHeader className="pb-3">
            <CardDescription className="text-[0.72rem] font-semibold uppercase tracking-[0.2em] text-primary/70">
              Leading Exercise
            </CardDescription>
            <CardTitle className="text-2xl">{topExercise}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Highest-volume exercise across the current weekly window.</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="min-w-0 overflow-hidden">
          <CardHeader className="pb-3">
            <CardTitle>Volume by Muscle (Week)</CardTitle>
            <CardDescription>Weighted weekly muscle distribution for the current training window.</CardDescription>
          </CardHeader>
          <CardContent className="min-w-0">
            {muscleRows.length > 0 ? (
              <MeasuredChart height={288}>
                {({ width, height }) => (
                  <BarChart width={width} height={height} data={muscleRows}>
                    <CartesianGrid strokeDasharray="4 4" vertical={false} stroke={gridColor} />
                    <XAxis dataKey="name" tick={{ fontSize: 12, fill: axisColor }} interval={0} angle={-20} textAnchor="end" height={70} stroke={axisColor} />
                    <YAxis tick={{ fontSize: 12, fill: axisColor }} stroke={axisColor} />
                    <Tooltip cursor={false} contentStyle={tooltipStyle} labelStyle={{ color: "#111827" }} />
                    <Bar dataKey="volume" fill={primaryBar} radius={[8, 8, 4, 4]} stroke={primaryBar} strokeWidth={1.2} />
                  </BarChart>
                )}
              </MeasuredChart>
            ) : (
              <EmptyState title="No muscle volume yet" description="Log sets to populate analytics." />
            )}
          </CardContent>
        </Card>

        <Card className="min-w-0 overflow-hidden">
          <CardHeader className="pb-3">
            <CardTitle>Volume by Exercise (Week)</CardTitle>
            <CardDescription>See which individual movements are driving the most work this week.</CardDescription>
          </CardHeader>
          <CardContent className="min-w-0">
            {exerciseRows.length > 0 ? (
              <MeasuredChart height={288}>
                {({ width, height }) => (
                  <BarChart width={width} height={height} data={exerciseRows}>
                    <CartesianGrid strokeDasharray="4 4" vertical={false} stroke={gridColor} />
                    <XAxis dataKey="name" tick={{ fontSize: 12, fill: axisColor }} interval={0} angle={-20} textAnchor="end" height={70} stroke={axisColor} />
                    <YAxis tick={{ fontSize: 12, fill: axisColor }} stroke={axisColor} />
                    <Tooltip cursor={false} contentStyle={tooltipStyle} labelStyle={{ color: "#111827" }} />
                    <Bar dataKey="volume" fill={accentBar} radius={[8, 8, 4, 4]} stroke={accentBar} strokeWidth={1.2} />
                  </BarChart>
                )}
              </MeasuredChart>
            ) : (
              <EmptyState title="No exercise volume yet" description="Log a workout to see this chart." />
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <CardHeader className="pb-4">
          <CardTitle>Exercise Progress</CardTitle>
          <CardDescription>Pick an exercise to review max weight and estimated one-rep max over time.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-[1.2rem] border border-border/70 bg-background/55 p-4">
            <Label htmlFor="exercise-progress">Choose Exercise</Label>
            <Select id="exercise-progress" value={exerciseId} onChange={(e) => setExerciseId(e.target.value)}>
              <option value="">Select exercise</option>
              {(exercises ?? []).map((exercise) => (
                <option key={exercise.id} value={exercise.id}>
                  {exercise.name}
                </option>
              ))}
            </Select>
          </div>

          {exerciseId && progress && progress.length > 0 ? (
            <div className="space-y-4">
              <div className="grid gap-4 xl:grid-cols-2">
                <div className="rounded-[1.25rem] border border-border/70 bg-background/55 p-4">
                  <p className="mb-3 text-[0.72rem] font-semibold uppercase tracking-[0.2em] text-primary/70">Max Weight</p>
                  <MeasuredChart height={256}>
                    {({ width, height }) => (
                      <LineChart width={width} height={height} data={progress}>
                        <CartesianGrid strokeDasharray="4 4" stroke={gridColor} />
                        <XAxis dataKey="date" tick={{ fontSize: 12, fill: axisColor }} stroke={axisColor} />
                        <YAxis tick={{ fontSize: 12, fill: axisColor }} stroke={axisColor} />
                        <Tooltip cursor={false} contentStyle={tooltipStyle} labelStyle={{ color: "#111827" }} />
                        <Line type="monotone" dataKey="maxWeight" stroke={primaryLine} strokeWidth={2.6} dot={false} activeDot={{ r: 5 }} />
                      </LineChart>
                    )}
                  </MeasuredChart>
                </div>
                <div className="rounded-[1.25rem] border border-border/70 bg-background/55 p-4">
                  <p className="mb-3 text-[0.72rem] font-semibold uppercase tracking-[0.2em] text-primary/70">Estimated 1RM</p>
                  <MeasuredChart height={256}>
                    {({ width, height }) => (
                      <LineChart width={width} height={height} data={progress}>
                        <CartesianGrid strokeDasharray="4 4" stroke={gridColor} />
                        <XAxis dataKey="date" tick={{ fontSize: 12, fill: axisColor }} stroke={axisColor} />
                        <YAxis tick={{ fontSize: 12, fill: axisColor }} stroke={axisColor} />
                        <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: "#111827" }} />
                        <Line type="monotone" dataKey="bestE1rm" stroke={accentLine} strokeWidth={2.6} dot={false} activeDot={{ r: 5 }} />
                      </LineChart>
                    )}
                  </MeasuredChart>
                </div>
              </div>
            </div>
          ) : (
            <EmptyState title="No progress data" description="Select an exercise with logged sets over time." />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
