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
  deletedAt?: string;
}

export interface Workout extends Timestamps {
  id: Id;
  name: string; // Added to match journal
  date: string; // YYYY-MM-DD local date
  status: WorkoutStatus;
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
  type: string; // normal, warmup, dropset, fail
  notes?: string;
  completedAt?: string; // Added to match journal
}

export interface AppSettings {
  id: "default";
  volumePrimaryMultiplier: number;
  volumeSecondaryMultiplier: number;
  themePref?: "light" | "dark";
  paletteIdx?: number;
  /** Gym membership fee per billing period (default: 48) */
  gymFee?: number;
  /** Billing period in days (default: 28) */
  gymFeePeriodDays?: number;
  /** Target cost per session in euros (default: 3) */
  gymFeeTargetPerSession?: number;
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

export type IntegrityIssueSeverity = "error" | "warning";

export interface IntegrityIssue {
  entity: string;
  id?: string;
  severity: IntegrityIssueSeverity;
  message: string;
  details?: Record<string, unknown>;
}

export interface IntegrityAuditSummary {
  total: number;
  errors: number;
  warnings: number;
}

export interface IntegrityAuditReport {
  ok: boolean;
  summary: IntegrityAuditSummary;
  issues: IntegrityIssue[];
}

export type WorkoutStatus = "draft" | "active" | "completed" | "archived";

export interface SyncJob {
  id: string;
  action: "upsert" | "delete";
  status: "pending" | "failed";
  retryCount: number;
  lastAttemptAt?: string;
  createdAt: string;
}
