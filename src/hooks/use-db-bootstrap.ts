"use client";

import { useEffect, useState } from "react";
import { ensureBootstrapped } from "@/lib/db";
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
 */
const HARD_DEADLINE_MS = 45_000;

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
      try {
        // 1. Try pulling canonical data from the server (with timeout).
        //    This is the primary source of truth for muscles, exercises and workouts.
        await withTimeout(bootstrapFromServer(), SERVER_BOOTSTRAP_TIMEOUT_MS);

        // 2. Ensure local settings are initialized (won't wipe anything)
        await withTimeout(ensureBootstrapped(), LOCAL_BOOTSTRAP_TIMEOUT_MS);
      } catch (err) {
        // Server unreachable, timed out, or errored.
        // Fall back to local seed so the app is still usable.
        const reason = err instanceof Error ? err.message : String(err);
        console.warn(
          `[bootstrap] Server bootstrap failed (${reason}), initializing local data only.`
        );

        try {
          await withTimeout(ensureBootstrapped(), LOCAL_BOOTSTRAP_TIMEOUT_MS);
        } catch (localErr) {
          // Even local bootstrap failed/timed out — log it but don't block the UI
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
