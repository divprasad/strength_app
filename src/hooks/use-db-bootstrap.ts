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

        // 2. If server bootstrap succeeded but returned no exercises
        //    (i.e. the server DB is also empty), fall back to local defaults.
        const hasExercises = await db.exercises.count();
        if (hasExercises === 0) {
          await ensureBootstrapped();
        }
      } catch {
        // Server unreachable (e.g. offline / first load without network).
        // Fall back to local seed so the app is still usable.
        console.warn("Server bootstrap failed, falling back to local seed.");
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

