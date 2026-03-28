import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('--- Diagnostic Report ---')
  
  // Check for orphaned WorkoutExercises
  const workoutExercises = await prisma.workoutExercise.findMany({
    include: {
      exercise: true,
      workout: true
    }
  })
  
  const orphanedWE = workoutExercises.filter(we => !we.exercise || !we.workout)
  console.log(`Orphaned WorkoutExercises: ${orphanedWE.length}`)
  
  // Check for mismatched IDs/Names in Exercises
  const exercises = await prisma.exercise.findMany()
  console.log(`Total Exercises: ${exercises.length}`)
  
  // Check for SetEntry duplicates
  const setEntries = await prisma.setEntry.findMany()
  const setMap = new Map<string, number>()
  setEntries.forEach(se => {
    const key = `${se.workoutExerciseId}-${se.setNumber}`
    setMap.set(key, (setMap.get(key) || 0) + 1)
  })
  
  const duplicateSets = Array.from(setMap.entries()).filter(([, count]) => count > 1)
  console.log(`Duplicate Set Numbers: ${duplicateSets.length}`)
  if (duplicateSets.length > 0) {
    console.log('Sample duplicates:', duplicateSets.slice(0, 5))
  }
}

main().catch(console.error).finally(() => prisma.$disconnect())
