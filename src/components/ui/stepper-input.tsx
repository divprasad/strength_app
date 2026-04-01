"use client";

import { cn } from "@/lib/utils";
import { Minus, Plus } from "lucide-react";

interface StepperInputProps {
  value: string;
  onChange: (v: string) => void;
  step?: number;
  min?: number;
  label?: string;
  inputMode?: "numeric" | "decimal";
  /** md = h-10 (active logging card), sm = h-8 (edit-mode add form) */
  size?: "sm" | "md";
  className?: string;
}

export function StepperInput({
  value,
  onChange,
  step = 1,
  min = 0,
  label,
  inputMode = "numeric",
  size = "md",
  className,
}: StepperInputProps) {
  const numeric = parseFloat(value) || 0;

  function decrement() {
    const next = Math.max(min, parseFloat((numeric - step).toFixed(4)));
    // Trim unnecessary trailing zeros (e.g. 17.50 → 17.5, 20.0 → 20)
    onChange(String(parseFloat(next.toFixed(2))));
  }

  function increment() {
    const next = parseFloat((numeric + step).toFixed(4));
    onChange(String(parseFloat(next.toFixed(2))));
  }

  const h = size === "md" ? "h-10" : "h-8";
  const btnSize = size === "md" ? "h-10 w-10" : "h-8 w-8";
  const inputW = size === "md" ? "w-14" : "w-12";
  const textSize = size === "md" ? "text-sm" : "text-xs";
  const atMin = numeric <= min;

  return (
    <div className={cn("flex flex-col items-center gap-0.5", className)}>
      <div className="flex items-center gap-1">
        {/* Decrement */}
        <button
          type="button"
          onClick={decrement}
          disabled={atMin}
          className={cn(
            btnSize,
            "flex items-center justify-center rounded-full border border-border/60 bg-muted/40",
            "text-muted-foreground transition-all active:scale-90",
            atMin
              ? "opacity-30 cursor-not-allowed"
              : "hover:border-border hover:bg-muted/70 hover:text-foreground active:bg-muted"
          )}
          aria-label="Decrease"
        >
          <Minus className={size === "md" ? "h-3.5 w-3.5" : "h-3 w-3"} />
        </button>

        {/* Input */}
        <input
          type="number"
          inputMode={inputMode}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={cn(
            h,
            inputW,
            textSize,
            "rounded-xl border border-border/60 bg-background/70 text-center font-semibold",
            "focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50",
            "tabular-nums transition-colors"
          )}
        />

        {/* Increment */}
        <button
          type="button"
          onClick={increment}
          className={cn(
            btnSize,
            "flex items-center justify-center rounded-full border border-border/60 bg-muted/40",
            "text-muted-foreground transition-all active:scale-90",
            "hover:border-primary/30 hover:bg-primary/8 hover:text-primary active:bg-primary/12"
          )}
          aria-label="Increase"
        >
          <Plus className={size === "md" ? "h-3.5 w-3.5" : "h-3 w-3"} />
        </button>
      </div>

      {/* Sub-label */}
      {label && (
        <span className="text-[9px] font-medium uppercase tracking-[0.14em] text-muted-foreground/60">
          {label}
        </span>
      )}
    </div>
  );
}
