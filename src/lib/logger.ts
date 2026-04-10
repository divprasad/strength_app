/**
 * logger.ts — Server-side plain-text file logger.
 *
 * Writes one line per event to /app/logs/app.log (Docker) or falls back
 * to console in local dev (where /app/logs may not exist).
 *
 * Format: [ISO timestamp] [LEVEL] [source] message
 *
 * Rotation: when app.log exceeds MAX_LOG_BYTES (5 MB), it is renamed to
 * app.log.1, capping total disk usage at ~10 MB (2 files).
 */

import fs from "fs";
import path from "path";

const LOG_DIR = process.env.LOG_DIR ?? "/app/logs";
const LOG_FILE = path.join(LOG_DIR, "app.log");
const ROTATED_FILE = path.join(LOG_DIR, "app.log.1");
const MAX_LOG_BYTES = 5 * 1024 * 1024; // 5 MB

type Level = "INFO" | "WARN" | "ERROR";

function writeLine(level: Level, source: string, message: string): void {
  const ts = new Date().toISOString();
  const line = `[${ts}] [${level}] [${source}] ${message}\n`;

  // Always mirror to stdout — Docker captures this via `docker logs`
  if (level === "ERROR") {
    process.stderr.write(line);
  } else {
    process.stdout.write(line);
  }

  // File write — skip gracefully if directory doesn't exist (local dev without volume)
  try {
    // Lazy-create the log directory if missing
    if (!fs.existsSync(LOG_DIR)) {
      fs.mkdirSync(LOG_DIR, { recursive: true });
    }

    // Rotate if over size limit
    if (fs.existsSync(LOG_FILE)) {
      const { size } = fs.statSync(LOG_FILE);
      if (size >= MAX_LOG_BYTES) {
        fs.renameSync(LOG_FILE, ROTATED_FILE);
      }
    }

    fs.appendFileSync(LOG_FILE, line, "utf-8");
  } catch {
    // Swallow — file logging is best-effort, stdout is the real source of truth
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

export const logger = {
  info(source: string, message: string): void {
    writeLine("INFO", source, message);
  },
  warn(source: string, message: string): void {
    writeLine("WARN", source, message);
  },
  error(source: string, message: string | unknown): void {
    const msg =
      message instanceof Error
        ? `${message.message}${message.stack ? `\n  Stack: ${message.stack.split("\n").slice(1, 3).join(" | ")}` : ""}`
        : String(message);
    writeLine("ERROR", source, msg);
  },
};
