# AGENTS.md

This file is the stable operating guide for agents working in this repository.

## Mission

Strength Log is moving from a local-first MVP into a stable server-backed web app. The immediate priority is reliable persistence: workout data must be stored properly on the server in SQL tables, and each new workout session must append new data cleanly without corrupting or duplicating existing records.

## Current project state

- The UI and basic product flows work
- The app currently uses Dexie/IndexedDB as the effective source of truth
- A server route exists, but it currently appends SQL text to a file instead of writing to a real SQL database
- The repository should be treated as a prototype being stabilized, not as a finished backend architecture

## Stable working rules

1. Plan first.
2. If there are meaningful implementation tradeoffs, present short choices and recommend one.
3. Move slowly and iterate one feature or one stability improvement at a time.
4. After each change, check that nothing broke.
5. Prefer correctness and data integrity over speed.
6. Do not make broad architecture changes silently.
7. Do not revert user changes unless the user explicitly asks for it.

## Current engineering priority order

1. Add a real SQL backend with migrations and relational constraints.
2. Replace append-only SQL file output with real transactional inserts and upserts.
3. Add server-side read/bootstrap so the app can load persisted data on refresh and in new sessions.
4. Route all important workout mutations through the server.
5. Add automated tests for persistence, repeated sessions, and client/server sync.

## Execution guidance for future agents

- Treat server-side persistence as the main stabilization track.
- Do not add unrelated product features ahead of persistence work unless the user explicitly asks.
- Keep changes narrow and reviewable.
- Prefer updating existing docs when plans change instead of scattering planning notes across new files.
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
