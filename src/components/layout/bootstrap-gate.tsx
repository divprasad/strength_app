"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useDbBootstrap } from "@/hooks/use-db-bootstrap";

export function BootstrapGate({ children }: { children: ReactNode }) {
  const ready = useDbBootstrap();
  const [showSlowHint, setShowSlowHint] = useState(false);

  useEffect(() => {
    if (ready) return;
    const timer = setTimeout(() => setShowSlowHint(true), 6_000);
    return () => clearTimeout(timer);
  }, [ready]);

  if (!ready) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3">
        <div
          className="h-6 w-6 animate-spin rounded-full border-2 border-current border-t-transparent opacity-40"
          aria-hidden
        />
        <p className="text-sm text-muted-foreground">Preparing local database…</p>
        {showSlowHint && (
          <p className="max-w-xs text-center text-xs text-muted-foreground/60">
            First load can be slow while the server compiles. Hang tight…
          </p>
        )}
      </div>
    );
  }

  return <>{children}</>;
}
