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

const BOOTSTRAP_TIMEOUT_MS = 5_000;

export function useDbBootstrap() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function initDb() {
      try {
        // 1. Try pulling canonical data from the server (with timeout).
        //    This is the primary source of truth for muscles, exercises and workouts.
        await withTimeout(bootstrapFromServer(), BOOTSTRAP_TIMEOUT_MS);

        // 2. Ensure settings are initialized (won't wipe anything)
        await ensureBootstrapped();
      } catch {
        // Server unreachable, timed out, or errored.
        // Fall back to local seed so the app is still usable.
        console.warn("Server bootstrap failed or timed out, initializing local data only.");
        await ensureBootstrapped();
      } finally {
        if (mounted) setReady(true);
      }
    }

    initDb();

    return () => {
      mounted = false;
    };
  }, []);

  return ready;
}
