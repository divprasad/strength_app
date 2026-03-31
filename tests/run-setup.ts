import globalSetup from "./global-setup"
globalSetup().catch(err => {
  console.error("Setup failed:", err);
  process.exit(1);
});
