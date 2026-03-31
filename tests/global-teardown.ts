import fs from "fs";
import path from "path";

const TEST_DB = path.resolve(__dirname, "../prisma/dev_test.db");

export default async function globalTeardown() {
  const filesToDelete = [
    TEST_DB,
    `${TEST_DB}-wal`,
    `${TEST_DB}-shm`,
    `${TEST_DB}-journal`,
  ];
  let cleaned = false;
  for (const file of filesToDelete) {
    if (fs.existsSync(file)) {
      fs.unlinkSync(file);
      cleaned = true;
    }
  }
  if (cleaned) {
    console.log("[E2E Teardown] Cleaned up dev_test.db files");
  }
}
