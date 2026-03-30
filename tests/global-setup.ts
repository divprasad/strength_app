import { execSync } from "child_process";
import fs from "fs";
import path from "path";

const TEST_DB = path.resolve(__dirname, "../prisma/dev_test.db");

export default async function globalSetup() {
  // 1. Wipe any stale test database from a previous run
  if (fs.existsSync(TEST_DB)) {
    fs.unlinkSync(TEST_DB);
    console.log("[E2E Setup] Removed stale dev_test.db");
  }

  // 2. Run migrations to create the schema
  execSync("npx prisma migrate deploy --schema prisma/schema.prisma", {
    env: { ...process.env, DATABASE_URL: `file:./prisma/dev_test.db` },
    stdio: "inherit",
  });

  // 3. Seed reference data (muscles + exercises) — no workouts
  execSync("npx tsx prisma/seed.ts", {
    env: { ...process.env, DATABASE_URL: `file:./prisma/dev_test.db` },
    stdio: "inherit",
  });

  console.log("[E2E Setup] Test database ready at prisma/dev_test.db");
}
