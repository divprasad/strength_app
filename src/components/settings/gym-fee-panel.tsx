"use client";

import { useState, useEffect } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
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

  return (
    <Card className="border-border/50">
      <CardContent className="pt-5 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <div className="rounded-lg bg-primary/10 p-1.5">
            <DollarSign className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-semibold">Gym Membership</h3>
            <p className="text-[10px] text-muted-foreground">Track your cost per session on the dashboard</p>
          </div>
        </div>

        {/* Fee */}
        <div className="space-y-1">
          <label htmlFor="gym-fee" className="text-xs font-medium text-muted-foreground">
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
            className="w-full rounded-xl border border-border/60 bg-background px-3 py-2 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/30 transition-shadow"
          />
        </div>

        {/* Period */}
        <div className="space-y-1">
          <label htmlFor="gym-period" className="text-xs font-medium text-muted-foreground">
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
            className="w-full rounded-xl border border-border/60 bg-background px-3 py-2 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/30 transition-shadow"
          />
        </div>

        {/* Target */}
        <div className="space-y-1">
          <label htmlFor="gym-target" className="text-xs font-medium text-muted-foreground">
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
            className="w-full rounded-xl border border-border/60 bg-background px-3 py-2 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/30 transition-shadow"
          />
        </div>

        {/* Preview */}
        <div className="rounded-xl bg-muted/50 px-3 py-2 text-[10px] text-muted-foreground">
          You need <span className="font-semibold text-foreground">{Math.ceil(fee / target)}</span> sessions per {period} days to reach €{target.toFixed(2)}/session
        </div>
      </CardContent>
    </Card>
  );
}
