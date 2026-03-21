# Strength Log

Strength Log is a mobile-first workout tracker for logging training sessions quickly, reviewing history, and understanding progress over time.

## What the app intends to do

The product is meant to cover the full workout logging loop:

- Manage a reusable exercise library and muscle groups
- Start a workout session for a chosen date
- Add exercises and log sets quickly during the session
- Review completed sessions in history
- See weekly analytics and progress trends
- Export data in structured formats

The long-term goal is a stable web app where workout data is stored safely on the server in SQL tables and the runtime can move to a server-first model without data loss.

## Current development status

The app is currently at a functional MVP stage:

- The web app UI works
- The main workout flow works locally
- History, analytics, export, and import are present
- Typecheck, lint, build, and unit tests pass locally

The app is currently in an incremental bridge phase between local-first runtime behavior and a server-first SQLite backend:

- Dexie/IndexedDB is still the effective runtime source of truth for reads and most mutations
- SQLite now stores `workouts` rows durably through transactional upsert on the server
- `workout_exercises` and `set_entries` still remain local-only
- New browser sessions or refreshes do not yet bootstrap workout rows from the server

That means the app is still usable as a prototype, but the migration is only partially complete.

The current end-to-end coverage is still being stabilized:

- Playwright scenarios exist for workout and settings flows
- Those scenarios are not yet the required merge gate in CI

## Broad technical implementation

### Frontend

- `Next.js` App Router
- `React` + `TypeScript`
- `Tailwind CSS`
- Feature components under `src/components/**`

### Client-side data and state

- `Dexie` + IndexedDB for current local persistence
- `dexie-react-hooks` for reactive reads
- `Zustand` for small UI state
- `React Hook Form` + `Zod` for validated forms

### Domain and repository layer

- Canonical domain types in `src/types/domain.ts`
- Local data schema and bootstrap in `src/lib/db.ts`
- Workout and entity workflows in `src/lib/repository.ts`
- Analytics and derived metrics in `src/lib/analytics.ts`

### Current server-side implementation

- A single API route at `src/app/api/workouts/route.ts`
- `POST /api/workouts` now persists the `workouts` row into SQLite using transactional insert-or-update semantics
- The server derives user ownership instead of trusting a client-provided `userId`
- There is not yet a server bootstrap/read path for workout rows

## Key files

- `src/app/workouts/page.tsx`: workout logging route
- `src/components/workout/workout-logger.tsx`: main workout session UI
- `src/lib/db.ts`: Dexie schema and bootstrapping
- `src/lib/repository.ts`: workout mutations and session persistence hooks
- `src/app/api/workouts/route.ts`: workout-row server persistence endpoint
- `src/server/repositories/workout-repository.ts`: server-side workout row reads and writes
- `src/components/settings/export-panel.tsx`: export, import, and integrity checks

## Stabilization roadmap

The branch is following an incremental bridge strategy. Near term, Dexie remains in place while workout persistence moves to SQLite one slice at a time. Long term, the destination is still a server-first SQLite app.

### 1. Add server bootstrap/read for workout rows

Add narrow read endpoints so the app can hydrate Dexie with persisted workout rows on refresh and in new browser sessions.

### 2. Move workout exercise mutations to the server

Persist `workout_exercises` transactionally behind existing flows, one mutation at a time, while keeping the blast radius small.

### 3. Move set entry mutations to the server

Persist `set_entries` server-side with ordering and uniqueness guarantees once workout exercises are server-backed.

### 4. Flip workout reads to server-first with Dexie as cache/fallback

After workouts, workout exercises, and sets are all persisted, make SQLite authoritative for those reads while retaining Dexie as a temporary cache/offline layer.

### 5. Add tests for persistence and repeated sessions

Expand automated coverage to prove that:

- a refresh keeps the same data
- a new session appends data instead of overwriting
- an edited session updates existing rows correctly
- server and client stay in sync

## Local setup

1. Install dependencies:

```bash
npm install
```

2. Start the app:

```bash
npm run dev
```

3. Run checks:

```bash
npm run typecheck
npm run lint
npm run test:unit
npm run test:e2e
npm run build
```

## Source of Truth Today

Before the next slice:

- Dexie is the UI/runtime source of truth
- SQLite is the durable store for workout rows only
- Existing local exercise and set data is still protected because those records are not deleted or migrated yet

After the next slice:

- SQLite will become authoritative for workout rows
- Dexie will remain as cache/fallback during the migration
- Exercise and set details will still remain local until later slices move them server-side

## Automated checks

- Unit tests use `Vitest` for pure `src/lib/**` logic.
- Fast CI runs `lint`, `typecheck`, `test:unit`, and `build` on every branch push and on pull requests into `main`.
- Playwright E2E runs as a separate manual GitHub Actions workflow until the suite is stable enough to block merges.

## Short-term product direction

The immediate engineering priority is not adding more user-facing features. It is making workout persistence reliable, then adding server bootstrap for persisted workout rows without broadening the cutover.

Once that bridge is stable, the app will be in a much better position for:

- multi-device continuity
- reliable backups
- hosted deployment
- future auth and user accounts
- higher confidence analytics and history
