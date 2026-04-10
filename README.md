# Strength Log

Strength Log is a mobile-first workout tracker for logging training sessions quickly, reviewing history, and understanding progress over time. 

## What the app intends to do

The product is meant to cover the full workout logging loop:

- Manage a reusable exercise library and muscle groups
- Start a workout session for a chosen date
- Add exercises and log sets quickly during the session
- Review completed sessions in history (including a Gym Session Cost Tracker metric)
- See weekly analytics and progress trends
- Export data in structured formats

The core infrastructure uses a **Local-First Sync Architecture**. The app remains instantaneously responsive by writing purely to local IndexedDB (`Dexie`) and seamlessly queues all mutations to a background `syncEngine` that communicates with the `Prisma` SQL backend whenever the network is available.

## Current development status

The app is functionally complete, fully installable as a PWA, and deployable via Docker:

- **Progressive Web App (PWA):** Installs natively to Android/iOS desktops via modern Service Workers, skipping the app store entirely. Boots instantly with no browser UI padding.
- **Local-Network Docker Hosting:** Runs silently via Docker container on any home NAS or Pi network (`docker-compose up -d`), persisting SQLite tightly via `db-data` named volumes.
- **Global Command Palette:** Keyboard-friendly (`Cmd+K`) unified navigation and fast-action menu for blazing-fast workflow jumping.
- **Local-First Database:** The main source of truth is Browser IndexedDB via Dexie. Local interactions have 0ms latency.
- **Background Sync Engine:** A robust background queue automatically bundles offline changes and pushes them to the SQLite Database (`Prisma`), resolving conflicts using a secure "Client Payload Wins" strategy with automatic orphaned row deletion.
- **Automated DB Backups:** Every successful server sync creates a rolling numbered backup (`1_strength_diary_DATE_VOLkg_BU.db`, `2_…`, etc.) in `prisma/backups/`. Newest is always slot 1; old backups shift up. Infinite history, never deleted.
- Settings, history, analytics, and data export/import are fully functional. This includes a synchronized Settings schema (Volume Multipliers, UI App Scale, Gym Fee Cost Tracker) pulled directly from the server during bootstrap.
- Typecheck, lint, build, and unit tests pass locally. Playwright End-to-End coverage is available to certify the critical flow scenarios.

## Detailed Documentation

Four detailed static HTML reference files are available inside the `/docs` directory to help developers navigate the architectural choices, project structure, and roadmap. You can open them natively in any browser:
- `docs/meta_processes.html` (Local-First Sync flow)
- `docs/folder_structure.html` (Codebase Map)
- `docs/tech_stack.html` (Tooling choices)
- `docs/future_roadmap.html` (PWA Deployment path)

## Broad technical implementation

### Frontend

- `Next.js` App Router
- `React` + `TypeScript`
- `Tailwind CSS`
- Feature components under `src/components/**`

### Client-side data and state

- `Dexie` + IndexedDB for current local persistence
- `dexie-react-hooks` for reactive reads
- Internal offline `syncQueue` table for background processing
- `React Hook Form` + `Zod` for validated forms

### Domain and repository layer

- Canonical domain types in `src/types/domain.ts` (including `SyncJob`)
- Local data schema and bootstrap in `src/lib/db.ts`
- Centralized queueing logic in `src/lib/repository.ts`
- The Sync background loop in `src/lib/syncEngine.ts`

### Current server-side implementation

- A centralized API route at `src/app/api/workouts/route.ts` handles the unified `WorkoutBundle` payload via atomic Prisma `$transaction` upserts, preventing zombie rows.
- SQLite acts as the final persistent ledger. 

## Local setup (development)

### Via Docker (Recommended for PWA hosting)

To emulate the production environment serving the Progressive Web App locally via port 3400:

```bash
docker compose up --build -d
```
*(Tip: In Brave/Chrome Android, navigate to `brave://flags` and explicitly allow `http://<your-local-ip>:3400` under "Insecure origins treated as secure" to trigger the PWA Install prompt on your local home Wi-Fi!)*

### Via local Node (Development)

1. Install dependencies:
```bash
npm ci
```

2. Start the app:
```bash
npm run dev
```

3. Run automated checks:
```bash
npm run check
```

## Docker deployment (production)

With backend persistence and infrastructure formally secured via Docker and PWA, the primary architecture is stable. The remaining trajectory focuses on opening the app's functionality:

### 1. Multi-User Accounts & Authentication
Implementing multiple parallel user structures so family/friends sharing the same local URL can separate workloads. This will be protected by an **Offline 4-Digit PIN** mechanism stored in IndexedDB since standard cloud OAuth cannot bridge over a local disconnected home PWA smoothly.

### 2. Production Clean-ups
Minifying components, expanding test coverage across the newly tabbed Exercises interface, and adding user-facing UI toggles if background syncing fails consecutively.

## Automated checks

- Unit tests use `Vitest` for pure `src/lib/**` logic.
- Fast CI runs `lint`, `typecheck`, `test:unit`, and `build` on every branch push and on pull requests into `main`.
- Playwright E2E runs as a separate manual GitHub Actions workflow.
