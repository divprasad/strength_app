"use client";

import { useState } from "react";
import { db } from "@/lib/db";
import { payloadToCsvMap, payloadToJson } from "@/lib/export";
import { runIntegrityAudit } from "@/lib/integrity-audit";
import { nowIso, triggerDownload } from "@/lib/utils";
import type { ExportPayload, IntegrityAuditReport } from "@/types/domain";
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
  const [auditReport, setAuditReport] = useState<IntegrityAuditReport | null>(null);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState<string | null>(null);

  async function exportJson() {
    const payload = await buildPayload();
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    triggerDownload(`strength-export-${timestamp}.json`, payloadToJson(payload), "application/json");
    setStatus("JSON export downloaded.");
  }

  async function exportCsv() {
    const payload = await buildPayload();
    const csvMap = payloadToCsvMap(payload);
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    for (const [name, csv] of Object.entries(csvMap)) {
      triggerDownload(`${name}-${timestamp}.csv`, csv, "text/csv;charset=utf-8");
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
    await db.workouts.bulkPut(
      payload.workouts.map((workout) => ({
        ...workout,
        status: workout.status ?? (workout.sessionStartedAt ? (workout.sessionEndedAt ? "completed" : "active") : "draft")
      }))
    );
    await db.workoutExercises.bulkPut(payload.workoutExercises);
    await db.setEntries.bulkPut(payload.setEntries);
    await db.settings.put(payload.settings);

    setStatus("Import complete.");
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

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <div>
            <CardTitle>Integrity Report</CardTitle>
            <p className="text-sm text-muted-foreground">Runs a read-only audit of local IndexedDB data.</p>
          </div>
          <Button onClick={runAudit} disabled={auditLoading}>
            {auditLoading ? "Running..." : "Run Check"}
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {auditError ? <p className="text-sm text-destructive">{auditError}</p> : null}
          {auditReport ? (
            <div className="space-y-3">
              <div className="rounded-lg border p-3">
                <p className="font-medium">{auditReport.ok ? "Healthy" : "Issues Found"}</p>
                <p className="text-sm text-muted-foreground">
                  {auditReport.summary.total} issue{auditReport.summary.total === 1 ? "" : "s"} total · {auditReport.summary.errors} errors ·{" "}
                  {auditReport.summary.warnings} warnings
                </p>
              </div>

              {auditReport.issues.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Issues</p>
                  <ul className="space-y-2">
                    {auditReport.issues.map((issue, index) => (
                      <li key={`${issue.entity}-${issue.id ?? "unknown"}-${index}`} className="rounded-lg border p-3 text-sm">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full border px-2 py-0.5 text-[11px] uppercase tracking-wide text-muted-foreground">
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

      {status ? <p className="text-sm text-muted-foreground">{status}</p> : null}
    </div>
  );
}
