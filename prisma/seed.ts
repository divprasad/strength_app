import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

function createStableId(prefix: string, seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  const hex = Math.abs(hash).toString(16).padStart(8, "0");
  return `${prefix}_static_${hex}`;
}
async function main() {
  console.log("Seeding defaults...");

  // Clear existing data to ensure stable IDs take effect
  await prisma.setEntry.deleteMany();
  await prisma.workoutExercise.deleteMany();
  await prisma.workout.deleteMany();
  await prisma.exercise.deleteMany();
  await prisma.muscleGroup.deleteMany();

  const muscles = [
    "Chest", "Back", "Shoulders", "Biceps", "Triceps",
    "Quads", "Hamstrings", "Glutes", "Calves", "Core"
  ];

  for (const name of muscles) {
    await prisma.muscleGroup.upsert({
      where: { name },
      update: {},
      create: { 
        id: createStableId("muscle", name),
        name 
      }
    });
  }

  // Fetch created muscles to get IDs
  const allMuscles = await prisma.muscleGroup.findMany();
  const getMuscleId = (name: string) => allMuscles.find((m) => m.name === name)?.id || "";

  const defaultExercises = [
    {
      name: "Barbell Bench Press",
      category: "Push",
      equipment: "Barbell",
      primaryMuscleIds: JSON.stringify([getMuscleId("Chest")]),
      secondaryMuscleIds: JSON.stringify([getMuscleId("Shoulders"), getMuscleId("Triceps")]),
    },
    {
      name: "Pull-Up",
      category: "Pull",
      equipment: "Bodyweight",
      primaryMuscleIds: JSON.stringify([getMuscleId("Back")]),
      secondaryMuscleIds: JSON.stringify([getMuscleId("Biceps")]),
    },
    {
      name: "Back Squat",
      category: "Legs",
      equipment: "Barbell",
      primaryMuscleIds: JSON.stringify([getMuscleId("Quads"), getMuscleId("Glutes")]),
      secondaryMuscleIds: JSON.stringify([getMuscleId("Hamstrings")]),
    }
  ];

  for (const ex of defaultExercises) {
    await prisma.exercise.upsert({
      where: { name: ex.name },
      update: ex,
      create: {
        id: createStableId("exercise", ex.name),
        ...ex
      }
    });
  }

  console.log("Seeding completed.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
