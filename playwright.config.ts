import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  globalSetup: "./tests/global-setup.ts",
  globalTeardown: "./tests/global-teardown.ts",
  fullyParallel: true,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:3200",
    trace: "on-first-retry"
  },
  webServer: {
    // Spin up Next.js pointed at the isolated test database
    command: "DATABASE_URL=file:./dev_test.db npm run dev -- --hostname 127.0.0.1 --port 3200",
    url: "http://127.0.0.1:3200",
    reuseExistingServer: false, // Always use fresh server with the test DB
    timeout: 120000,
    stdout: "pipe",
    stderr: "pipe",
    env: {
      DATABASE_URL: "file:./dev_test.db",
      TEST_DATABASE_URL: "file:./dev_test.db",
    },
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] }
    }
  ]
});
