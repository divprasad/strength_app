"use client";

import { useState } from "react";
import { db } from "@/lib/db";
import { DEFAULT_USER_ID } from "@/lib/constants";
import { payloadToCsvMap, payloadToJson } from "@/lib/export";
import { runIntegrityAudit, healDatabase } from "@/lib/integrity-audit";
import { normalizeWorkoutExerciseOrder, syncEverythingToServer, checkServerSyncStatus } from "@/lib/repository";
import { bootstrapFromServer } from "@/lib/sync";
import { nowIso, fileTimestamp, triggerDownload } from "@/lib/utils";
import type { ExportPayload, IntegrityAuditReport } from "@/types/domain";
import { PageIntro } from "@/components/layout/page-intro";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  const [loading, setLoading] = useState(false); // Added loading state
  const [auditReport, setAuditReport] = useState<IntegrityAuditReport | null>(null);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState<string | null>(null);

  async function exportJson() {
    const payload = await buildPayload();

    // Derive filename metadata from the payload
    const total = payload.workouts.length;
    const lastWorkout = [...payload.workouts].sort((a, b) => a.date < b.date ? 1 : -1)[0];
    const lastDate = lastWorkout?.date ?? "none";

    // Sum reps × weight for all sets belonging to the last workout
    const lastWeIds = new Set(
      payload.workoutExercises
        .filter((we) => we.workoutId === lastWorkout?.id)
        .map((we) => we.id)
    );
    const lastVolume = Math.round(
      payload.setEntries
        .filter((s) => lastWeIds.has(s.workoutExerciseId))
        .reduce((sum, s) => sum + (s.reps ?? 0) * (s.weight ?? 0), 0)
    );

    const filename = `strength-export_${fileTimestamp()}_no${total}_${lastDate}_${lastVolume}kg.json`;
    triggerDownload(filename, payloadToJson(payload), "application/json");
    setStatus("JSON export downloaded.");
  }

  async function exportCsv() {
    const payload = await buildPayload();
    const csvMap = payloadToCsvMap(payload);
    const ts = fileTimestamp();
    for (const [name, csv] of Object.entries(csvMap)) {
      triggerDownload(`${name}-${ts}.csv`, csv, "text/csv;charset=utf-8");
    }
    setStatus("CSV export downloaded as separate tables.");
  }

  async function importJson(file: File) {
    setLoading(true); // Set loading true
    setStatus("Importing data...");
    try {
      const text = await file.text();
      const payload = JSON.parse(text) as ExportPayload;

      const clearServer = window.confirm(
        "Do you also want to clear all workouts from the SERVER? (Recommended for a clean import state)"
      );

      // 1. Safety Backup: Export current state before replacing it
      setStatus("Creating safety backup...");
      await exportJson();

      if (clearServer) {
        setStatus("Clearing server data...");
        const res = await fetch("/api/workouts", { method: "DELETE" });
        if (!res.ok) {
          alert("Failed to clear server data. Continuing with local replacement only.");
        }
      }

      // 2. Clear and replace atomically
      setStatus("Replacing local data...");
      await db.transaction("rw", [db.muscles, db.exercises, db.workouts, db.workoutExercises, db.setEntries, db.settings], async () => {
        await db.muscles.clear();
        await db.exercises.clear();
        await db.workouts.clear();
        await db.workoutExercises.clear();
        await db.setEntries.clear();
        await db.settings.clear();

        await db.muscles.bulkPut(payload.muscleGroups);
        await db.exercises.bulkPut(payload.exercises);
        await db.workouts.bulkPut(
          payload.workouts.map((workout) => {
            const hasStarted = Boolean(workout.sessionStartedAt);
            const hasEnded = Boolean(workout.sessionEndedAt);
            const autoStatus = hasStarted ? (hasEnded ? "completed" : "active") : "draft";

            return {
              ...workout,
              name: workout.name ?? `Workout ${workout.date}`,
              userId: workout.userId ?? DEFAULT_USER_ID,
              status: workout.status ?? autoStatus
            };
          })
        );
        await db.workoutExercises.bulkPut(payload.workoutExercises);
        await db.setEntries.bulkPut(payload.setEntries);
        await db.settings.put(payload.settings);
      });

      // Normalize exercise order for all imported workouts to fix any existing corruption
      for (const workout of payload.workouts) {
        await normalizeWorkoutExerciseOrder(workout.id);
      }
      
      // Auto-heal data in case the export had broken references, duplicate set numbers, or re-ordering issues
      await healDatabase();

      setStatus("Import complete. Safety backup downloaded. You may want to sync all data to the server.");
    } catch (error) {
      console.error("Import failed:", error);
      setStatus("Import failed. Check console for details.");
    } finally {
      setLoading(false); // Set loading false
    }
  }

  async function handleSyncToServer() {
    setLoading(true);
    setStatus("Checking for changes...");
    try {
      const hasChanges = await checkServerSyncStatus();
      
      if (!hasChanges) {
        setStatus("Nothing to sync ^_^");
        return;
      }

      const confirmed = window.confirm(
        "Changes detected! Are you sure you want to sync all local data to the server? This will push all muscle groups, exercises, and workouts to the SQL database."
      );
      if (!confirmed) return;

      setStatus("Syncing everything to server...");
      await syncEverythingToServer();
      setStatus("Global sync complete.");
    } catch (error) {
      console.error("Sync failed:", error);
      setStatus("Sync failed. Check console for details.");
    } finally {
      setLoading(false);
    }
  }

  async function handleResetFromServer() {
    const confirmed = window.confirm(
      "This will WIPE all your local data on THIS device and replace it with data from the server. Are you sure? ^_^"
    );
    if (!confirmed) return;

    setLoading(true);
    setStatus("Resetting and pulling from server...");
    try {
      await db.muscles.clear();
      await db.exercises.clear();
      await db.workouts.clear();
      await db.workoutExercises.clear();
      await db.setEntries.clear();
      await db.syncQueue.clear();

      await bootstrapFromServer();
      setStatus("Reset successfully pulled from server! ^_^");
    } catch (error) {
      console.error("Reset failed:", error);
      setStatus("Reset failed. Check console.");
    } finally {
      setLoading(false);
    }
  }

  async function runAudit() {
    setAuditLoading(true);
    setAuditError(null);
    try {
      const report = await runIntegrityAudit();
      setAuditReport(report);
    } catch (error) {
      setAuditError(error instanceof Error ? error.message : "Unable to run integrity audit.");
    } finally {
      setAuditLoading(false);
    }
  }

  async function runRepair() {
    setLoading(true);
    setStatus("Repairing data integrity...");
    try {
      const { healedCount } = await healDatabase();
      setStatus(`Repaired ${healedCount} entries. Running audit...`);
      await runAudit();
    } catch (error) {
      console.error("Repair failed:", error);
      setStatus("Repair failed. Check console.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Backup & Integrity"
        title="Settings"
        description="Export or replace local data, then run an integrity audit to make sure the training log still looks structurally sound."
        action={
          <Button onClick={runAudit} disabled={auditLoading}>
            {auditLoading ? "Running..." : "Run Check"}
          </Button>
        }
        meta={
          <>
            <Badge className="bg-accent px-3 py-1 text-accent-foreground">Local-first data tools</Badge>
            {auditReport ? <Badge>{auditReport.ok ? "Healthy" : `${auditReport.summary.total} issue${auditReport.summary.total === 1 ? "" : "s"}`}</Badge> : null}
          </>
        }
      />

      {status ? (
        <div className="rounded-[1.3rem] border border-border/70 bg-card/82 px-4 py-3 text-sm text-muted-foreground shadow-[0_18px_40px_-34px_hsl(var(--foreground)/0.42)]">
          {status}
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[1.08fr_0.92fr]">
        <Card className="overflow-hidden">
          <CardHeader className="pb-4">
          <CardTitle>Export Data</CardTitle>
          <CardDescription>
            Export includes exercises, muscles, workouts, workout exercises, set entries, and settings.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-[1.25rem] border border-border/70 bg-background/55 p-4">
            <p className="text-sm text-muted-foreground">Use JSON for full restore workflows. CSV exports each table separately for inspection or spreadsheet use.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={exportJson}>Export JSON</Button>
            <Button variant="secondary" onClick={exportCsv}>
              Export CSV Tables
            </Button>
          </div>
        </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader className="pb-4">
          <CardTitle>Import & Sync</CardTitle>
          <CardDescription>Upload a JSON export to replace your entire local database state.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input type="file" accept=".json,application/json" onChange={(e) => e.target.files?.[0] && importJson(e.target.files[0])} disabled={loading} />
          <Button onClick={handleSyncToServer} disabled={loading} variant="secondary" className="w-full">
            Push to Database Server
          </Button>
          <Button onClick={handleResetFromServer} disabled={loading} variant="ghost" className="w-full">
            Pull from Database Server
          </Button>
          {loading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
              {status}
            </div>
          )}
        </CardContent>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <CardHeader className="pb-4">
          <CardTitle>Integrity Report</CardTitle>
          <CardDescription>Runs a read-only audit of local IndexedDB data and reports structural issues.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {auditError ? <p className="text-sm text-destructive">{auditError}</p> : null}
          {auditReport ? (
            <div className="space-y-3">
              <div className="rounded-[1.2rem] border border-border/70 bg-background/55 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">{auditReport.ok ? "Healthy" : "Issues Found"}</p>
                    <p className="text-sm text-muted-foreground">
                      {auditReport.summary.total} issue{auditReport.summary.total === 1 ? "" : "s"} total · {auditReport.summary.errors} errors ·{" "}
                      {auditReport.summary.warnings} warnings
                    </p>
                  </div>
                  {!auditReport.ok && (
                    <Button size="sm" onClick={runRepair} disabled={loading}>
                      Repair Issues
                    </Button>
                  )}
                </div>
              </div>

              {auditReport.issues.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Issues</p>
                  <ul className="space-y-2">
                    {auditReport.issues.map((issue, index) => (
                      <li
                        key={`${issue.entity}-${issue.id ?? "unknown"}-${index}`}
                        className="rounded-[1.15rem] border border-border/70 bg-background/55 p-4 text-sm"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full border border-border/70 px-2.5 py-0.5 text-[11px] uppercase tracking-wide text-muted-foreground">
                            {issue.severity}
                          </span>
                          <span className="font-medium">{issue.entity}</span>
                          {issue.id ? <span className="text-muted-foreground">#{issue.id}</span> : null}
                        </div>
                        <p className="mt-1">{issue.message}</p>
                        {issue.details ? (
                          <pre className="mt-2 overflow-x-auto rounded bg-muted/40 p-2 text-[11px] text-muted-foreground">
                            {JSON.stringify(issue.details, null, 2)}
                          </pre>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Run a check to inspect the local database.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
