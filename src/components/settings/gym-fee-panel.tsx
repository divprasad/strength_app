"use client";

import { useState, useEffect } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { DollarSign } from "lucide-react";
import { cn } from "@/lib/utils";

function validate(raw: string, opts: { min?: number; integer?: boolean }): string | null {
  if (raw === "" || raw === "-") return "Required";
  const v = opts.integer ? parseInt(raw) : parseFloat(raw);
  if (isNaN(v)) return "Must be a number";
  if (opts.min !== undefined && v < opts.min) return `Minimum is ${opts.min}`;
  return null;
}

export function GymFeePanel() {
  const settings = useLiveQuery(() => db.settings.get("default"), []);

  // String-based state so backspace works mid-edit
  const [feeStr, setFeeStr] = useState("48");
  const [weeksStr, setWeeksStr] = useState("4"); // displayed as weeks, stored as days
  const [targetStr, setTargetStr] = useState("3");

  // Sync from DB once on load
  useEffect(() => {
    if (settings) {
      setFeeStr(String(settings.gymFee ?? 48));
      const days = settings.gymFeePeriodDays ?? 28;
      setWeeksStr(String(Math.round(days / 7)));
      setTargetStr(String(settings.gymFeeTargetPerSession ?? 3));
    }
  }, [settings]);

  const feeError = validate(feeStr, { min: 0 });
  const weeksError = validate(weeksStr, { min: 1, integer: true });
  const targetError = validate(targetStr, { min: 0.01 });

  const saveIfValid = async (
    field: "gymFee" | "gymFeePeriodDays" | "gymFeeTargetPerSession",
    raw: string,
    opts: { min?: number; integer?: boolean },
  ) => {
    const err = validate(raw, opts);
    if (err) return; // don't write invalid values
    const v = opts.integer ? parseInt(raw) : parseFloat(raw);
    const patch: Record<string, number> = {};
    if (field === "gymFeePeriodDays") {
      patch[field] = v * 7; // convert weeks → days before saving
    } else {
      patch[field] = v;
    }
    await db.settings.update("default", patch);
  };

  const baseInput = "w-full rounded-xl border bg-background/80 backdrop-blur-sm px-3 py-2.5 text-sm tabular-nums focus:outline-none focus:ring-2 transition-all duration-200";
  const validInput = "border-border/50 focus:ring-primary/20 focus:border-primary/40";
  const errorInput = "border-destructive/50 focus:ring-destructive/20 focus:border-destructive/40 text-destructive";

  // Derived preview values (only when all valid)
  const fee = parseFloat(feeStr);
  const weeks = parseInt(weeksStr);
  const target = parseFloat(targetStr);
  const allValid = !feeError && !weeksError && !targetError;

  return (
    <div className="rounded-2xl border border-border/30 bg-card/75 backdrop-blur-lg overflow-hidden shadow-e1">
      <div className="p-5 space-y-4">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-primary/8 p-2">
            <DollarSign className="h-4 w-4 text-primary/70" />
          </div>
          <div>
            <h3 className="text-sm font-semibold tracking-[-0.02em]">Gym Membership</h3>
            <p className="text-[10px] text-muted-foreground/60">Track your cost per session on the dashboard</p>
          </div>
        </div>

        {/* Fee */}
        <div className="space-y-1.5">
          <label htmlFor="gym-fee" className="text-[11px] font-medium text-muted-foreground/70 uppercase tracking-[0.08em]">
            Membership fee (€)
          </label>
          <input
            id="gym-fee"
            type="number"
            inputMode="decimal"
            min={0}
            step={1}
            value={feeStr}
            onChange={(e) => setFeeStr(e.target.value)}
            onBlur={() => saveIfValid("gymFee", feeStr, { min: 0 })}
            className={cn(baseInput, feeError ? errorInput : validInput)}
          />
          {feeError && (
            <p className="text-[11px] text-destructive animate-fade-in">{feeError}</p>
          )}
        </div>

        {/* Period (weeks) */}
        <div className="space-y-1.5">
          <label htmlFor="gym-period" className="text-[11px] font-medium text-muted-foreground/70 uppercase tracking-[0.08em]">
            Billing period (weeks)
          </label>
          <input
            id="gym-period"
            type="number"
            inputMode="numeric"
            min={1}
            step={1}
            value={weeksStr}
            onChange={(e) => setWeeksStr(e.target.value)}
            onBlur={() => saveIfValid("gymFeePeriodDays", weeksStr, { min: 1, integer: true })}
            className={cn(baseInput, weeksError ? errorInput : validInput)}
          />
          {weeksError ? (
            <p className="text-[11px] text-destructive animate-fade-in">{weeksError}</p>
          ) : (
            <p className="text-[11px] text-muted-foreground/50">{weeks * 7} days</p>
          )}
        </div>

        {/* Target */}
        <div className="space-y-1.5">
          <label htmlFor="gym-target" className="text-[11px] font-medium text-muted-foreground/70 uppercase tracking-[0.08em]">
            Target cost per session (€)
          </label>
          <input
            id="gym-target"
            type="number"
            inputMode="decimal"
            min={0.01}
            step={0.5}
            value={targetStr}
            onChange={(e) => setTargetStr(e.target.value)}
            onBlur={() => saveIfValid("gymFeeTargetPerSession", targetStr, { min: 0.01 })}
            className={cn(baseInput, targetError ? errorInput : validInput)}
          />
          {targetError && (
            <p className="text-[11px] text-destructive animate-fade-in">{targetError}</p>
          )}
        </div>

        {/* Preview */}
        {allValid ? (
          <div className="rounded-xl bg-muted/30 border border-border/20 px-3 py-2.5 text-[11px] text-muted-foreground/70">
            You need <span className="font-semibold text-foreground">{Math.ceil(fee / target)}</span> sessions per{" "}
            <span className="font-semibold text-foreground">{weeks} week{weeks !== 1 ? "s" : ""}</span> to reach €{target.toFixed(2)}/session
          </div>
        ) : (
          <div className="rounded-xl bg-destructive/5 border border-destructive/15 px-3 py-2.5 text-[11px] text-destructive/70">
            Fix the errors above to see your target preview.
          </div>
        )}
      </div>
    </div>
  );
}
