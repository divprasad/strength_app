export type Id = string;

export interface Timestamps {
  createdAt: string;
  updatedAt: string;
}

export interface MuscleGroup extends Timestamps {
  id: Id;
  name: string;
}

export interface Exercise extends Timestamps {
  id: Id;
  name: string;
  category?: string;
  equipment?: string;
  primaryMuscleIds: Id[];
  secondaryMuscleIds: Id[];
  notes?: string;
}

export interface Workout extends Timestamps {
  id: Id;
  date: string; // YYYY-MM-DD local date
  notes?: string;
  userId?: string;
  sessionStartedAt?: string;
  sessionEndedAt?: string;
}

export interface WorkoutExercise {
  id: Id;
  workoutId: Id;
  exerciseId: Id;
  orderIndex: number;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}

export interface SetEntry extends Timestamps {
  id: Id;
  workoutExerciseId: Id;
  setNumber: number;
  reps: number;
  weight: number;
  notes?: string;
}

export interface AppSettings {
  id: "default";
  volumePrimaryMultiplier: number;
  volumeSecondaryMultiplier: number;
}

export interface WorkoutBundle {
  workout: Workout;
  items: {
    workoutExercise: WorkoutExercise;
    exercise: Exercise;
    sets: SetEntry[];
  }[];
}

export interface ExportPayload {
  exportedAt: string;
  version: string;
  settings: AppSettings;
  muscleGroups: MuscleGroup[];
  exercises: Exercise[];
  workouts: Workout[];
  workoutExercises: WorkoutExercise[];
  setEntries: SetEntry[];
}
