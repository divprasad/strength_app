import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const latestWorkout = await prisma.workout.findFirst({
    orderBy: { createdAt: 'desc' },
    include: {
      exercises: {
        include: {
          exercise: true,
          sets: true,
        },
        orderBy: { orderIndex: 'asc' },
      },
    },
  })

  if (!latestWorkout) {
    console.log('No workouts found.')
    return
  }

  console.log(`Workout: ${latestWorkout.name || 'Untitled'}`)
  console.log(`Date: ${latestWorkout.date}`)
  if (latestWorkout.sessionStartedAt) console.log(`Started: ${latestWorkout.sessionStartedAt.toLocaleString()}`)
  if (latestWorkout.sessionEndedAt) console.log(`Ended: ${latestWorkout.sessionEndedAt.toLocaleString()}`)
  console.log(`Status: ${latestWorkout.status}`)
  console.log('---')

  for (const wkEx of latestWorkout.exercises) {
    console.log(`Exercise: ${wkEx.exercise.name}`)
    for (const set of wkEx.sets) {
      console.log(`  Set ${set.setNumber}: ${set.weight}kg x ${set.reps} (${set.type})`)
    }
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
