"use client";

import { useState, useEffect } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { DollarSign } from "lucide-react";

export function GymFeePanel() {
  const settings = useLiveQuery(() => db.settings.get("default"), []);

  const [fee, setFee] = useState(48);
  const [period, setPeriod] = useState(28);
  const [target, setTarget] = useState(3);

  // Sync state from DB
  useEffect(() => {
    if (settings) {
      setFee(settings.gymFee ?? 48);
      setPeriod(settings.gymFeePeriodDays ?? 28);
      setTarget(settings.gymFeeTargetPerSession ?? 3);
    }
  }, [settings]);

  const save = async (patch: { gymFee?: number; gymFeePeriodDays?: number; gymFeeTargetPerSession?: number }) => {
    await db.settings.update("default", patch);
  };

  const inputClass = "w-full rounded-xl border border-border/30 bg-background/60 backdrop-blur-sm px-3 py-2.5 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all duration-200";

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
            min={0}
            step={1}
            value={fee}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              if (!isNaN(v) && v >= 0) {
                setFee(v);
                save({ gymFee: v });
              }
            }}
            className={inputClass}
          />
        </div>

        {/* Period */}
        <div className="space-y-1.5">
          <label htmlFor="gym-period" className="text-[11px] font-medium text-muted-foreground/70 uppercase tracking-[0.08em]">
            Billing period (days)
          </label>
          <input
            id="gym-period"
            type="number"
            min={1}
            step={1}
            value={period}
            onChange={(e) => {
              const v = parseInt(e.target.value);
              if (!isNaN(v) && v >= 1) {
                setPeriod(v);
                save({ gymFeePeriodDays: v });
              }
            }}
            className={inputClass}
          />
        </div>

        {/* Target */}
        <div className="space-y-1.5">
          <label htmlFor="gym-target" className="text-[11px] font-medium text-muted-foreground/70 uppercase tracking-[0.08em]">
            Target cost per session (€)
          </label>
          <input
            id="gym-target"
            type="number"
            min={0.01}
            step={0.5}
            value={target}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              if (!isNaN(v) && v > 0) {
                setTarget(v);
                save({ gymFeeTargetPerSession: v });
              }
            }}
            className={inputClass}
          />
        </div>

        {/* Preview */}
        <div className="rounded-xl bg-muted/30 border border-border/20 px-3 py-2.5 text-[11px] text-muted-foreground/70">
          You need <span className="font-semibold text-foreground">{Math.ceil(fee / target)}</span> sessions per {period} days to reach €{target.toFixed(2)}/session
        </div>
      </div>
    </div>
  );
}
