import path from "path";
import { expect, test } from "@playwright/test";

const importFixturePath = path.join(__dirname, "fixtures", "import-payload.json");

test.describe.serial("app flow", () => {

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
    // 1. First import the E2E fixture to guarantee baseline test data
    await page.goto("/settings");
    await page.locator('input[type="file"][accept=".json,application/json"]').setInputFiles(importFixturePath);
    await expect(page.getByText("Import complete.")).toBeVisible();

    page.on("dialog", dialog => dialog.accept());
    await page.goto("/workouts");

    // Handle either empty state or populated state
    const startWorkoutBtn = page.getByRole("button", { name: "Start Workout" });
    await page.waitForTimeout(500); // Wait briefly for hydration/render

    if (await startWorkoutBtn.isVisible()) {
      await startWorkoutBtn.click();
    } else {
      // Populated state: open date picker and create new session
      await page.getByRole('button').filter({ hasText: ',' }).first().click();
      await page.getByRole("button", { name: "New Session" }).click();
      await page.getByRole("button", { name: "Start", exact: true }).click();
    }
    
    // Wait for the session timer/indicator to appear
    await expect(page.getByText(/● /).first()).toBeVisible();

    // Add an exercise (using the one imported in the previous test)
    await page.getByRole("button", { name: "Add Exercise" }).click();
    await page.getByPlaceholder("Search exercises...").fill("Curl");
    await page.getByText("E2E Imported Curl").click();

    // The exercise auto-starts. Click Add Set. (Wait for it to show up)
    await expect(page.getByRole("button", { name: "Log", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Log", exact: true }).click();

    // Finish the exercise
    await page.getByRole("button", { name: "Finish" }).click();

    // Stop the workout
    await page.getByRole("button", { name: "Stop" }).click();

    // Navigate to history and verify
    await page.goto("/history");
    await expect(page.getByText(/Session 1/).first()).toBeVisible();
    await expect(page.getByText(/8 reps/).first()).toBeVisible();
  });

});
