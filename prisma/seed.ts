import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcryptjs";
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

  const adminPasswordHash = await bcrypt.hash("0000", 10);
  const adminUser = await prisma.user.upsert({
    where: { username: "admin" },
    update: { pinHash: adminPasswordHash },
    create: {
      id: "default_user",
      username: "admin",
      pinHash: adminPasswordHash,
    }
  });

  // Only clear reference data (muscles + exercises). Never delete workouts —
  // those are user data that must survive re-seeding.
  try {
    await prisma.exercise.deleteMany();
    await prisma.muscleGroup.deleteMany();
  } catch (e) {
    console.warn("Could not delete reference data (is it referenced by user data?), skipping...");
  }

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

  // ── Seed Default Settings ───────────────────────────────────────────────────
  await prisma.settings.upsert({
    where: { userId: adminUser.id },
    update: {},
    create: {
      id: "default",
      userId: adminUser.id,
      volumePrimaryMultiplier: 1.0,
      volumeSecondaryMultiplier: 0.5,
      appScale: 1.0,
    }
  });

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
