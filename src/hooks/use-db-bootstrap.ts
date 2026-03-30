"use client";

import { useEffect, useState } from "react";
import { ensureBootstrapped } from "@/lib/db";
import { bootstrapFromServer } from "@/lib/sync";
import { db } from "@/lib/db";

export function useDbBootstrap() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function initDb() {
      try {
        // 1. Try pulling canonical data from the server first.
        //    This is the primary source of truth for muscles, exercises and workouts.
        await bootstrapFromServer();
        
        // 2. Ensure settings are initialized (won't wipe anything)
        await ensureBootstrapped();
      } catch {
        // Server unreachable (e.g. offline / first load without network).
        // Fall back to local seed so the app is still usable.
        console.warn("Server bootstrap failed, initializing local settings only.");
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

