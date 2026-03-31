import { execSync } from "child_process";
import fs from "fs";
import path from "path";

const TEST_DB = path.resolve(__dirname, "../prisma/dev_test.db");

export default async function globalSetup() {
  // 1. Wipe any stale test database from a previous run
  if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
  if (fs.existsSync(TEST_DB + "-wal")) fs.unlinkSync(TEST_DB + "-wal");
  if (fs.existsSync(TEST_DB + "-shm")) fs.unlinkSync(TEST_DB + "-shm");
  console.log("[E2E Setup] Removed stale test db files");

  // Temporarily hide .env so Prisma CLI cannot read it and override our DATABASE_URL
  const envPath = path.resolve(__dirname, "../.env");
  const envBakPath = path.resolve(__dirname, "../.env.testbak");
  if (fs.existsSync(envPath)) {
    fs.renameSync(envPath, envBakPath);
  }

  try {
    // 2. Run migrations to create the schema
    execSync("npx prisma migrate deploy --schema prisma/schema.prisma", {
      env: { ...process.env, DATABASE_URL: `file:./dev_test.db` },
      stdio: "inherit",
    });

    // 3. Seed reference data (muscles + exercises) — no workouts
    execSync("npx tsx prisma/seed.ts", {
      env: { ...process.env, DATABASE_URL: `file:./dev_test.db` },
      stdio: "inherit",
    });
  } finally {
    if (fs.existsSync(envBakPath)) {
      fs.renameSync(envBakPath, envPath);
    }
  }

  console.log("[E2E Setup] Test database ready at prisma/dev_test.db");
}
