# Strength Log 🏋️

Strength Log is a mobile-first, local-first workout tracker built on Next.js. It's designed to be instantaneously responsive by writing purely to local IndexedDB (`Dexie`) and queueing asynchronous syncs to a `Prisma`/`SQLite` backend whenever a network is available.

> [!IMPORTANT]
> **🤖 ARE YOU AN AI AGENT?** 
> Before making *any* code changes or tool calls, you **MUST** read `AGENTS.md`. It contains strict surgical edit rules, local-first architecture bounds, and the core files you are forbidden from modifying without explicit permission.

---

## 🏗️ Architecture Quick-Start

Strength Log employs a strict **Local-First Sync Architecture**. The app remains incredibly fast because the UI never waits on a network request to load or save data.

```text
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

**Key Data Rule:** All UI components read and write to IndexedDB. Components **never** call `fetch()` directly for mutations.

---

## 🚀 Developer Workflows

This app supports two primary development paths depending on whether you are adjusting UI components or testing the Progressive Web App (PWA) installation flow.

### Path A: Standard Local Development (Node)
Use this path for general feature development, UI changes, and testing backend logic.

1. First, set up your local environment variables:
   ```bash
   cp .env.example .env
   # Ensure DATABASE_URL is set correctly for your Prisma dev db
   ```
2. Install dependencies:
   ```bash
   npm ci
   ```
2. Start the development server:
   ```bash
   npm run dev
   ```
3. Run automated assurance checks:
   ```bash
   npm run check
   ```

### Path B: Production & PWA Testing (Docker)
Use this path if you need to test the service worker, offline caching, or natively installing the app to a mobile device.

1. Boot the entire stack (Next.js + Persistent SQLite Volume):
   ```bash
   docker compose up --build -d
   ```
*(Tip: To test PWA installation on a local mobile device, navigate to `brave://flags` or `chrome://flags` on your phone, and explicitly allow `http://<your-local-ip>:3400` under "Insecure origins treated as secure")*

---

## ⚠️ File Boundaries & Danger Zones

To protect the integrity of the off-line syncing mechanisms, explicit boundaries exist within the codebase.

- 🔴 **DANGER ZONE (Do not touch without Extreme Care)**:
  - `src/lib/syncEngine.ts` - The heart of the network queue. 
  - `src/lib/repository.ts` - The primary data abstraction. 
  - `src/lib/db.ts` - Schema migrations and Dexie config.
  Any modifications here risk corrupting user data or breaking the sync loop. See `AGENTS.md` for "Surgical Edit Rules".

- 🟢 **SAFE ZONES**:
  - `src/components/**` - UI views and components.
  - `src/app/**` - Next.js routes and layouts.

---

## 🤝 Contribution Guidelines

To maintain synchronization stability and code legibility, please adhere to the following when submitting PRs:
- **Use Conventional Commits**: e.g., `feat: offline pin auth`, `fix: zombie row bug in sync`
- **Agent Hand-off**: If an AI agent assisted with your contribution, ensure they have updated `AGENTS.md` or `/docs` with any new context before terminating the session.
- **Troubleshooting IndexedDB**: If you enter a broken local state during development, IndexedDB might be corrupt. Go to `Chrome Dev Tools -> Application -> Storage -> Clear site data` and reload. Do not attempt to forcefully delete migrations unless you know what you are doing.

---

## 📚 Documentation Hub

Before undertaking major refactors, consult the static reference files located in `/docs`. You can open these natively in any browser:
- `docs/meta_processes.html` - Deep dive into resolving local-first sync conflicts.
- `docs/folder_structure.html` - Comprehensive codebase map.
- `docs/tech_stack.html` - Reasons behind tooling choices (Dexie, Serwist, Prisma).
- `AGENTS.md` - Operating guide, current project status, and strict rules for AI Agents.

---

## 🌟 Features & Current Status

The application is functionally complete covering the full workout loop, with automated E2E tests, robust data integrity tooling, and an integrated global command palette.

- **Progressive Web App (PWA):** Installs natively. Boots instantly. Offline-first routing via `Serwist`.
- **Local-Network Docker:** Designed to run silently on a home NAS/Raspberry Pi.
- **Automated DB Backups:** Every server sync creates a rolling numbered backup in `prisma/backups/`.
- **Zero-Latency UI:** All CRUD operations happen logically at 0ms latency thanks to Dexie and background syncing.
