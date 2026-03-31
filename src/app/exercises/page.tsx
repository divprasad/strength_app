"use client";

import { useState } from "react";
import { ExerciseList } from "@/components/exercise/exercise-list";
import { MuscleManager } from "@/components/muscle/muscle-manager";
import { cn } from "@/lib/utils";

export default function LibraryPage() {
  const [activeTab, setActiveTab] = useState<"exercises" | "muscles">("exercises");

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold tracking-[-0.04em]">Library</h1>

      <div className="flex gap-2">
        <button
          onClick={() => setActiveTab("exercises")}
          className={cn(
            "rounded-full px-4 py-1.5 text-sm font-medium transition-all",
            activeTab === "exercises"
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
          )}
        >
          Exercises
        </button>
        <button
          onClick={() => setActiveTab("muscles")}
          className={cn(
            "rounded-full px-4 py-1.5 text-sm font-medium transition-all",
            activeTab === "muscles"
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
          )}
        >
          Muscles
        </button>
      </div>

      <div>
        {activeTab === "exercises" ? <ExerciseList /> : <MuscleManager />}
      </div>
    </div>
  );
}
