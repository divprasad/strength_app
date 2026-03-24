import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Healing server database muscle IDs...");

  const muscles = await prisma.muscleGroup.findMany();
  const muscleIdSet = new Set(muscles.map((m) => m.id));
  
  const exercises = await prisma.exercise.findMany();
  let healedCount = 0;

  for (const exercise of exercises) {
    const primaryMuscleIds = JSON.parse(exercise.primaryMuscleIds) as string[];
    const secondaryMuscleIds = JSON.parse(exercise.secondaryMuscleIds) as string[];

    const newPrimary = primaryMuscleIds.filter(id => muscleIdSet.has(id));
    const newSecondary = secondaryMuscleIds.filter(id => muscleIdSet.has(id));

    if (newPrimary.length !== primaryMuscleIds.length || 
        newSecondary.length !== secondaryMuscleIds.length) {
      
      console.log(`Healing exercise: ${exercise.name} (${exercise.id})`);
      await prisma.exercise.update({
        where: { id: exercise.id },
        data: {
          primaryMuscleIds: JSON.stringify(newPrimary),
          secondaryMuscleIds: JSON.stringify(newSecondary),
          updatedAt: new Date()
        }
      });
      healedCount++;
    }
  }

  console.log(`Healed ${healedCount} exercises in server database.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
