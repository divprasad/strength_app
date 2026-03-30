import fs from "fs";
import path from "path";

const TEST_DB = path.resolve(__dirname, "../prisma/dev_test.db");

export default async function globalTeardown() {
  if (fs.existsSync(TEST_DB)) {
    fs.unlinkSync(TEST_DB);
    console.log("[E2E Teardown] Cleaned up dev_test.db");
  }
}
