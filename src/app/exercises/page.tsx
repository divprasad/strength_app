import { ExerciseList } from "@/components/exercise/exercise-list";
import { MuscleManager } from "@/components/muscle/muscle-manager";

export default function ExercisesPage() {
  return (
    <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
      <ExerciseList />
      <MuscleManager />
    </div>
  );
}
