"use client";

import { useEffect, useState } from "react";
import { ensureBootstrapped, db } from "@/lib/db";
import { bootstrapFromServer } from "@/lib/sync";

/** Race a promise against a timeout. Rejects with "Timeout" if ms elapses. */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Timeout")), ms)
    ),
  ]);
}

/**
 * Generous timeout for the server bootstrap.
 * In Next.js dev mode, the very first API request triggers route compilation
 * which can easily take 10-20s on a cold start. 30s accommodates this.
 */
const SERVER_BOOTSTRAP_TIMEOUT_MS = 30_000;

/**
 * Safety-net timeout for the local Dexie bootstrap.
 * If Dexie is blocked (e.g. version upgrade waiting on another tab),
 * we still want to unblock the UI after this long.
 */
const LOCAL_BOOTSTRAP_TIMEOUT_MS = 10_000;

/**
 * Absolute maximum time we will show "Preparing local database…" before
 * giving up and rendering the app anyway. This is a hard safety net —
 * the app may be degraded but at least the user isn't stuck forever.
 * Set to 35s (5s slack over SERVER_BOOTSTRAP_TIMEOUT_MS) so a double
 * failure (server + local) doesn't leave the user waiting 45s.
 */
const HARD_DEADLINE_MS = 35_000;

/**
 * Returns true if Dexie already has usable local data (exercises loaded
 * from a previous server bootstrap). Uses IDB primary key count — O(1),
 * no table scan, completes in <1ms.
 *
 * We check exercises (not workouts or settings) because exercises are the
 * critical dependency — without them the exercise picker is empty and
 * logging is impossible. Settings can be defaulted; workouts can be absent.
 */
async function hasLocalData(): Promise<boolean> {
  try {
    const count = await db.exercises.count();
    return count > 0;
  } catch {
    return false;
  }
}

export function useDbBootstrap() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;

    // Hard deadline: no matter what, unblock the UI after HARD_DEADLINE_MS
    const hardDeadline = setTimeout(() => {
      if (mounted && !ready) {
        console.error(
          `[bootstrap] Hard deadline (${HARD_DEADLINE_MS}ms) reached — forcing UI unlock. ` +
          `The database may not be fully initialized.`
        );
        setReady(true);
      }
    }, HARD_DEADLINE_MS);

    async function initDb() {
      // ── Fast path: already have local data ──────────────────────────────
      // If Dexie already contains exercises from a previous session,
      // unlock the UI immediately and run the server sync in the background.
      // This is the normal path for any return visit (online or offline).
      const localReady = await hasLocalData();

      if (localReady) {
        // Ensure settings row exists (instant — local Dexie read only)
        try {
          await withTimeout(ensureBootstrapped(), LOCAL_BOOTSTRAP_TIMEOUT_MS);
        } catch {
          // Non-fatal — app still works with default settings
        }

        // Unlock UI now, without waiting for the network
        clearTimeout(hardDeadline);
        if (mounted) setReady(true);

        // Kick off server sync in the background (best-effort, fire-and-forget).
        // useLiveQuery will auto-rerender when Dexie updates with fresh data.
        bootstrapFromServer().catch((err) => {
          console.warn(
            "[bootstrap] Background server sync failed:",
            err instanceof Error ? err.message : err
          );
        });

        return;
      }

      // ── Cold start: no local data — must fetch from server ──────────────
      // First install (or after clearing browser data). Without exercises
      // the exercise picker is empty and the app is unusable, so we block.
      try {
        // 1. Pull canonical data from the server.
        await withTimeout(bootstrapFromServer(), SERVER_BOOTSTRAP_TIMEOUT_MS);

        // 2. Ensure local settings are initialized.
        await withTimeout(ensureBootstrapped(), LOCAL_BOOTSTRAP_TIMEOUT_MS);
      } catch (err) {
        // Server unreachable, timed out, or errored.
        // Fall back to local seed so the app renders with default data.
        const reason = err instanceof Error ? err.message : String(err);
        console.warn(
          `[bootstrap] Server bootstrap failed (${reason}), initializing local data only.`
        );

        try {
          await withTimeout(ensureBootstrapped(), LOCAL_BOOTSTRAP_TIMEOUT_MS);
        } catch (localErr) {
          // Even local bootstrap failed/timed out — log it but don't block the UI.
          const localReason = localErr instanceof Error ? localErr.message : String(localErr);
          console.error(
            `[bootstrap] Local bootstrap also failed (${localReason}). ` +
            `App will render but may be missing seed data.`
          );
        }
      } finally {
        clearTimeout(hardDeadline);
        if (mounted) setReady(true);
      }
    }

    initDb().then(() => {
      // Request persistent storage so Android/Chrome cannot silently evict
      // our IndexedDB data when the device storage runs low.
      if (typeof navigator !== "undefined" && navigator.storage?.persist) {
        navigator.storage.persist().then((granted) => {
          if (granted) {
            console.info("[storage] Persistent storage granted — IndexedDB is durable.");
          } else {
            console.warn("[storage] Persistent storage NOT granted — data may be evicted under storage pressure.");
          }
        }).catch(() => { /* silently ignore unsupported browsers */ });
      }
    });

    return () => {
      mounted = false;
      clearTimeout(hardDeadline);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return ready;
}
