import path from "path";
import { expect, test } from "@playwright/test";

const importFixturePath = path.join(__dirname, "fixtures", "import-payload.json");

test("workout lifecycle can be completed from logger to history", async ({ page }) => {
  page.on("dialog", dialog => dialog.accept());
  await page.goto("/workouts");

  await expect(page.getByRole("heading", { name: "Workout Logger" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Barbell Bench Press" })).toBeVisible();

  await page.getByRole("button", { name: "Start Workout" }).click();
  await expect(page.getByText(/^Session running ·/).first()).toBeVisible();

  await page.getByRole("button", { name: /^Start$/ }).click();
  await page.getByRole("button", { name: "Add Set" }).click();

  await page.getByRole("button", { name: "Finish" }).click();
  await page.getByRole("button", { name: "Stop Workout" }).click();

  await page.goto("/history");
  await expect(page.getByText("Session 1")).toBeVisible();
  await expect(page.getByText(/8 reps/).first()).toBeVisible();
});

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
