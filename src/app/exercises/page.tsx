import { ExerciseList } from "@/components/exercise/exercise-list";
import { PageIntro } from "@/components/layout/page-intro";
import { MuscleManager } from "@/components/muscle/muscle-manager";
import { Badge } from "@/components/ui/badge";

export default function ExercisesPage() {
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
      <div className="grid gap-5 lg:grid-cols-[1.75fr_1fr]">
        <ExerciseList />
        <MuscleManager />
      </div>
    </div>
  );
}
