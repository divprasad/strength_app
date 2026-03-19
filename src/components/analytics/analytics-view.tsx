"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Bar, BarChart, CartesianGrid, Line, LineChart, Tooltip, XAxis, YAxis } from "recharts";
import { getExerciseProgress, getWeeklyMetrics } from "@/lib/analytics";
import { db } from "@/lib/db";
import { localDateIso } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Select } from "@/components/ui/select";

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

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Weekly Total Volume</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-semibold">{Math.round(metrics?.totalVolume ?? 0)}</p>
          <p className="text-sm text-muted-foreground">Formula: set volume = reps × weight. Primary muscles get 100%, secondary get 50% by default.</p>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>Volume by Muscle (Week)</CardTitle>
          </CardHeader>
          <CardContent className="min-w-0">
            {muscleRows.length > 0 ? (
              <MeasuredChart height={288}>
                {({ width, height }) => (
                  <BarChart width={width} height={height} data={muscleRows}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} interval={0} angle={-20} textAnchor="end" height={70} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="volume" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                )}
              </MeasuredChart>
            ) : (
              <EmptyState title="No muscle volume yet" description="Log sets to populate analytics." />
            )}
          </CardContent>
        </Card>

        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>Volume by Exercise (Week)</CardTitle>
          </CardHeader>
          <CardContent className="min-w-0">
            {exerciseRows.length > 0 ? (
              <MeasuredChart height={288}>
                {({ width, height }) => (
                  <BarChart width={width} height={height} data={exerciseRows}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} interval={0} angle={-20} textAnchor="end" height={70} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="volume" fill="hsl(var(--accent-foreground))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                )}
              </MeasuredChart>
            ) : (
              <EmptyState title="No exercise volume yet" description="Log a workout to see this chart." />
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Exercise Progress</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Select value={exerciseId} onChange={(e) => setExerciseId(e.target.value)}>
            <option value="">Select exercise</option>
            {(exercises ?? []).map((exercise) => (
              <option key={exercise.id} value={exercise.id}>
                {exercise.name}
              </option>
            ))}
          </Select>

          {exerciseId && progress && progress.length > 0 ? (
            <div className="space-y-4">
              <MeasuredChart height={256}>
                {({ width, height }) => (
                  <LineChart width={width} height={height} data={progress}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Line type="monotone" dataKey="maxWeight" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                  </LineChart>
                )}
              </MeasuredChart>
              <MeasuredChart height={256}>
                {({ width, height }) => (
                  <LineChart width={width} height={height} data={progress}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Line type="monotone" dataKey="bestE1rm" stroke="hsl(var(--accent-foreground))" strokeWidth={2} dot={false} />
                  </LineChart>
                )}
              </MeasuredChart>
            </div>
          ) : (
            <EmptyState title="No progress data" description="Select an exercise with logged sets over time." />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
