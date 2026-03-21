"use client";

import { useEffect, useState } from "react";
import { ensureBootstrapped } from "@/lib/db";
import { bootstrapFromServer } from "@/lib/sync";

export function useDbBootstrap() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    ensureBootstrapped().then(async () => {
      await bootstrapFromServer();
      if (mounted) setReady(true);
    });
    return () => {
      mounted = false;
    };
  }, []);

  return ready;
}
