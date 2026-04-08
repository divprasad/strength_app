"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { Minus, Plus } from "lucide-react";
import { db } from "@/lib/db";

const MIN = 0.85;
const MAX = 1.30;
const STEP = 0.05;

export function ScaleControl() {
  const settings = useLiveQuery(() => db.settings.get("default"), []);
  const scale = settings?.appScale ?? 1.0;

  async function adjust(delta: number) {
    const next = Math.min(MAX, Math.max(MIN, parseFloat((scale + delta).toFixed(2))));
    await db.settings.update("default", { appScale: next });
  }

  const pct = Math.round(scale * 100);

  return (
    <div className="flex items-center gap-0.5 rounded-full border border-border/40 bg-background/55 px-1 py-1">
      <button
        onClick={() => adjust(-STEP)}
        disabled={scale <= MIN}
        className="flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground transition-all hover:bg-accent/30 hover:text-foreground active:scale-90 disabled:opacity-30 disabled:cursor-not-allowed"
        title="Decrease scale"
        aria-label="Decrease scale"
      >
        <Minus className="h-3 w-3" />
      </button>
      <span className="min-w-[2.8rem] text-center text-[10px] font-semibold tabular-nums text-muted-foreground">
        {pct}%
      </span>
      <button
        onClick={() => adjust(STEP)}
        disabled={scale >= MAX}
        className="flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground transition-all hover:bg-accent/30 hover:text-foreground active:scale-90 disabled:opacity-30 disabled:cursor-not-allowed"
        title="Increase scale"
        aria-label="Increase scale"
      >
        <Plus className="h-3 w-3" />
      </button>
    </div>
  );
}
