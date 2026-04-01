# UI/UX Rehaul Notes — Strength Log

> Audit performed 2026-04-01 • Scope: cosmetic/visual changes only per AGENTS.md

---

## 1. Navigation

### Issues
- **Desktop nav wraps to 2 lines** — 6 links ("Dashboard", "Workout Logger", "Exercises", "History", "Analytics", "Settings") overflow on medium screens, creating a messy second row for "Analytics" + "Settings"
- **Label mismatch** — desktop uses "Workout Logger" but bottom-nav uses "Log" — pick one
- **Tab labels too long** — "Muscle Taxonomy" and "Exercise Library" are both wordy

### Proposed text
| Current | Proposed |
|---|---|
| Workout Logger (desktop) | Logger |
| Log (mobile) | Logger |
| Exercise Library | Library |
| Muscle Taxonomy | Muscles |

### Modernization
- Collapse less-used links into an overflow `⋮` menu at smaller breakpoints
- Shrink labels: "Workout Logger" → "Logger" saves enough space to stop wrapping

---

## 2. Dashboard (`/`)

### Current text (verbatim)
- `Wednesday` `Apr 1`
- `last sesh 2 days ago`
- `VOLUME` / `6,590` / `this week`
- `FOCUS` / `Back`, `Triceps`, `Lats`
- `PAST 4 WEEKS OVERVIEW` / `4 sessions · 17,900kg`
- `RECENT SESSIONS` / `View all`
- Session rows e.g.: `Mon, Mar 30 · 4:57 PM` / `51m 18s · Back, Lats · 254 reps · 6,590kg`

### Issues
- **"last sesh"** — informal slang in an otherwise clean UI
- **Volume card has no unit** — shows `6,590` without `kg`
- **"this week"** sub-label is vague — which week boundary?
- **Session row is info-overloaded** — duration + muscles + reps + volume all crammed on one subtitle line
- **Expanded session: individual sets repeat `#1 8×17.5kg`** format for every set even when identical — causes visual noise
- **Sparkline (`MiniSparkline`)** has no label or axis — meaningless without context
- **"None yet"** for the Focus card when no muscles — shows as dead space. Consider hiding the card instead

### Proposed text
| Current | Proposed |
|---|---|
| `last sesh 2 days ago` | `Last workout: 2 days ago` |
| `VOLUME` / `6,590` / `this week` | `WEEKLY VOLUME` / `6,590 kg` |
| `PAST 4 WEEKS OVERVIEW` | `LAST 4 WEEKS` |
| `51m 18s · Back, Lats · 254 reps · 6,590kg` | `51m · Back, Lats · 6,590 kg` (move reps to expanded view) |
| `None yet` (Focus card) | Hide the card entirely until data exists |

### Modernization
- **Collapse identical sets** — show `4 × 8 reps @ 17.5 kg` instead of listing `#1 8×17.5kg`, `#2 8×17.5kg`, `#3 8×17.5kg`, `#4 8×17.5kg`
- Add a subtle unit label to volume (`kg`)
- Consider a "streak" or "consistency" indicator instead of raw weeks overview
- "View all" link should be a proper ghost button, not bare text

---

## 3. Workout Logger (`/workouts`)

### Current text (verbatim)
- Header bar: `Wed, Apr 1` | status badge e.g. `● 0:14:32`
- Buttons: `Stop`, `Start`, `Delete`, `Archive`
- Collapsed exercise: `Bicep curl` / `3 sets · 3m`
- Expanded exercise: `#1 8×12.5kg` chips
- Empty state: `No exercises yet` / `Pick an exercise below to start tracking.`
- No-workout state: `No workout for Wednesday, Apr 1` / `Start Workout`
- Add exercise: `Add Exercise` / `Search exercises...` / `Cancel`
- Confirm modal: `Save to local database?` / `Add: 8 reps × 20kg` / `This will be saved to your local database.`
- Confirm modal: `Edit Workout Session?` / `Jump back into this session to make changes.`
- Finish confirm: `Finish this workout? This will save the session to the server.`

### Issues
- **"Pick an exercise below to start tracking"** — overly instructional, visible within an already-in-progress workout
- **"Save to local database?"** — implementation leaking. Users don't care where it's saved
- **"This will be saved to your local database"** — same as above, redundant
- **"Jump back into this session to make changes"** — too many words for a simple edit action
- **"This will save the session to the server"** — again, implementation leaking
- **Active exercise card is visually indistinguishable** from pending in the collapsed state (only color shift)
- **Discard modal wording**: `This will delete all current progress. This action cannot be undone.` — overly dramatic for a draft workout

### Proposed text
| Current | Proposed |
|---|---|
| `No exercises yet` / `Pick an exercise below to start tracking.` | `No exercises yet` / `Add one below.` |
| `Save to local database?` / `This will be saved to your local database.` | `Add set?` / `8 reps × 20 kg` (remove the sub-description entirely) |
| `Jump back into this session to make changes.` | `Resume editing this session.` |
| `Finish this workout? This will save the session to the server.` | `End workout?` |
| `This will delete all current progress. This action cannot be undone.` | `Discard this session? Can't be undone.` |

### Modernization
- **Inline weight/rep input** should have increment/decrement stepper buttons (+ / −) for quick thumb adjustment
- Collapsed exercise row should show **total volume** not just set count
- Add haptic-style micro-animation on "Stop" button press
- Use a bottom sheet for exercise picker instead of inline dropdown

---

## 4. Exercises (`/exercises`)

### Current text (verbatim)
- Page: `Exercises` (no eyebrow, no description — just the plain heading)
- Tabs: `Exercise Library` | `Muscle Taxonomy`
- `+ New Exercise` (full-width blue CTA)
- Exercise row: `Back Squat` / `LEGS` `Barbell` / `no data`
- Exercise row w/ data: `Bicep curl` / `ARMS` `Machine` `Biceps` / 🏆 `18 kg` / `12.5×12 · Mar 26`
- Create modal: `Create Exercise` / `Define how movements are grouped and tracked so logging and analytics stay consistent.`
- Muscle view: `Add muscle group...` / `+ Add` / `12 muscle groups` / plain list: `Back`, `Biceps`, `Calves`, ...

### Issues
- **No page description** — `Exercises` heading with nothing underneath, unlike all other pages. Inconsistent
- **Tab labels wordy** — "Exercise Library" + "Muscle Taxonomy" feel academic
- **`+ New Exercise` is a massive full-width blue button** — dominates the page, doesn't match the subtle style of other pages. Too aggressive for a secondary action
- **`no data` placeholder** is as prominent as actual PR data — same font size. Should be more subtle or hidden
- **`Define how movements are grouped and tracked so logging and analytics stay consistent`** — way too technical for a modal subtitle
- **Muscle list is a flat vertical list** — extremely primitive. Each row is just a text label with no metadata, no icon, no usage count
- **Exercise cards have excessive vertical padding** — shows only 4–5 per screen, wastes scroll

### Proposed text
| Current | Proposed |
|---|---|
| `Exercise Library` | `Library` |
| `Muscle Taxonomy` | `Muscles` |
| `no data` | `-` (or hide the PR column entirely) |
| `Define how movements are grouped and tracked so logging and analytics stay consistent.` | `Set up category, equipment, and target muscles.` |
| `Create your first custom movement to start logging.` | `No exercises yet. Create one to get started.` |

### Modernization
- Turn `+ New Exercise` into a compact rounded pill button, right-aligned in the header
- Reduce card padding by ~30% to increase density — aim for 7–8 exercises visible per screen
- Muscle list: show a 2- or 3-column grid with usage count badges (e.g., `Back · 3 exercises`)
- Hide `no data` label entirely — empty right column speaks for itself

---

## 5. History (`/history`)

### Current text (verbatim)
- Eyebrow: `TRAINING ARCHIVE`
- Title: `History`
- Description: `Browse completed sessions by week, drill into each workout, and review set-level detail without changing the underlying logging flow.`
- Badges: `Wed, Apr 1` | `2 logged days this week`
- Navigation: `← Previous` | `Next →`
- Week View card title: `Week View`
- Week View description: `Tap a day to load the recorded sessions for that date.`
- Day buttons: `MON 30 Logged` / `TUE 31 -` / etc.
- Day detail title: e.g. `Wednesday, Apr 1`
- Day detail description: `Sessions are ordered by their recorded start time for the selected day.`
- Session header: `SESSION 1 | 3:20 PM · 3m 27s`
- Exercise: `Shoulder press` → `#1 8 reps × 17.5kg`, `#2 8 reps × 17.5kg`, ...
- Empty: `No workout on this day` / `Tap another day to browse your history.`

### Issues
- **Page description is absurdly long** — 25 words to say "look at past workouts". "without changing the underlying logging flow" is developer-speak, not user-facing copy
- **"TRAINING ARCHIVE"** eyebrow conflicts with the nav label "History" — pick one name
- **`Tap a day to load the recorded sessions for that date.`** — unnecessary instruction. The calendar is self-explanatory
- **`Sessions are ordered by their recorded start time for the selected day.`** — no user needs to know the sort algorithm
- **Individual sets repeat `#1 8 reps × 17.5kg`** for every row even when all identical — massive scroll waste (e.g. 4 identical shoulder press sets = 4 separate rows)
- **`Tap another day to browse your history.`** — condescending instruction for an obviously empty state
- **`Logged` / `-` labels under days** are low-information — just style the logged days differently (dot, highlight)

### Proposed text
| Current | Proposed |
|---|---|
| `TRAINING ARCHIVE` | Remove eyebrow entirely, or use `HISTORY` |
| `Browse completed sessions by week, drill into each workout, and review set-level detail without changing the underlying logging flow.` | `Past sessions by week.` |
| `Tap a day to load the recorded sessions for that date.` | Remove entirely |
| `Sessions are ordered by their recorded start time for the selected day.` | Remove entirely |
| `No workout on this day` / `Tap another day to browse your history.` | `Rest day.` |
| `Logged` / `-` | Use a colored dot indicator instead of text |
| `#1 8 reps × 17.5kg` (repeated 4x) | `4 × 8 @ 17.5 kg` (one line) |

### Modernization
- **Collapse identical sets** into a single summary line
- Replace `Logged` / `-` text with a small dot ● or highlighted border
- Remove all instructional sub-descriptions — the UI should be self-evident
- Consider making session cards swipe-expandable on mobile

---

## 6. Analytics (`/analytics`)

### Current text (verbatim)
- Eyebrow: `PERFORMANCE READOUT`
- Title: `Analytics`
- Description: `Track weekly workload, spot which muscles and exercises are carrying the most volume, and review progress without changing how anything is logged.`
- Badges: `Weekly volume 6590` | `1 active day`
- Stats cards: `Weekly Total` / `6590` / `Formula: set volume = reps × weight. Primary muscles count 100%, secondary muscles count 50%.`
- `Muscles Tracked` / `7` / `Top eight muscles by weighted volume are shown in the weekly chart.`
- `Leading Exercise` / `Pulldown` / `Highest-volume exercise across the current weekly window.`
- Chart cards: `Volume by Muscle (Week)` / `Weighted weekly muscle distribution for the current training window.`
- `Volume by Exercise (Week)` / `See which individual movements are driving the most work this week.`
- `Exercise Progress` / `Pick an exercise to review max weight and estimated one-rep max over time.`
- Empty states: `No muscle volume yet` / `Log sets to populate analytics.`
- `No exercise volume yet` / `Log a workout to see this chart.`
- `No progress data` / `Select an exercise with logged sets over time.`

### Issues
- **Page description is way too long** — 27 words, repeats the "without changing how anything is logged" developer disclaimer
- **"PERFORMANCE READOUT"** eyebrow sounds like a military telemetry app, not a fitness tracker
- **Formula explanation** (`Formula: set volume = reps × weight...`) is technical documentation inside a card. Users don't want methodology; they want data
- **"Top eight muscles by weighted volume are shown..."** — implementation detail
- **"Highest-volume exercise across the current weekly window"** — verbose
- **"Weighted weekly muscle distribution for the current training window"** — academic
- **Empty state messages are inconsistent** — "Log sets to populate analytics" vs "Log a workout to see this chart" vs "Select an exercise with logged sets over time" — three different phrasings for "no data"
- **Badge shows `Weekly volume 6590`** without unit

### Proposed text
| Current | Proposed |
|---|---|
| `PERFORMANCE READOUT` | `ANALYTICS` or remove eyebrow |
| `Track weekly workload, spot which muscles and exercises are carrying the most volume, and review progress without changing how anything is logged.` | `Weekly volume and progress.` |
| `Formula: set volume = reps × weight. Primary muscles count 100%, secondary muscles count 50%.` | Remove (or put behind an ℹ️ tooltip) |
| `Top eight muscles by weighted volume are shown in the weekly chart.` | Remove |
| `Highest-volume exercise across the current weekly window.` | `Highest volume this week.` |
| `Weighted weekly muscle distribution for the current training window.` | Remove description |
| `See which individual movements are driving the most work this week.` | Remove description |
| `Pick an exercise to review max weight and estimated one-rep max over time.` | `Track weight and estimated 1RM over time.` |
| `Log sets to populate analytics.` / `Log a workout to see this chart.` / `Select an exercise with logged sets over time.` | Standardize all to: `Log workouts to see data.` |
| `Weekly volume 6590` | `6,590 kg this week` |

### Modernization
- Put the formula behind an `ℹ️` icon tooltip, not in the card body
- Remove all card sub-descriptions — chart titles are sufficient context
- Add percentage change indicators (↑12% from last week) for volume
- The "Choose Exercise" dropdown looks like a plain HTML `<select>` — restyle to a modern combobox

---

## 7. Settings (`/settings`)

### Current text (verbatim)
- Eyebrow: `BACKUP & INTEGRITY`
- Title: `Settings`
- Description: `Export or replace local data, then run an integrity audit to make sure the training log still looks structurally sound.`
- Badge: `Local-first data tools`
- `Run Check` button
- `Export Data` / `Export includes exercises, muscles, workouts, workout exercises, set entries, and settings.`
- `Use JSON for full restore workflows. CSV exports each table separately for inspection or spreadsheet use.`
- Buttons: `Export JSON` | `Export CSV Tables`
- `Import & Sync` / `Upload a JSON export to replace your entire local database state.`
- `Push to Database Server` / `Pull from Database Server`
- `Integrity Report` / `Runs a read-only audit of local IndexedDB data and reports structural issues.`
- Confirm dialogs: `This will WIPE all your local data on THIS device and replace it with data from the server. Are you sure? ^_^`
- `Changes detected! Are you sure you want to sync all local data to the server? This will push all muscle groups, exercises, and workouts to the SQL database.`

### Issues
- **"BACKUP & INTEGRITY"** eyebrow is fine but the description is too long
- **"Local-first data tools"** badge — implementation jargon. Users don't know or care what "local-first" means
- **"Export includes exercises, muscles, workouts, workout exercises, set entries, and settings"** — listing every table name is too granular
- **"Use JSON for full restore workflows"** — developer language
- **"Upload a JSON export to replace your entire local database state"** — scary + technical
- **"Runs a read-only audit of local IndexedDB data and reports structural issues"** — mentions IndexedDB, which is an implementation detail
- **`Run Check` button at the top duplicates the `Integrity Report` section** at the bottom — same function, two locations
- **Confirm dialog has `^_^` emoticon** — inconsistent tone
- **`Pull from Database Server` vs `Push to Database Server`** — "Database Server" is implementation language. Users think in terms of "cloud" or "backup"
- **Button style inconsistency** — "Push" is `variant="secondary"` (full-width outlined), "Pull" is `variant="ghost"` (full-width bare text). These are equally dangerous operations and should have equal visual weight

### Proposed text
| Current | Proposed |
|---|---|
| `Export or replace local data, then run an integrity audit to make sure the training log still looks structurally sound.` | `Backup, restore, and sync your data.` |
| `Local-first data tools` | Remove badge, or change to `Data Tools` |
| `Export includes exercises, muscles, workouts, workout exercises, set entries, and settings.` | `Full data export.` |
| `Use JSON for full restore workflows. CSV exports each table separately for inspection or spreadsheet use.` | `JSON for backup/restore. CSV for spreadsheets.` |
| `Upload a JSON export to replace your entire local database state.` | `Restore from a JSON backup.` |
| `Push to Database Server` | `Push to Server` |
| `Pull from Database Server` | `Pull from Server` |
| `Runs a read-only audit of local IndexedDB data and reports structural issues.` | `Check data integrity.` |
| `This will WIPE all your local data on THIS device and replace it with data from the server. Are you sure? ^_^` | `Replace all local data with server data? This cannot be undone.` |
| `Changes detected! Are you sure you want to sync all local data to the server? This will push all muscle groups, exercises, and workouts to the SQL database.` | `Push all local data to the server?` |

### Modernization
- Consolidate: move `Run Check` into the Integrity Report card (not in the page header)
- Give Push/Pull buttons symmetrical styling (both outlined or both filled)
- Remove all implementation terms: `local database`, `IndexedDB`, `SQL database`, `local-first`
- Remove `^_^` emoticons from confirm dialogs

---

## 8. Cross-cutting visual issues

### Typography
- Page headings are consistent (3xl semibold) ✅
- Sub-text sizes vary: `text-xs`, `text-[10px]`, `text-[11px]`, `text-sm` are used interchangeably with no clear hierarchy — standardize to 2–3 sizes

### Spacing
- Card border-radius varies: `rounded-[1.2rem]`, `rounded-[1.3rem]`, `rounded-[1.4rem]`, `rounded-[1.6rem]`, `rounded-2xl` — pick 2 sizes max (inner/outer)
- Shadow definitions change per card: `shadow-[0_24px_70px_...]`, `shadow-[0_20px_60px_...]`, `shadow-[0_16px_48px_...]` — create 2–3 named elevation levels

### Color
- Opacity values scattered: `bg-card/60`, `bg-card/80`, `bg-card/82`, `bg-card/88`, `bg-card/90`, `bg-card/92` — every component picks its own opacity. Standardize to 3 token levels
- `border-border/40`, `border-border/50`, `border-border/60`, `border-border/70` — same problem. Pick 2

### Repeated information patterns
- **Muscle names appear in**: dashboard (session rows), dashboard (Focus card), analytics (badges), history (session detail), workout logger (exercise cards). Same data, 5 places
- **Set data (`#1 8×17.5kg`) appears identically in**: dashboard expanded rows, history detail, workout logger completed view — never collapsed into summary form anywhere
- **Duration appears with different formatting** — `51m 18s` (dashboard), `3m 27s` (history), `3:03` (workout logger active timer). Standardize the short format

### Empty states
- 6+ different wordings for "no data" — standardize to 1–2 variants

---

## 9. Priority action items (quick wins → larger changes)

### Quick wins (< 1 hour each)
1. **Shorten all page descriptions** — apply the "Proposed text" table changes above
2. **Fix nav wrapping** — shorten "Workout Logger" → "Logger"
3. **Standardize empty states** to 1–2 phrases
4. **Remove implementation terms** from Settings — "IndexedDB", "local database", "SQL database"
5. **Add `kg` unit** to Volume card on dashboard
6. **Remove `^_^` from confirm dialogs**

### Medium effort (1–3 hours)
7. **Collapse identical sets** — replace N repeated lines with `N × reps @ weight`
8. **Standardize card radii** — pick `rounded-xl` (inner) and `rounded-2xl` (outer)
9. **Standardize shadows** — define 3 elevation levels
10. **Reduce exercise card padding** — increase info density
11. **Redesign muscle list** — 2-column grid with usage count
12. **Consolidate `Run Check` into Integrity Report card**

### Larger changes (3+ hours)
13. **Bottom sheet exercise picker** — replace inline dropdown with a swipe-up sheet
14. **Stepper inputs for reps/weight** — add +/− buttons
15. **Chart restyling** — replace plain HTML `<select>` in analytics with combobox
16. **Responsive nav overflow menu** — hide low-traffic links behind `⋮` on medium screens
