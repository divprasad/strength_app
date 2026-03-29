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

The app is functionally complete, fully installable as a PWA, and deployable via Docker:

- **Progressive Web App:** Installable to any phone's home screen via Serwist service workers. Boots instantly offline with precached bundles.
- **Docker Self-Hosting:** A multi-stage `Dockerfile` + `docker-compose.yml` produces a lean ~180 MB image that runs on any local network device (NAS, Raspberry Pi, laptop).
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

## Local setup (development)

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

## Docker deployment (production)

Build and start the container:

```bash
docker compose up --build -d
```

The app will be available at `http://localhost:3000`. The SQLite database is persisted in a named Docker volume (`db-data`) and survives container rebuilds.

To stop:

```bash
docker compose down
```

To view logs:

```bash
docker compose logs -f strength-log
```

## Roadmap

### ✅ Phase 1 — PWA Transformation (shipped)
The app is a fully installable PWA via Serwist service workers. Manifest, icons, and offline caching are complete.

### ✅ Phase 2 — Local-Network Backend Hosting (shipped)
Dockerized with a multi-stage build, named volumes for SQLite persistence, and an entrypoint that handles migrations and seeding.

### ◆ Phase 3 — Production Hardening (in progress)
- **Sync Status UI:** User-facing sync indicator and failure notifications.
- **Docker Smoke Testing:** End-to-end validation on target hardware.
- **Test Coverage Expansion:** E2E tests for Exercises UI, command palette, PWA install flow.
- **Bundle Optimization:** Static route conversion and asset minification.

## Automated checks

- Unit tests use `Vitest` for pure `src/lib/**` logic.
- Fast CI runs `lint`, `typecheck`, `test:unit`, and `build` on every branch push and on pull requests into `main`.
- Playwright E2E runs as a separate manual GitHub Actions workflow.
