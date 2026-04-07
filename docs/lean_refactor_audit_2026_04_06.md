# Lean Refactor Audit — Strength Log

> Assessed: 2026-04-06 · 8,494 lines of TypeScript/TSX across 5 directories

---

## TL;DR Scores

| Dimension | Score | Verdict |
|---|---|---|
| **Implementation Efficiency** | **7.5 / 10** | Solid choices, one heavyweight dep unused |
| **Architectural Robustness** | **7 / 10** | Strong foundations, meaningful gaps |
| **Codebase Hygiene** | **7 / 10** | Very clean in the small; one god-component |
| **Overall** | **7.2 / 10** | Architecture is sound; refactor is low-risk |

---

## 1 — Implementation Efficiency · 7.5 / 10

### ✅ What's working well

- **Local-first / IndexedDB** is the right call for a personal workout tracker. Zero-latency writes via Dexie with a transparent background sync queue is textbook offline-first. No over-engineering here.
- **Dexie `useLiveQuery`** is used correctly throughout — no manual data-fetching state machines or polling loops.
- **Zustand store** is minimal (22 lines). Only transient UI state lives there (`selectedDate`, `activeWorkoutId`, `sessionActive`). Domain data never leaks into Zustand.
- **The repo layer** (`repository.ts`) is the correct single choke-point for all mutations. Components never call `fetch()` directly for writes.
- **Sync engine** is appropriately thin (114 lines). The `isProcessing` guard, `flushSyncQueue` escape hatch, and `window.addEventListener("online")` hook are all correct patterns.
- **`react-hook-form` + `zod`** are only used in the exercise form — proportional to the need.

### ⚠️ Inefficiencies to fix

| Issue | Location | Impact |
|---|---|---|
| `@libsql/client` + `@prisma/adapter-libsql` in `package.json` but **never imported** in any `.ts` file | `package.json` | ~60 KB install weight, misleading dependency surface |
| `react-is` in direct dependencies — **zero src/ imports** | `package.json` | Vestigial peer dep that leaked into direct deps |
| `action: "start" \| "finish" \| "sync"` in the Payload type but only `"sync"` is ever sent | `route.ts:9`, `syncEngine.ts:90` | Dead type surface, misleading contract |
| `syncWorkoutToServer()` is a one-line wrapper around `enqueueSync()` with no callers | `repository.ts:324` | Dead export |
| `getOrCreateWorkoutByDate()` marked `// Deprecated` but not removed | `repository.ts:47` | Dead export |
| `bootstrapMuscles()` and `bootstrapExercises()` exported but never called (composite `bootstrapFromServer()` is used) | `sync.ts:8,15` | Dead exports |
| Analytics queries use a serial N+1 loop: `await db.exercises.get(id)` per item inside a loop | `analytics.ts:43,123` | Slow at scale; should be a single `bulkGet` |

---

## 2 — Architectural Robustness · 7 / 10

### ✅ Strengths

- **Atomic transactions everywhere** — Dexie `transaction("rw", ...)` wraps cascading deletes and reorders. The API side mirrors this with Prisma `$transaction`.
- **Server-side orphan cleanup** in the workout POST route diffs incoming IDs and deletes orphans within the same transaction (lines 95–122).
- **Bootstrap gate with three layers of timeout safety** (30s server, 10s local, 45s hard deadline) is solid for a PWA. The self-clearing cached promise enables correct retries.
- **Persistent storage request** (`navigator.storage.persist()`) after bootstrap is a good defensive move for Android.
- **Auto-backup on every workout sync** is a practical safeguard for a self-hosted single-user app.

### ⚠️ Meaningful gaps

| Gap | Severity | Notes |
|---|---|---|
| **`window.confirm` / `alert` used 11 times** as confirmation dialogs | Medium | Blocks the main thread, can't be styled, breaks on some PWA contexts. The `Modal` component exists and should own all destructive confirmations. |
| **No retry backoff** in the sync engine — failed jobs are retried immediately on the next `enqueueSync` (100ms setTimeout) with no delay | Medium | Under flaky connectivity this hammers the server. Needs exponential backoff: `Math.min(30000, 2^retryCount * 1000)`. |
| **`[API DEBUG]` console.logs left in production route** — `process.env.DATABASE_URL` logged on every GET and POST | High | Leaks environment config to server logs. Remove immediately. |
| **`syncEverythingToServer()`** does a full DELETE then bulk re-push — makes sync non-idempotent during the window between delete and re-push | Medium | A partial network failure would leave the server empty. The workout sync queue (upsert-only) is safer. |
| **`isMuscleGroupReferenced`** loads all exercises into memory to check references | Low | Fine today; could be an indexed filter query. |
| **No error boundary** wrapping the app | Low | Any unhandled React throw renders a blank screen. |
| **Single-user**: `DEFAULT_USER_ID` hardcoded everywhere | Known/accepted | Documented in AGENTS.md. Not a current risk but limits future scope. |

---

## 3 — Codebase Hygiene · 7 / 10

### ✅ Strong points

- **`src/types/domain.ts`** (122 lines) is a clean, canonical type surface. All entities defined once, no duplication.
- **Naming conventions** are consistent: `camelCase` for utilities, `kebab-case` for component files.
- **The library layer is lean**: `utils.ts` (74 lines), `time.ts` (78), `volume.ts` (34), `format-sets.ts` (55) — each does one thing.
- **`integrity-audit.ts`** is comprehensive: referential integrity checks + auto-healer in 277 lines.
- **Test files exist** for pure-calc functions: `export.test.ts`, `volume.test.ts`, `time.test.ts`.

### ⚠️ Hygiene issues

| Issue | Location | Severity |
|---|---|---|
| **`workout-logger.tsx` is 1,756 lines** — god-component containing 8+ sub-components, 6+ `useEffect` hooks, and all session lifecycle logic | `workout-logger.tsx` | High |
| **`inferWorkoutStatus()` is defined twice identically** | `db.ts:6`, `repository.ts:9` | Medium |
| **`weekRangeDateStrings()` is async with no I/O** — it only does date math | `repository.ts:218` | Low |
| **`summarizeSets()` is a pure function in `repository.ts`** — no db access; should live in `utils.ts` or `format-sets.ts` | `repository.ts:531` | Low |
| **Dashboard computes muscle maps/volume inline** in `CompactWorkoutRow` — duplicating logic from `analytics.ts` | `dashboard.tsx:442–455` | Medium |
| **`improvelog/` directory** contains only one stale markdown file | root | Trivial |

---

## 4 — Dead Weight & Pruning Checklist

Ordered by effort-to-impact ratio (lowest effort, highest payoff first).

### 🔴 Priority 1: Remove immediately (no risk, pure gain)

- [ ] **Delete `[API DEBUG]` logs** in `src/app/api/workouts/route.ts` lines 17–18 and 201–202
- [ ] **Uninstall `@libsql/client` and `@prisma/adapter-libsql`** — zero usage in source
- [ ] **Uninstall `react-is`** from direct dependencies
- [ ] **Delete dead exports**: `syncWorkoutToServer()`, `getOrCreateWorkoutByDate()`, `bootstrapMuscles()`, `bootstrapExercises()`
- [ ] **Remove `action: "start" | "finish"` from the Payload type** — only `"sync"` is ever sent
- [ ] **Deduplicate `inferWorkoutStatus()`** — keep in `db.ts`, import in `repository.ts`
- [ ] **Delete `improvelog/` directory**

### 🟡 Priority 2: Quick wins (< 1 hour each)

- [ ] **Replace all `window.confirm` / `alert` calls** with the existing `<Modal>` component (11 occurrences, 3 files)
- [ ] **Fix N+1 in analytics**: replace `await db.exercises.get(item.exerciseId)` in loops with `db.exercises.bulkGet(exerciseIds)` — `analytics.ts` `getWeeklyMetrics` and `get28DaySummary`
- [ ] **Add exponential backoff to the sync engine** — ~10 line change in `syncEngine.ts`
- [ ] **Make `weekRangeDateStrings` synchronous** — it's `async` with no `await`
- [ ] **Move `summarizeSets()` to `format-sets.ts`**

### 🟠 Priority 3: Bigger wins (requires a session)

- [ ] **Split `workout-logger.tsx`** into focused files:
  - `workout-logger.tsx` — main orchestrator (~300 lines)
  - `workout-exercise-card.tsx` — exercise card + set rows (~700 lines)
  - `month-history-strip.tsx` — 30-day scroll strip (~300 lines)
  - `inline-exercise-picker.tsx` — bottom sheet picker (~100 lines)
- [ ] **Evaluate replacing Recharts with vanilla SVG** — sole usage is 4 charts in `analytics-view.tsx`; Recharts is ~150 KB gzipped. The custom `MiniSparkline` and `GymCostCard` SVG ring already ship without it.
- [ ] **Audit Lucide React icon imports** for stale/unused icons

---

## Summary Table

| Action | Files | Risk | Effort | Impact |
|---|---|---|---|---|
| Remove `[API DEBUG]` logs | `route.ts` | None | 2 min | Security |
| Uninstall 3 unused packages | `package.json` | None | 5 min | ~60KB install reduction |
| Delete dead exports | `repository.ts`, `sync.ts` | None | 10 min | Cleaner API surface |
| Fix `window.confirm` → `<Modal>` | 3 files, 11 calls | Low | 1–2h | UX / PWA quality |
| Fix N+1 analytics queries | `analytics.ts` | Low | 30 min | Runtime perf |
| Add sync backoff | `syncEngine.ts` | Low | 30 min | Server stability |
| Split workout-logger | 1 → 4 files | Medium | 2–3h | Maintainability |
| Replace Recharts with SVG | `analytics-view.tsx` | Medium | 3–4h | ~150KB bundle reduction |

> **Fastest path to a snappier frontend**: uninstall the 3 unused packages + fix the analytics N+1 + replace Recharts. ~5h of work for the largest measurable improvements.

> **Do not touch `syncEverythingToServer()`** without adding a transaction guard. The current delete-then-push pattern has a data-loss window during partial network failure.
