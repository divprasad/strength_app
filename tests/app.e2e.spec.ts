import path from "path";
import { expect, test } from "@playwright/test";

const importFixturePath = path.join(__dirname, "fixtures", "import-payload.json");

// globalSetup seeds dev_test.db with muscles + exercises (including Barbell Bench Press)
// before this suite runs, so both tests start from a clean known state.

test("settings supports JSON export and fixture import", async ({ page }) => {
  await page.goto("/settings");

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

test("workout lifecycle can be completed from logger to history", async ({ page }) => {
  page.on("dialog", dialog => dialog.accept());

  // Test DB is freshly seeded — no workouts exist, so we always hit the empty state
  await page.goto("/workouts");
  await expect(page.getByRole("button", { name: "Start Workout" })).toBeVisible({ timeout: 10000 });
  await page.getByRole("button", { name: "Start Workout" }).click();

  // Session is now active — the header badge shows running timer (● 0:00 format)
  await expect(page.getByText(/^●/).first()).toBeVisible();

  // Add an exercise via the inline picker (Barbell Bench Press is seeded)
  await page.getByRole("button", { name: "Add Exercise" }).click();
  await page.getByPlaceholder("Search exercises...").fill("Bench");
  await page.getByRole("button", { name: /Barbell Bench Press/i }).first().click();

  // Exercise auto-starts. Log a set.
  await expect(page.getByRole("button", { name: "Log", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Log", exact: true }).click();

  // Finish the exercise, then stop the session
  await page.getByRole("button", { name: "Finish" }).click();
  await page.getByRole("button", { name: "Stop" }).click();

  // Navigate to history and confirm the session was recorded
  await page.goto("/history");
  await expect(page.getByText(/Session 1/).first()).toBeVisible();
  await expect(page.getByText(/8 reps/).first()).toBeVisible();
});

