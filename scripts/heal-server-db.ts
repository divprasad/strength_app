import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Healing server database muscle IDs...");

  const muscles = await prisma.muscleGroup.findMany();
  const muscleIdSet = new Set(muscles.map((m) => m.id));
  
  // 1. Heal Muscle ID Links
  const exercises = await prisma.exercise.findMany();
  let healedCount = 0;
  for (const exercise of exercises) {
    const primaryMuscleIds = JSON.parse(exercise.primaryMuscleIds) as string[];
    const secondaryMuscleIds = JSON.parse(exercise.secondaryMuscleIds) as string[];

    const newPrimary = primaryMuscleIds.filter(id => muscleIdSet.has(id));
    const newSecondary = secondaryMuscleIds.filter(id => muscleIdSet.has(id));

    if (newPrimary.length !== primaryMuscleIds.length || 
        newSecondary.length !== secondaryMuscleIds.length) {
      console.log(`Healing muscles for exercise: ${exercise.name} (${exercise.id})`);
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

  // 2. Heal Duplicate WorkoutExercise Order
  const workoutExercises = await prisma.workoutExercise.findMany();
  const workoutGroups = new Map<string, typeof workoutExercises>();
  workoutExercises.forEach(we => {
    const list = workoutGroups.get(we.workoutId) || [];
    list.push(we);
    workoutGroups.set(we.workoutId, list);
  });

  for (const [workoutId, items] of workoutGroups) {
    const sorted = [...items].sort((a, b) => a.orderIndex - b.orderIndex);
    for (let i = 0; i < sorted.length; i++) {
      if (sorted[i].orderIndex !== i) {
        console.log(`Healing order for workout exercise ${sorted[i].id} in workout ${workoutId}`);
        await prisma.workoutExercise.update({
          where: { id: sorted[i].id },
          data: { orderIndex: i }
        });
        healedCount++;
      }
    }
  }

  // 3. Heal Duplicate Set Numbers
  const setEntries = await prisma.setEntry.findMany();
  const workoutExerciseGroups = new Map<string, typeof setEntries>();
  setEntries.forEach(se => {
    const list = workoutExerciseGroups.get(se.workoutExerciseId) || [];
    list.push(se);
    workoutExerciseGroups.set(se.workoutExerciseId, list);
  });

  for (const [weId, items] of workoutExerciseGroups) {
    const sorted = [...items].sort((a, b) => a.setNumber - b.setNumber);
    for (let i = 0; i < sorted.length; i++) {
      const newNumber = i + 1;
      if (sorted[i].setNumber !== newNumber) {
        console.log(`Healing setNumber for set ${sorted[i].id} in workoutExercise ${weId}`);
        await prisma.setEntry.update({
          where: { id: sorted[i].id },
          data: { 
            setNumber: newNumber,
            updatedAt: new Date()
          }
        });
        healedCount++;
      }
    }
  }

  console.log(`Healed ${healedCount} entries in server database.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
