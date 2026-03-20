# Server-First SQL Migration Status

## Context

This branch is the start of a hard cutover from local-first Dexie/IndexedDB runtime persistence to a server-first SQLite runtime using Drizzle.

The target architecture for this branch is:

- SQLite as the only runtime source of truth
- server-backed JSON endpoints for every read and write
- no Dexie runtime dependency in the shipped application
- auth-ready user scoping on the server, without adding auth UI yet
- manual import/export migration from old local-first builds instead of dual-write

This document is a checkpoint summary for the current state of the branch. It describes:

- the higher-level migration plan
- what has already been completed
- what has been verified
- what remains incomplete
- the proposed next implementation steps

## High-Level Migration Plan

The branch is following a hard-cutover plan instead of a gradual dual-write strategy.

### Planned end state

- `better-sqlite3` provides a Node-only SQLite database at `data/strength.sqlite`
- Drizzle defines the canonical SQL schema and query layer
- the server owns:
  - user resolution
  - ID generation
  - timestamps
  - workout status transitions
  - set numbering and reorder integrity
  - transactional writes
- client pages remain client-rendered for now, but they fetch from JSON endpoints rather than Dexie
- export/import stays compatible with the existing `ExportPayload` shape so older local-first builds can migrate manually

### Intended rollout order

1. Add SQL foundation, bootstrap, schema, and initial server repositories
2. Move Settings export/import/integrity to SQL
3. Move muscle and exercise management to SQL
4. Move workout logger reads and mutations to SQL
5. Move history, analytics, and dashboard to SQL
6. Remove Dexie and clean up dead runtime paths

### Constraints for this branch

- no dual-write
- no replay of `data/workouts.sql`
- no new auth UI
- no React Query in this step
- no client-provided `userId`

## What Has Been Achieved

The current branch has completed the first foundation slice only.

### 1. SQL dependencies added

The project now includes the SQL migration/runtime dependencies needed for the server-first cutover:

- `better-sqlite3`
- `drizzle-orm`
- `drizzle-kit`
- `@types/better-sqlite3`

These are present in `package.json`.

### 2. Drizzle configuration added

Drizzle config now exists at:

- `drizzle.config.ts`

Current configuration points Drizzle schema generation to:

- `src/server/db/schema.ts`

and uses:

- `./data/strength.sqlite`

as the SQLite database path.

### 3. Initial SQL schema defined

The branch now includes a server-side schema module at:

- `src/server/db/schema.ts`

The schema currently defines these tables:

- `users`
- `settings`
- `muscles`
- `exercises`
- `exercise_muscles`
- `workouts`
- `workout_exercises`
- `set_entries`

The schema already models several important invariants:

- per-user muscle name uniqueness
- per-user exercise name uniqueness
- unique `order_index` per workout
- unique `set_number` per workout exercise
- workout `status` check constraint for:
  - `draft`
  - `active`
  - `completed`
- foreign keys across the main data graph
- cascade semantics on the tables that should be deleted with their parent rows

### 4. SQLite bootstrap module added

A server-only DB bootstrap module now exists at:

- `src/server/db/index.ts`

This module currently does the following:

- ensures the `data/` directory exists
- opens `data/strength.sqlite`
- enables foreign keys
- initializes the current SQL schema if tables do not exist yet
- seeds minimal server-owned defaults

### 5. Minimal default seed is in place

The SQLite bootstrap seeds only the minimal data needed for server-first startup:

- the default server user
- default settings
- default muscle groups

It does not seed:

- sample exercises
- sample workouts
- sample sets

That is aligned with the branch goal of removing fake/demo runtime data.

### 6. Server-side current-user resolver added

A minimal server-only current-user resolver now exists at:

- `src/server/current-user.ts`

For this phase, it always returns the default server user. This keeps the branch auth-ready without adding any auth UI yet.

### 7. First server repository scaffold added

A first repository module now exists at:

- `src/server/repositories/workout-repository.ts`

This currently provides early server-side equivalents for:

- listing workouts by date
- loading a workout by ID
- creating a workout
- starting a workout session
- finishing a workout session
- listing workout exercises

This is not the full repository layer yet, but it establishes the server-owned pattern that later endpoints will use.

### 8. Initial migration SQL file added

An initial SQL file exists at:

- `drizzle/0000_initial.sql`

At this stage it acts as a checkpoint artifact for the intended first schema layout.

## What Has Been Verified

The current branch checkpoint has been statically verified, not yet fully runtime-verified.

### Checks that have passed

The following checks were run successfully after the current foundation changes:

- `npm run typecheck`
- `npm run lint`

### What has not been reworked or verified yet

The following are still pending for the SQL cutover:

- `npm run build` against a fully migrated runtime path
- `npm run test:e2e` against a SQLite-backed server-owned runtime
- runtime validation of the new SQLite bootstrap under actual screen/API usage

## Current Runtime Reality

Even though the SQL foundation exists, the app has not been cut over yet.

### What still uses Dexie today

The current runtime still depends on Dexie in multiple places, including:

- dashboard
- workout logger
- exercise list
- muscle manager
- history
- analytics
- settings export/import/integrity

The existing app still reads from and writes to Dexie at runtime.

### What that means

Right now this branch is:

- valid as infrastructure groundwork
- not yet a complete server-first migration
- not yet ready to claim that Dexie has been removed at runtime

This is an expected intermediate state, but it is not yet a complete or review-ready cutover.

## Important Technical Notes

### 1. The branch is intentionally incomplete

This branch has only completed the database foundation slice. It has not yet migrated a full vertical feature path end-to-end.

### 2. There is temporary schema duplication

The current foundation contains the schema in two places:

- Drizzle table definitions in `src/server/db/schema.ts`
- bootstrap SQL in `src/server/db/index.ts`

This is acceptable only as a short-lived checkpoint. It should be collapsed into a single migration/bootstrap strategy in the next steps, otherwise drift risk increases.

### 3. Old persistence still exists

The old append-only `/api/workouts` path still exists in the application codebase. It has not been retired yet.

### 4. Old tests still assume local-first defaults

The existing Playwright config and tests still reflect the current local-first app assumptions:

- fully parallel execution is still enabled
- tests still expect seeded sample workout data such as default exercises
- tests are not yet reworked to use a dedicated SQLite test database

This must change before the SQL migration is complete.

## Risks and Gaps

The current main risks are architectural rather than syntactic.

### Immediate risks

- partial migration state can confuse future work if it is treated as a finished cutover
- duplicated schema declaration can drift
- old UI screens still depend on Dexie runtime behavior
- existing E2E tests do not yet validate the new server-first architecture

### Review risk

This branch is not yet ideal for a normal feature PR because it adds infrastructure without completing a user-visible path on top of it.

### Data migration risk

Manual JSON import/export compatibility has not been validated yet against the SQLite server repositories.

## Recommended Next Steps

The next work should continue as narrow vertical slices, one feature path at a time.

### Recommended next slice

Move Settings to SQL first.

Reason:

- it is narrower than the workout logger
- it directly exercises server-owned export/import/integrity behavior
- it provides a concrete vertical path for validating the new database
- it avoids starting with the highest-churn logger surface

### Proposed implementation sequence

1. Add server JSON endpoints for:
   - export
   - import
   - integrity report
2. Reimplement export/import/integrity against SQLite repositories
3. Switch the Settings screen from Dexie to direct fetch-based loading and mutations
4. Rework the Playwright import/export test to use the new SQL-backed path
5. Then move muscle and exercise management to SQL
6. Then move the workout logger
7. Then move history, analytics, and dashboard
8. Remove Dexie and bootstrap gate once no runtime screen depends on them

## Proposed Test Strategy

The test plan should be updated alongside the migration rather than postponed to the very end.

### Near-term checks for the next slice

- keep `npm run typecheck`
- keep `npm run lint`
- add `npm run build`
- rework Playwright to run serially once persistence becomes server-owned

### Future SQLite-backed E2E goals

- fresh DB shows empty states
- hard refresh preserves server-owned data
- import payload persists after reload
- same-day multiple workouts remain distinct after refresh
- set edits, deletes, and reorder operations persist correctly

## Current Recommendation

This branch should continue development before any push-for-review decision is made.

It is a solid foundation checkpoint, but not yet a complete migration branch. The practical next milestone is:

- one full vertical slice migrated to server-backed SQL
- tests updated for that slice
- build and E2E rerun against the new server-first path

At that point, the branch becomes much easier to review and much less likely to accumulate migration debt.
