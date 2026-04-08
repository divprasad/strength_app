"use client";

import { useState } from "react";
import { ExportPanel } from "@/components/settings/export-panel";
import { ArchivePanel } from "@/components/settings/archive-panel";
import { GymFeePanel } from "@/components/settings/gym-fee-panel";
import { LogoutPanel } from "@/components/settings/logout-panel";
import { ExerciseList } from "@/components/exercise/exercise-list";
import { MuscleManager } from "@/components/muscle/muscle-manager";
import { cn } from "@/lib/utils";

export default function SettingsPage() {
  const [libraryTab, setLibraryTab] = useState<"exercises" | "muscles">("exercises");

  return (
    <div className="space-y-6">
      {/* Exercise & Muscle Library section */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold tracking-[-0.03em]">Library</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setLibraryTab("exercises")}
            className={cn(
              "rounded-full px-4 py-1.5 text-sm font-medium transition-all",
              libraryTab === "exercises"
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            )}
          >
            Exercises
          </button>
          <button
            onClick={() => setLibraryTab("muscles")}
            className={cn(
              "rounded-full px-4 py-1.5 text-sm font-medium transition-all",
              libraryTab === "muscles"
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            )}
          >
            Muscles
          </button>
        </div>
        <div>
          {libraryTab === "exercises" ? <ExerciseList /> : <MuscleManager />}
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-border/30" />

      {/* Existing settings panels */}
      <div className="space-y-6">
        <h2 className="text-lg font-semibold tracking-[-0.03em]">Settings</h2>
        <LogoutPanel />
        <GymFeePanel />
        <ExportPanel />
        <ArchivePanel />
      </div>
    </div>
  );
}
