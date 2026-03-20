import { sql } from "drizzle-orm";
import { check, integer, primaryKey, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull()
});

export const settings = sqliteTable("settings", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  volumePrimaryMultiplier: real("volume_primary_multiplier").notNull(),
  volumeSecondaryMultiplier: real("volume_secondary_multiplier").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull()
});

export const muscles = sqliteTable(
  "muscles",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull()
  },
  (table) => ({
    userNameIdx: uniqueIndex("muscles_user_name_idx").on(table.userId, table.name)
  })
);

export const exercises = sqliteTable(
  "exercises",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    category: text("category"),
    equipment: text("equipment"),
    notes: text("notes"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull()
  },
  (table) => ({
    userNameIdx: uniqueIndex("exercises_user_name_idx").on(table.userId, table.name)
  })
);

export const exerciseMuscles = sqliteTable(
  "exercise_muscles",
  {
    exerciseId: text("exercise_id")
      .notNull()
      .references(() => exercises.id, { onDelete: "cascade" }),
    muscleId: text("muscle_id")
      .notNull()
      .references(() => muscles.id, { onDelete: "restrict" }),
    isPrimary: integer("is_primary", { mode: "boolean" }).notNull()
  },
  (table) => ({
    pk: primaryKey({ columns: [table.exerciseId, table.muscleId, table.isPrimary] })
  })
);

export const workouts = sqliteTable(
  "workouts",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    date: text("date").notNull(),
    status: text("status").notNull(),
    notes: text("notes"),
    sessionStartedAt: text("session_started_at"),
    sessionEndedAt: text("session_ended_at"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull()
  },
  (table) => ({
    userDateIdx: uniqueIndex("workouts_user_date_idx").on(table.userId, table.date, table.id),
    statusCheck: check("workouts_status_check", sql`${table.status} in ('draft', 'active', 'completed')`)
  })
);

export const workoutExercises = sqliteTable(
  "workout_exercises",
  {
    id: text("id").primaryKey(),
    workoutId: text("workout_id")
      .notNull()
      .references(() => workouts.id, { onDelete: "cascade" }),
    exerciseId: text("exercise_id")
      .notNull()
      .references(() => exercises.id, { onDelete: "restrict" }),
    orderIndex: integer("order_index").notNull(),
    createdAt: text("created_at").notNull(),
    startedAt: text("started_at"),
    completedAt: text("completed_at")
  },
  (table) => ({
    workoutOrderIdx: uniqueIndex("workout_exercises_workout_order_idx").on(table.workoutId, table.orderIndex)
  })
);

export const setEntries = sqliteTable(
  "set_entries",
  {
    id: text("id").primaryKey(),
    workoutExerciseId: text("workout_exercise_id")
      .notNull()
      .references(() => workoutExercises.id, { onDelete: "cascade" }),
    setNumber: integer("set_number").notNull(),
    reps: integer("reps").notNull(),
    weight: integer("weight").notNull(),
    notes: text("notes"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull()
  },
  (table) => ({
    workoutSetIdx: uniqueIndex("set_entries_workout_set_idx").on(table.workoutExerciseId, table.setNumber)
  })
);

export const schema = {
  users,
  settings,
  muscles,
  exercises,
  exerciseMuscles,
  workouts,
  workoutExercises,
  setEntries
};
