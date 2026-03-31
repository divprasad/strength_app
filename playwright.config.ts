import { defineConfig, devices } from "@playwright/test";
import path from "path";

export default defineConfig({
  testDir: "./tests",
  // globalSetup: "./tests/global-setup.ts",
  globalTeardown: "./tests/global-teardown.ts",
  fullyParallel: true,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:3200",
    trace: "on-first-retry"
  },
  webServer: {
    // Spin up DB setup then Next.js pointed at the isolated test database
    command: "npx tsx tests/run-setup.ts && npm run dev -- --hostname 127.0.0.1 --port 3200",
    env: {
      DATABASE_URL: `file:${path.join(__dirname, 'prisma/dev_test.db')}`
    },
    url: "http://127.0.0.1:3200",
    reuseExistingServer: false, // Always use fresh server with the test DB
    timeout: 120000
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] }
    }
  ]
});
