# AGENTS.md

This file is the stable operating guide for agents working in this repository.

## Mission

Strength Log uses a robust "Local-First Sync Architecture" to deliver a zero-latency tracker that can operate fully offline. The structural persistence is currently complete: local Dexie changes drop `syncQueue` tickets which are processed by a background worker and `$transaction`-upserted cleanly onto a Prisma/SQLite instance whenever network drops.

The immediate priority for agents is no longer database design, but moving towards a smooth, single-user **PWA mobile app** deployment locally hosted via Docker.

## Current project state

- The UI and core product flows work. Most computations act on IndexedDB.
- **Background Sync Works:** `src/lib/syncEngine.ts` handles pushing all `WorkoutBundle` entities.
- **Garbage Collection Works:** Orphaned local sets deleted from the app correctly cause cascading deletions on the Prisma backend, so zombie data does not regenerate when pulling from the DB.
- **Auto Backups Work:** Pushing data automatically triggers a `fs.copyFile` backup of the SQLite database in the `/prisma/` folder in case corruption pushes upstream.
- **Reference Docs:** Four fundamental HTML documents mapping out the tech stack and meta processes exist natively in `/docs/`. Read them first if you are altering data structures.

## Stable working rules

1. Plan first.
2. If there are meaningful implementation tradeoffs, present short choices and recommend one.
3. Move slowly and iterate one feature or one stability improvement at a time.
4. After each change, check that nothing broke (especially UI state binding).
5. Prefer correctness and data integrity over speed.
6. Do not make broad architecture changes silently.
7. Do not revert user changes unless the user explicitly asks for it.

## execution guidance for future agents

- **Stable IDs**: Use `createStableId` in `src/lib/utils.ts` for any lookup or seed data (Exercises, MuscleGroups). Never use random UUIDs for data that must match across the client-server boundary.
- **SyncQueue Protocol**: Never write direct network `fetch` calls from React components for mutation state. All writes must go to Dexie, and subsequently call `enqueueSync(workoutId)`. The engine handles the network traffic to `route.ts`.
- **Prisma Alignment**: Ensure the database location is consistent. The standard is `prisma/dev.db`.
- When changing persistence logic, explain:
  - what the source of truth is before the change
  - what the source of truth will be after the change
  - how existing workout data is protected

## Validation expectations

After meaningful changes, run the relevant checks when possible:

- `npm run typecheck`
- `npm run lint`
- `npm run test:e2e`
- `npm run build`

If a check cannot be run, say so clearly.

## Documentation expectations

- Keep `README.md` current as the user-facing overview of the app.
- Keep this `AGENTS.md` current as the stable execution guide for future agents.
- If the roadmap changes, update both files in the same pass when appropriate.
