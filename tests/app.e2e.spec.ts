import path from "path";
import { expect, test } from "@playwright/test";

const importFixturePath = path.join(__dirname, "fixtures", "import-payload.json");

test("workout lifecycle can be completed from logger to history", async ({ page }) => {
  page.on("dialog", dialog => dialog.accept());

  // Clear IndexedDB so today's workout state is clean regardless of previous runs
  await page.goto("/workouts");
  await page.evaluate(async () => {
    const dbs = await indexedDB.databases();
    await Promise.all(dbs.map(db => new Promise<void>((res, rej) => {
      const req = indexedDB.deleteDatabase(db.name!);
      req.onsuccess = () => res();
      req.onerror = () => rej(req.error);
    })));
  });
  await page.reload();

  // Logger renders with a "Start Workout" CTA when no workout exists for today
  await expect(page.getByRole("button", { name: "Start Workout" })).toBeVisible({ timeout: 10000 });

  // Start a new session
  await page.getByRole("button", { name: "Start Workout" }).click();

  // Session is now active — the header badge shows a running timer (● 0:00 format)
  await expect(page.getByText(/^●/).first()).toBeVisible();

  // Add an exercise via the inline picker
  await page.getByText("Add Exercise").click();
  await page.getByPlaceholder("Search exercises...").fill("Bench");
  await page.getByRole("button", { name: /Barbell Bench Press/i }).first().click();

  // The exercise card appears in pending state — start it
  await page.getByRole("button", { name: "Start" }).first().click();

  // Log a set
  await page.getByRole("button", { name: "Log" }).click();

  // Finish the exercise
  await page.getByRole("button", { name: "Finish" }).click();

  // Stop the session
  await page.getByRole("button", { name: "Stop" }).click();

  // Navigate to history and confirm the session was recorded
  await page.goto("/history");
  await expect(page.getByText("Session 1")).toBeVisible();
  await expect(page.getByText(/8 reps/).first()).toBeVisible();
});

test("settings supports JSON export and fixture import", async ({ page }) => {
  await page.goto("/settings");

  // Export JSON button should be visible inside the Export Data card
  await expect(page.getByRole("button", { name: "Export JSON" })).toBeVisible();

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export JSON" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^strength-export-.*\.json$/);

  await page.locator('input[type="file"][accept=".json,application/json"]').setInputFiles(importFixturePath);
  await expect(page.getByText("Import complete.")).toBeVisible();

  await page.goto("/exercises");
  await expect(page.getByRole("listitem").filter({ hasText: "E2E Imported Curl" })).toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: "Imported Biceps" })).toBeVisible();
});
