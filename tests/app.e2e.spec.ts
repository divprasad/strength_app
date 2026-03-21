import path from "path";
import { expect, test } from "@playwright/test";

const importFixturePath = path.join(__dirname, "fixtures", "import-payload.json");

test("command palette opens from the header trigger and navigates by alias", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "Open command palette" }).click();
  await expect(page.getByRole("dialog", { name: "Jump to command palette" })).toBeVisible();

  await page.getByRole("textbox", { name: "Search commands" }).fill("stats");
  await expect(page.getByRole("button", { name: /Analytics/ })).toBeVisible();

  await page.getByRole("button", { name: /Analytics/ }).click();
  await expect(page).toHaveURL(/\/analytics$/);
});

test("command palette can be opened on a mobile viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/workouts");

  await page.getByRole("button", { name: "Open command palette" }).click();
  await expect(page.getByRole("dialog", { name: "Jump to command palette" })).toBeVisible();

  await page.getByRole("textbox", { name: "Search commands" }).fill("prefs");
  await page.getByRole("button", { name: "Settings" }).click();
  await expect(page).toHaveURL(/\/settings$/);
});

test("workout lifecycle can be completed from logger to history", async ({ page }) => {
  await page.goto("/workouts");

  await expect(page.getByRole("heading", { name: "Workout Logger" })).toBeVisible();

  await page.getByRole("button", { name: "New Session" }).click();
  await page.getByRole("combobox").selectOption({ label: "Barbell Bench Press" });
  await page.getByRole("button", { name: "Add" }).click();
  await expect(page.getByRole("heading", { name: "Barbell Bench Press" })).toBeVisible();

  await page.getByRole("button", { name: "Start Workout" }).click();
  await expect(page.getByRole("button", { name: "Stop Workout" })).toBeVisible();

  await page.getByRole("button", { name: /^Start$/ }).click();
  await page.getByRole("button", { name: "Add Set" }).click();

  await page.getByRole("button", { name: "Finish" }).click();
  await page.getByRole("button", { name: "Stop Workout" }).click();

  await page.goto("/history");
  await expect(page.getByRole("heading", { name: "History" })).toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: "Set 1: 8 reps × 20" }).first()).toBeVisible();
});

test("settings supports JSON export and fixture import", async ({ page }) => {
  await page.goto("/settings");

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export JSON" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^strength-export-.*\.json$/);

  await page.locator('input[type="file"][accept="application/json"]').setInputFiles(importFixturePath);
  await expect(page.getByText("Import complete.")).toBeVisible();

  await page.goto("/exercises");
  await expect(page.getByRole("listitem").filter({ hasText: "E2E Imported Curl" })).toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: "Imported Biceps" })).toBeVisible();
});
