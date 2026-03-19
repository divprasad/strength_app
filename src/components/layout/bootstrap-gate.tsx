"use client";

import type { ReactNode } from "react";
import { useDbBootstrap } from "@/hooks/use-db-bootstrap";

export function BootstrapGate({ children }: { children: ReactNode }) {
  const ready = useDbBootstrap();

  if (!ready) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-sm text-muted-foreground">Preparing local database...</p>
      </div>
    );
  }

  return <>{children}</>;
}
