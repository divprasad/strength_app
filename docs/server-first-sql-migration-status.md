# Server-First SQL Migration Status

## Context

This branch is using an incremental bridge from local-first Dexie/IndexedDB runtime persistence toward a server-first SQLite runtime using Drizzle.

The target architecture for this branch is:

- SQLite as the long-term runtime source of truth
- server-backed JSON endpoints for every read and write
- Dexie retained temporarily as cache/fallback during the migration
- auth-ready user scoping on the server, without adding auth UI yet
- incremental replacement of local runtime paths instead of a one-step cutover

This document is a checkpoint summary for the current state of the branch. It describes:

- the higher-level migration plan
- what has already been completed
- what has been verified
- what remains incomplete
- the proposed next implementation steps

## High-Level Migration Plan

The branch is following an incremental bridge plan.

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
- client pages remain client-rendered for now, and Dexie stays in place until each read/write path is migrated safely
- export/import stays compatible with the existing `ExportPayload` shape so older local-first builds can migrate manually

### Intended rollout order

1. Add SQL foundation, bootstrap, schema, and initial server repositories
2. Persist workout rows on the server with transactional upsert
3. Add server read/bootstrap for workout rows
4. Move workout exercise mutations to the server
5. Move set entry mutations to the server
6. Flip workout reads to server-first, then widen the migration to the rest of the app

### Constraints for this branch

- no broad cutover in one pass
- no replay of `data/workouts.sql`
- no new auth UI
- no React Query in this step
- no client-provided `userId`

## What Has Been Achieved

The current branch has completed the SQL foundation slice and the first narrow workout-row write slice.

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

This currently provides server-side equivalents for:

- listing workouts by date
- loading a workout by ID
- creating a workout
- starting a workout session
- finishing a workout session
- listing workout exercises
- upserting a workout row from the current client bundle

This is not the full repository layer yet, but it establishes the server-owned pattern that later endpoints will use.

### 8. Workout-row server writes now use SQLite

The old append-only SQL text generation path has been replaced for workout rows only.

Current behavior:

- `POST /api/workouts` upserts the `workouts` row into SQLite
- user ownership is derived on the server
- repeated `start`, `finish`, and `sync` operations update the same workout row by `workout.id`
- `workout_exercises` and `set_entries` are intentionally still not persisted server-side in this slice

### 9. Initial migration SQL file added

An initial SQL file exists at:

- `drizzle/0000_initial.sql`

At this stage it acts as a checkpoint artifact for the intended first schema layout.

## What Has Been Verified

The current branch checkpoint has been statically verified, not yet fully runtime-verified.

### Checks that have passed

The following checks were run successfully after the current foundation changes:

- `npm run typecheck`
- `npm run lint`
- `npm run build`

### What has not been reworked or verified yet

The following are still pending for the SQL cutover:

- `npm run test:e2e` against a SQLite-backed workout bootstrap path
- runtime validation of workout-row recovery on refresh/new session flows

## Current Runtime Reality

Even though SQLite workout persistence now exists, the app has not been cut over yet.

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

- using Dexie as the effective runtime source of truth
- using SQLite as the durable store for workout rows only
- not yet bootstrapping workout rows from SQLite on refresh or new browser sessions
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

### 3. The next real step is server read/bootstrap for workout rows

The write path for workout rows is in place, but the read/bootstrap path is still missing. Until that exists, SQLite cannot be treated as authoritative for workout rows.

### 4. Old tests still assume local-first defaults

The existing Playwright config and tests still reflect the current local-first app assumptions:

- fully parallel execution is still enabled
- tests still expect seeded sample workout data such as default exercises
- tests are not yet reworked to use a dedicated SQLite test database

This must change before the SQL migration is complete.

## Risks and Gaps

## Source of Truth Transition

Before the next slice:

- Dexie is the UI/runtime source of truth
- SQLite is the durable store for workout rows only
- Existing local exercise and set data is protected because those tables are still local-only

After the next slice:

- SQLite becomes authoritative for workout rows
- Dexie remains as cache/fallback while exercises and sets are still migrating
- local workout rows are never deleted automatically during reconciliation

## Next Slice

Implement server read/bootstrap for workout rows only.

Scope:

- keep `POST /api/workouts` for workout-row upsert
- add list-by-date and get-by-id workout read paths
- hydrate Dexie with the newer of local/server workout rows by `updatedAt`
- fall back to Dexie when server fetch fails
- do not move `workout_exercises` or `set_entries` yet

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
