# Strength Log

A minimal, production-leaning, mobile-first workout tracker focused on fast set logging, clean data, and local-first reliability.

## What the app does

- Manages reusable exercise library with custom muscle targeting
- Logs workouts by date with rapid set entry (reps, weight, notes)
- Browses workout history in a weekly calendar view
- Computes weekly analytics:
  - total volume
  - volume by muscle group
  - volume by exercise
- Tracks per-exercise progress over time (max weight + estimated 1RM)
- Exports all data:
  - JSON (single file)
  - CSV (one table per core entity)
- Optional JSON import to restore/replace local data

## Stack choice

- `Next.js` App Router + `React` + `TypeScript`
- `Tailwind CSS` for a restrained, mobile-first UI
- Lightweight local primitives (shadcn-style component structure, custom implementation)
- `Dexie` + IndexedDB for local-first persistence
- `Zustand` for tiny UI state (active workout date)
- `React Hook Form` + `Zod` for form validation
- `Recharts` for practical analytics charts

### Why this architecture

- **Fast to scaffold and maintain**: all core logic in a typed `lib/` layer
- **Local-first reliability**: no auth/backend dependency for MVP
- **Easy backend migration later**: domain model and repository/service boundaries are explicit
- **Good mobile logging UX**: large touch targets, quick-add patterns, sticky navigation

## Architecture overview

### Layers

- `src/types/domain.ts`: canonical domain types
- `src/lib/db.ts`: Dexie schema + first-run seed
- `src/lib/repository.ts`: write-side workflows (create workout, add set, reorder, etc.)
- `src/lib/analytics.ts`: weekly aggregates + progress points
- `src/lib/volume.ts`: configurable attribution model in one place
- `src/lib/export.ts`: JSON/CSV serialization
- `src/components/**`: UI split by feature and reusable primitives
- `src/app/**`: App Router pages per screen

### Routes

- `/` Dashboard
- `/workouts` Workout Logger
- `/exercises` Exercise + Muscle Management
- `/history` Weekly Calendar + Daily Inspection
- `/analytics` Weekly Analytics + Progress Charts
- `/settings` Export/Import

## Data model

Defined in `src/types/domain.ts`.

Core entities:

- `MuscleGroup`
- `Exercise`
- `Workout`
- `WorkoutExercise`
- `SetEntry`
- `AppSettings`

Notable design choices:

- `Workout.date` uses local date string `YYYY-MM-DD`
- many-to-many muscles on exercises via `primaryMuscleIds` + `secondaryMuscleIds`
- `WorkoutExercise` separates exercise library from a specific workout instance
- `SetEntry` is normalized and ordered via `setNumber`
- `AppSettings` stores volume multipliers (single editable place)

## Volume logic (explicit + configurable)

In `src/lib/volume.ts`:

- set volume = `reps × weight`
- primary muscles receive `100%` credit
- secondary muscles receive `50%` credit
- multipliers are stored in `AppSettings` (`volumePrimaryMultiplier`, `volumeSecondaryMultiplier`)

This makes attribution transparent and easy to adjust later.

## Local setup

1. Install dependencies:

```bash
npm install
```

2. Run dev server:

```bash
npm run dev
```

3. Open:

- [http://localhost:3000](http://localhost:3000)

Optional checks:

```bash
npm run typecheck
npm run lint
```

## End-to-end sample flow

1. Open `/exercises`, add/edit muscle groups
2. Create an exercise with primary/secondary muscles
3. Open `/workouts`, choose date, create workout
4. Add an exercise to workout
5. Add sets quickly (Add Set / Repeat Last)
6. Open `/history` and inspect the workout day
7. Open `/analytics` for weekly and progress charts
8. Open `/settings` and export JSON/CSV

## Export format

### JSON

Single file with:

- `exportedAt`
- `version`
- `settings`
- `muscleGroups[]`
- `exercises[]`
- `workouts[]`
- `workoutExercises[]`
- `setEntries[]`

### CSV

Separate files per entity table:

- `muscle_groups.csv`
- `exercises.csv`
- `workouts.csv`
- `workout_exercises.csv`
- `set_entries.csv`

`primaryMuscleIds` and `secondaryMuscleIds` are pipe-delimited (`|`) for easy parsing in pandas.

## MVP vs future improvements

### MVP included

- local-first persistence
- exercise + muscle management
- workout logging + set editing/deleting/reordering
- weekly history/calendar
- weekly analytics and basic progress charting
- JSON + CSV export (and optional JSON import)

### Future improvements

- month calendar and richer history filters
- explicit backup/sync (Supabase/Postgres)
- configurable units (kg/lb)
- workout templates/routines
- keyboard shortcuts + haptics for faster in-workout logging
- automated migration layer for future hosted backend

