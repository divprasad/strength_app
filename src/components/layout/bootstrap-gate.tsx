"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useDbBootstrap } from "@/hooks/use-db-bootstrap";

export function BootstrapGate({ children }: { children: ReactNode }) {
  const ready = useDbBootstrap();
  const [showSlowHint, setShowSlowHint] = useState(false);
  const [showForceOpen, setShowForceOpen] = useState(false);
  const [forced, setForced] = useState(false);

  useEffect(() => {
    if (ready) return;
    const hintTimer = setTimeout(() => setShowSlowHint(true), 6_000);
    const forceTimer = setTimeout(() => setShowForceOpen(true), 12_000);
    return () => {
      clearTimeout(hintTimer);
      clearTimeout(forceTimer);
    };
  }, [ready]);

  if (!ready && !forced) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3">
        <div
          className="h-6 w-6 animate-spin rounded-full border-2 border-current border-t-transparent opacity-40"
          aria-hidden
        />
        <p className="text-sm text-muted-foreground">Preparing local database…</p>
        {showSlowHint && (
          <p className="max-w-xs text-center text-xs text-muted-foreground/60">
            First load can be slow while the server compiles routes…
          </p>
        )}
        {showForceOpen && (
          <button
            onClick={() => setForced(true)}
            className="mt-2 rounded-full border border-border/40 bg-muted/30 px-4 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
          >
            Force open anyway →
          </button>
        )}
      </div>
    );
  }

  return <>{children}</>;
}
