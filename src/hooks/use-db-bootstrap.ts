"use client";

import { useEffect, useState } from "react";
import { ensureBootstrapped } from "@/lib/db";
import { bootstrapFromServer } from "@/lib/sync";

export function useDbBootstrap() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function initDb() {
      try {
        await ensureBootstrapped();
        await bootstrapFromServer();
      } catch (error) {
        console.error("Critical error during database bootstrap:", error);
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
