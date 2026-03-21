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

The long-term goal is a stable web app where workout data is stored safely on the server in SQL tables, and every new session appends cleanly to the same persistent dataset.

## Current development status

The app is currently at a functional MVP stage:

- The web app UI works
- The main workout flow works locally
- History, analytics, export, and import are present
- Typecheck, lint, build, and unit tests pass locally

The important limitation is that persistence is still primarily local-first:

- The main source of truth is currently browser IndexedDB via Dexie.
- **SQL Transition Underway**: We are moving towards a server-backed SQL model. The database schema has been prepared to support workout statuses (`draft`, `active`, `completed`) and user ownership.
- A server route exists that records workout mutations as a SQL journal in `data/workouts.sql`.
- **Infrastructure Ready**: CI/CD and E2E automation are fully integrated into the stable `main` branch.

That means the app is usable for prototyping, but it is not yet stable as a server-backed multi-session system.

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
- That route currently writes raw SQL statements into `data/workouts.sql`
- It is not yet connected to a real SQL engine, migration system, or server-side source of truth

## Key files

- `src/app/workouts/page.tsx`: workout logging route
- `src/components/workout/workout-logger.tsx`: main workout session UI
- `src/lib/db.ts`: Dexie schema and bootstrapping
- `src/lib/repository.ts`: workout mutations and session persistence hooks
- `src/app/api/workouts/route.ts`: current server persistence stub
- `src/components/settings/export-panel.tsx`: export, import, and integrity checks

## Stabilization roadmap

These are the next five high-priority steps to make the app stable as a server-backed product:

### 1. Add a real SQL backend with migrations and relational constraints

Move from the append-only SQL file to a real database with actual tables, primary keys, foreign keys, and a repeatable migration flow.

### 2. Replace file-appended SQL with transactional inserts and upserts

The server should write directly to SQL tables using idempotent create/update logic instead of appending duplicate raw `INSERT` statements to a text file.

### 3. Add a server bootstrap/read path

The app must be able to load persisted workouts, exercises, and sets from the server so refreshes and new sessions start from server data rather than only local IndexedDB.

### 4. Route all important mutations through the server

Creating workouts, adding exercises, adding sets, editing sets, deleting sets, reordering sets, and finishing sessions all need server-backed persistence.

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

## Automated checks

- Unit tests use `Vitest` for pure `src/lib/**` logic.
- Fast CI runs `lint`, `typecheck`, `test:unit`, and `build` on every branch push and on pull requests into `main`.
- Playwright E2E runs as a separate manual GitHub Actions workflow until the suite is stable enough to block merges.

## Short-term product direction

The immediate engineering priority is not adding more user-facing features. It is making persistence reliable and making the server-side database the real source of truth.

Once that is stable, the app will be in a much better position for:

- multi-device continuity
- reliable backups
- hosted deployment
- future auth and user accounts
- higher confidence analytics and history
