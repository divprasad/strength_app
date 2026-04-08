# AGENTS.md

This file is the stable operating guide for agents working in this repository.
This is the **main branch** — all layers of the stack are in scope.

---

## Mission

Strength Log is a mobile-first, local-first workout tracker built on Next.js.
It writes all user data to Browser IndexedDB (Dexie) for zero-latency interactions and asynchronously syncs mutations to a Prisma/SQLite backend via a background `syncQueue`. The app is a fully installable **PWA** (Serwist) and is **Docker-deployable** for self-hosted local-network hosting.

---

## Architecture overview

```
┌─────────────────────────────────────────────────┐
│  React UI  (Next.js App Router + Tailwind)      │
│  └─ useLiveQuery() reads from Dexie reactively  │
├─────────────────────────────────────────────────┤
│  Repository layer  (src/lib/repository.ts)      │
│  └─ All writes go to Dexie → enqueueSync()      │
├─────────────────────────────────────────────────┤
│  Sync Engine  (src/lib/syncEngine.ts)           │
│  └─ Drains syncQueue → POST /api/workouts       │
│  └─ Auto-triggers on `online` event             │
├─────────────────────────────────────────────────┤
│  API Routes  (src/app/api/**/route.ts)          │
│  └─ Prisma $transaction upserts to SQLite       │
│  └─ Auto-backup on every workout sync           │
├─────────────────────────────────────────────────┤
│  SQLite  (prisma/dev.db)                        │
│  └─ Final persistent ledger                     │
└─────────────────────────────────────────────────┘
```

### Key data flow rules

1. **All mutations go through Dexie first.** Components never call `fetch()` for writes. The repository writes to IndexedDB, then calls `enqueueSync(workoutId)`.
2. **The sync engine is the only network writer.** `syncEngine.ts` drains the `syncQueue` table and POSTs `WorkoutBundle` payloads to the API. Failed jobs get `status: "failed"` and increment `retryCount`.
3. **Bootstrap pulls server → client.** On app load, `bootstrapFromServer()` fetches muscles, exercises, and workouts from the API and bulk-puts them into Dexie in a single atomic transaction. If the server is unreachable, the app falls back to local seed data.
4. **Garbage collection is server-side.** When a workout sync arrives, the API route diffs incoming exercise/set IDs against existing rows and deletes orphans within the same `$transaction`. This prevents zombie rows from regenerating on the next pull.

---

## Current project state

| Area | Status | Notes |
|------|--------|-------|
| Core workout loop | ✅ Stable | Create → start → log sets → finish → history |
| UI/UX & Components | ✅ Polished | Press-and-hold animations, animated pills, bottom sheets, smart pre-fill |
| Dashboard & History | ✅ Enhanced | 30-day scrollable calendar, "Copy as Template", gym session cost tracker |
| PWA | ✅ Optimized | Serwist service worker, offline-first caching, Android native-like fullscreen |
| Docker | ✅ Complete | Multi-stage build, ~180 MB image, named volume persistence |
| Sync engine | ✅ Robust | Background queue with exponential backoff, `online` auto-trigger, UI sync status |
| Cascading delete | ✅ Working | Server-side orphan cleanup within `$transaction` |
| Auto backups | ✅ Working | `fs.copyFile` of SQLite DB on every sync POST |
| Bootstrap gate | ✅ Hardened | 30s server timeout, 10s local timeout, 45s hard deadline |
| Integrity audit | ✅ Implemented | `integrity-audit.ts` with `healDatabase()` auto-fixer |
| Command palette | ✅ Implemented | `Cmd+K` global navigation and quick actions |
| Analytics | ✅ Present | Weekly volume, muscle distribution, gym session cost tracker |
| Export/Import | ✅ Present | JSON export, server bootstrap pull from Settings |
| CI | ✅ Active | `lint`, `typecheck`, `test:unit`, `build` on push; E2E manual |

### Known areas needing attention

- **Multi-user support** — currently single-user (`DEFAULT_USER_ID`). Auth and user separation are not yet implemented.
- **E2E test coverage** — only one spec file exists (`app.e2e.spec.ts`); critical flows need more coverage.
- **Bundle size** — no active optimization pass has been done.

---

## File map (key files)

| Path | Purpose |
|------|---------|
| `src/lib/db.ts` | Dexie schema (7 versions), `ensureBootstrapped()`, seed logic |
| `src/lib/repository.ts` | All domain operations (CRUD, sync enqueue, session lifecycle) |
| `src/lib/syncEngine.ts` | Background sync queue processor |
| `src/lib/sync.ts` | Server → client bootstrap (muscles, exercises, workouts) |
| `src/lib/integrity-audit.ts` | Data consistency checker + auto-healer |
| `src/lib/analytics.ts` | Volume/frequency computations for the analytics page |
| `src/types/domain.ts` | Canonical TypeScript types for all domain entities |
| `src/hooks/use-db-bootstrap.ts` | Client-side bootstrap lifecycle with timeout safety nets |
| `src/components/layout/bootstrap-gate.tsx` | Renders loading screen until DB is ready |
| `src/components/layout/command-palette.tsx` | Global `Cmd+K` command palette |
| `src/components/layout/app-shell.tsx` | Top-level app shell with navigation |
| `src/app/api/workouts/route.ts` | Workout bundle upsert/delete with garbage collection |
| `src/app/api/muscles/route.ts` | Muscle group CRUD |
| `src/app/api/exercises/route.ts` | Exercise CRUD |
| `prisma/schema.prisma` | Server-side SQLite schema |
| `prisma/seed.ts` | Initial Prisma seed data |

---

## Stable working rules

1. **Plan first.** If there are meaningful implementation tradeoffs, present short choices and recommend one.
2. **Iterate one thing at a time.** Don't combine unrelated changes in a single pass.
3. **After each change, verify nothing broke** — especially UI state binding and sync integrity.
4. **Prefer correctness and data integrity over speed.**
5. **Do not make broad architecture changes silently.** Explain what you're changing and why.
6. **Do not revert user changes** unless the user explicitly asks for it.

---

## Execution guidance

### IDs and data identity

- **Stable IDs** — Use `createStableId()` in `src/lib/utils.ts` for any lookup or seed data (exercises, muscle groups). These must match across the client-server boundary. Never use random UUIDs for seed data.
- **Runtime IDs** — Use `createId(prefix)` for user-created entities (workouts, sets, workout exercises). These are random and unique.

### Sync protocol

- **Never write direct `fetch()` from components.** All mutations go through the repository layer → Dexie → `enqueueSync()`.
- **The sync engine handles network traffic.** It reads from `syncQueue`, builds `WorkoutBundle` payloads, and POSTs to `/api/workouts`.
- **Deletes are sync-aware.** `enqueueSync(workoutId, "delete")` queues a DELETE that the engine sends as `DELETE /api/workouts?id=...`.

### Persistence changes

When modifying anything related to data storage, explain:
1. What the source of truth is **before** the change
2. What the source of truth will be **after** the change
3. How existing user data is protected

### Database locations

- **Development:** `prisma/dev.db` (set in `.env` as `DATABASE_URL`)
- **Backup reference:** `prisma/backups/` — rolling numbered backups (`1_strength_diary_DATE_VOLkg_BU.db`, etc.)
- **Test:** `prisma/dev_test.db` (set in `playwright.config.ts`)

### Dexie schema versioning

The Dexie database is at **version 7**. Versions jump (1 → 2 → 4 → 5 → 7) which is valid for Dexie. Key migrations:
- v2: Added `status`, `userId` to workouts
- v4: Added `name` to workouts, `type` to sets
- v5: Added `syncQueue` table
- v7: Renamed `muscles` → `muscleGroups` (with data migration)

**To add a new version:** Increment from 7 (use 8, not 9). Always provide an `.upgrade()` callback if existing data needs transformation.

### Bootstrap flow

The app shows "Preparing local database…" until the bootstrap gate unlocks:
1. `bootstrapFromServer()` pulls all server data (30s timeout)
2. `ensureBootstrapped()` seeds local settings if needed (10s timeout)
3. If both fail, a 45s hard deadline forces the UI to render anyway
4. The cached promise in `ensureBootstrapped()` self-clears on rejection so retries work

---

## UI and design conventions

- **Design system:** Tailwind CSS with CSS custom properties for theming (`globals.css`)
- **Component library:** Custom primitives in `src/components/ui/` (Button, Card, Modal, BottomSheet, Combobox, StepperInput, etc.)
- **Icons:** Lucide React
- **Charts:** Recharts
- **Forms:** React Hook Form + Zod validation
- **State:** Zustand for global UI state (`src/lib/store.ts`); Dexie `useLiveQuery` for data
- **Responsive:** Mobile-first with a bottom nav bar (`bottom-nav.tsx`)
- **Theme:** Light/dark mode via `theme-provider.tsx`; user-selectable color palettes

---

## Validation expectations

After meaningful changes, run the relevant checks:

```bash
npm run typecheck    # tsc --noEmit
npm run lint         # eslint
npm run test:unit    # vitest run
npm run build        # next build
npm run test:e2e     # playwright (requires dev server running)
```

If a check cannot be run, say so clearly and explain why.

---

## Documentation expectations

- Keep `README.md` current as the user-facing overview of the app.
- Keep this `AGENTS.md` current as the stable execution guide for agents.
- Reference docs in `/docs/` cover architecture decisions — update them if the architecture changes.
- If the roadmap changes, update both `README.md` and `AGENTS.md` in the same pass.
