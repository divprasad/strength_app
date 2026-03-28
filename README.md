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

The core infrastructure uses a **Local-First Sync Architecture**. The app remains instantaneously responsive by writing purely to local IndexedDB (`Dexie`) and seamlessly queues all mutations to a background `syncEngine` that communicates with the `Prisma` SQL backend whenever the network is available.

## Current development status

The app is functionally complete and boasts a highly reliable architectural foundation:

- The web app UI works perfectly offline and is heavily optimized.
- **Local-First Database:** The main source of truth is Browser IndexedDB via Dexie. Local interactions have 0ms latency.
- **Background Sync Engine:** A robust background queue automatically bundles offline changes and pushes them to the SQLite Database (`Prisma`), resolving conflicts using a secure "Client Payload Wins" strategy with automatic orphaned row deletion.
- **Automated DB Backups:** Every successful server sync automatically commands the server to duplicate the SQLite `dev.db` locally as a fallback measure.
- History, analytics, export, and import are present. Pulling/Bootstrapping directly from the server is supported via the Settings panel.
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

## Future Stabilization roadmap

With backend persistence formally accomplished via the sync queue, the final trajectory of the application focuses on turning it into a deployable, single-player native app experience:

### 1. PWA Transformation
Adding standard `manifest.json` configurations and Service Workers to cache routing files locally, effectively removing the browser URL bar when installed to an Android desktop.

### 2. Local-Network Backend Hosting
Dockerizing the repository to run silently on a home NAS or Raspberry Pi on the local network rather than a public Vercel instance, securing the unauthenticated app.

### 3. Production Clean-ups
Minifying components, expanding test coverage across the newly tabbed Exercises interface, and adding user-facing UI toggles if background syncing fails consecutively.

## Automated checks

- Unit tests use `Vitest` for pure `src/lib/**` logic.
- Fast CI runs `lint`, `typecheck`, `test:unit`, and `build` on every branch push and on pull requests into `main`.
- Playwright E2E runs as a separate manual GitHub Actions workflow.
