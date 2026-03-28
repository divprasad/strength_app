"use client";

import { useState } from "react";
import { ExerciseList } from "@/components/exercise/exercise-list";
import { PageIntro } from "@/components/layout/page-intro";
import { MuscleManager } from "@/components/muscle/muscle-manager";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export default function ExercisesPage() {
  const [activeTab, setActiveTab] = useState<"exercises" | "muscles">("exercises");

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Movement Library"
        title="Exercises"
        description="Manage the movement definitions and muscle group labels that power the logger, analytics, and import/export flows."
        meta={
          <>
            <Badge className="bg-accent px-3 py-1 text-accent-foreground">Exercise setup</Badge>
            <Badge>Muscle taxonomy</Badge>
          </>
        }
      />
      
      <div className="border-b border-border/60">
        <div className="flex gap-6 -mb-[1px]">
          <button 
            onClick={() => setActiveTab("exercises")}
            className={cn(
              "pb-3 text-sm font-medium transition-colors border-b-2 outline-none",
              activeTab === "exercises" 
                ? "border-primary text-foreground" 
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            Exercise Library
          </button>
          <button 
            onClick={() => setActiveTab("muscles")}
            className={cn(
              "pb-3 text-sm font-medium transition-colors border-b-2 outline-none",
              activeTab === "muscles" 
                ? "border-primary text-foreground" 
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            Muscle Taxonomy
          </button>
        </div>
      </div>

      <div className="pt-2">
        {activeTab === "exercises" ? <ExerciseList /> : <MuscleManager />}
      </div>
    </div>
  );
}
