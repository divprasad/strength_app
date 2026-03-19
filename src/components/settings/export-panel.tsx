"use client";

import { useState } from "react";
import { db } from "@/lib/db";
import { payloadToCsvMap, payloadToJson } from "@/lib/export";
import { nowIso, triggerDownload } from "@/lib/utils";
import type { ExportPayload } from "@/types/domain";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

async function buildPayload(): Promise<ExportPayload> {
  const [muscleGroups, exercises, workouts, workoutExercises, setEntries, settings] = await Promise.all([
    db.muscles.toArray(),
    db.exercises.toArray(),
    db.workouts.toArray(),
    db.workoutExercises.toArray(),
    db.setEntries.toArray(),
    db.settings.get("default")
  ]);

  return {
    exportedAt: nowIso(),
    version: "1.0.0",
    settings: settings ?? { id: "default", volumePrimaryMultiplier: 1, volumeSecondaryMultiplier: 0.5 },
    muscleGroups,
    exercises,
    workouts,
    workoutExercises,
    setEntries
  };
}

export function ExportPanel() {
  const [status, setStatus] = useState("");

  async function exportJson() {
    const payload = await buildPayload();
    triggerDownload(`strength-export-${new Date().toISOString().slice(0, 10)}.json`, payloadToJson(payload), "application/json");
    setStatus("JSON export downloaded.");
  }

  async function exportCsv() {
    const payload = await buildPayload();
    const csvMap = payloadToCsvMap(payload);
    for (const [name, csv] of Object.entries(csvMap)) {
      triggerDownload(`${name}.csv`, csv, "text/csv;charset=utf-8");
    }
    setStatus("CSV export downloaded as separate tables.");
  }

  async function importJson(file: File) {
    const text = await file.text();
    const payload = JSON.parse(text) as ExportPayload;

    await db.muscles.clear();
    await db.exercises.clear();
    await db.workouts.clear();
    await db.workoutExercises.clear();
    await db.setEntries.clear();
    await db.settings.clear();

    await db.muscles.bulkPut(payload.muscleGroups);
    await db.exercises.bulkPut(payload.exercises);
    await db.workouts.bulkPut(payload.workouts);
    await db.workoutExercises.bulkPut(payload.workoutExercises);
    await db.setEntries.bulkPut(payload.setEntries);
    await db.settings.put(payload.settings);

    setStatus("Import complete.");
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Export Data</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">Export includes exercises, muscles, workouts, workout-exercises, set entries, and settings.</p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={exportJson}>Export JSON</Button>
            <Button variant="secondary" onClick={exportCsv}>
              Export CSV Tables
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Import JSON (Optional)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            type="file"
            accept="application/json"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                void importJson(file);
              }
            }}
          />
          <p className="text-xs text-muted-foreground">Import replaces local data fully.</p>
        </CardContent>
      </Card>

      {status ? <p className="text-sm text-muted-foreground">{status}</p> : null}
    </div>
  );
}
