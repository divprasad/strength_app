"use client";

import { formatDistanceToNowStrict, parseISO } from "date-fns";
import { useLiveQuery } from "dexie-react-hooks";
import { useRouter } from "next/navigation";
import { getWeeklyMetrics } from "@/lib/analytics";
import { db } from "@/lib/db";
import { localDateIso } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Today</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">Start or continue today&apos;s session quickly.</p>
          <Button onClick={() => router.push("/workouts")}>Open Logger</Button>
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Weekly Volume</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{Math.round(metrics?.totalVolume ?? 0)}</p>
            <p className="text-xs text-muted-foreground">reps × weight</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Workouts This Week</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{(metrics?.perDay ?? []).filter((d) => d.volume > 0).length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Top Muscles</CardTitle>
          </CardHeader>
          <CardContent>
            {topMuscles.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {topMuscles.map((item) => (
                  <Badge key={item.muscleName}>{item.muscleName}</Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No logged volume yet.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Workouts</CardTitle>
        </CardHeader>
        <CardContent>
          {recent && recent.length > 0 ? (
            <ul className="space-y-2">
              {recent.map((workout) => (
                <li key={workout.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <p className="font-medium">{workout.date}</p>
                    <p className="text-xs text-muted-foreground">
                      Updated {formatDistanceToNowStrict(parseISO(workout.updatedAt), { addSuffix: true })}
                    </p>
                  </div>
                  <Button variant="ghost" onClick={() => router.push("/workouts")}>
                    Open
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="No workout history yet" description="Log your first workout to see trends and summaries." />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
