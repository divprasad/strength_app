"use client";

import { useEffect, useState } from "react";
import { ensureBootstrapped } from "@/lib/db";

export function useDbBootstrap() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    ensureBootstrapped().then(() => {
      if (mounted) setReady(true);
    });
    return () => {
      mounted = false;
    };
  }, []);

  return ready;
}
