# WiFit — Project Context

**Rewritten 2026-08-13 from the live database and current `src/App.jsx`.**

The previous version of this file was written from inference and drifted ~40 commits
behind reality. It claimed `profiles.gender` did not exist, named the weight table
`weight_log` instead of `body_weight_log`, and documented macro columns as
`*_per_100g` instead of `per100_*`. Each of those became a silent HTTP 400 in
production, because `sb.insert`/`sb.upsert` swallow non-2xx responses. **Every
statement below was verified against the live schema or the current code. If you
change the schema, change this file in the same commit.**

**Decisions with their reasons live in `docs/DECISIONS.md`** — the
cases where the obvious thing to do differs from what the code does. This file
is schema, architecture and open bugs; that file is why the code is the way it
is. Cross-references go both ways.

---

## What WiFit is

A single-user fitness PWA: food logging with macros, workout plans and sessions,
supplements, water, body weight, and an AI coach. React + Vite, deployed on Vercel
at `wifit.vercel.app`, backed by Supabase (Postgres + Auth).

## Where this is going — a native SwiftUI rewrite

**A native SwiftUI rewrite is planned. This codebase is becoming a reference
implementation rather than the long-term product.** Stating it here because it
changes how work on it should be judged, and because it is not derivable from
the code, the commits, or any config.

The reason is capability, not taste. Four things this app needs are impossible
on the web platform, not merely awkward:

- **HealthKit** — reading and writing the system health store.
- **Apple Watch** — a companion app, and logging sets from the wrist.
- **WidgetKit** — home-screen macros and workout state.
- **Reliable background notifications** — supplement reminders currently run on
  `setTimeout` with `new Notification()`, which means they fire only while a tab
  is alive. There is no service worker and no manifest (see §Workout session
  persistence), so a backgrounded reminder is simply lost.

**What this means for work here.** Two things, pulling in opposite directions:

1. Bugs in the current app are still worth fixing — it is what gets used today,
   and the user's data is real.
2. But the durable output of a fix is the **understanding**, not the patch.
   `DECISIONS.md` exists for exactly this: so the rewrite inherits the lessons
   instead of rediscovering them one production bug at a time. When recording a
   defect, write down **what would structurally prevent it**, and name the
   language mechanism where one exists — several of the worst classes here
   (§Known issues #1, and both `DECISIONS.md` entries dated 2026-09-06 about
   `sb`) collapse into `async`/`await`, typed `throws`, and
   `@discardableResult`, where the compiler makes ignoring a failure a
   deliberate, visible choice instead of an accident.

**`docs/HANDOFF.md` is the migration brief.** It carries the bug archive
organised by *class* rather than chronology, the verification discipline, the
live schema, what survives the rewrite untouched (schema, RLS, `/api/coach`, the
`ACTIONS:` contract), and the known issues deliberately left unfixed because
they disappear in the rewrite. Read it before planning any rewrite work.

Do **not** start the rewrite as a side effect of another task. Same rule as
splitting `App.jsx`: it is its own deliberate piece of work.

### The port layer — `src/lib/` (extracted 2026-09-08)

The non-UI layer the Swift client must reimplement now lives in named files, so
the port is a translation of this list rather than an excavation of App.jsx.
Every module has zero JSX; none imports App.jsx; there are no cycles
(HomeTab ↔ App was broken by `theme.js` — `useTheme` was the actual edge).
The React components stay in App.jsx on purpose: they are being replaced, and
splitting them would be wasted work (`DECISIONS.md` §"Extract the port layer").

| Module | Swift reimplements | Header carries |
|---|---|---|
| `lib/supabase.js` | the REST client: nothing throws; `select`→`[]`; `selectAuth`→`{ok, authError, status, rows}`; `insert/upsert`→row or null; `update/delete`→bool; one 401 retry; per-table `on_conflict`; row identity (`hasDbId`, `withDbId`) | the failure contract and the per-read treatment ladder |
| `lib/nutrition.js` | `calc`, `totals`, `per100From`, custom-food serving→grams | **Decimal, not Double** (21 of 3,996 exact-.5 products differ) and the still-provisional JS derivations |
| `lib/dates.js` | `localDate` — every `*_date` column is the LOCAL day | the created_at-as-UTC bug |
| `lib/coach.js` | `buildSystem`/`buildContextBlock`, `buildRequestMessages` (user turn exactly once), `parseActions` (corrupt fails closed, invalid actions fail open and are named), `applyActions`, `callCoach` | the `liveContext` params shape |
| `lib/constants.js` | catalogues and contracts: `SEED`/`MEAL_SLOTS`, `GOAL_OZ`, gram ceilings, the supplement category enum and type→purpose map, `ACTIVITY` (one table for onboarding and profile), `GOAL_RATES` | which values are contracts vs catalogues |
| `lib/workouts.js` | `normalizeExercises`/`sessionFromRow` (read-boundary guard), `editSet`, `computePRs` — the only client-side PR logic, deliberately | why `computePRs` survives the views |
| `lib/search.js` | source merge order, the #18 name-match filter (barcode exempt), the ok/partial/none/failed ladder, USDA gate | what the UI must not collapse |
| `lib/theme.js` | not for the port — the theme registry and context; here because it was the cycle edge | — |
| `lib/weekSummary.js` | `reduceWeekRows` (provisional — read `daily_summary`), `summarizeWeek`, `streakFrom` | — |

**Next extraction candidate — BMR/TDEE (highest value remaining).** The
Mifflin/Harris-Benedict math still lives inside `OnboardingWizard.calcGoals`
and `ProfilePage.calcTDEE` (plus `calcCalFromRate`, already in constants).
It is the only place in the app where a formula produces a number the user
then lives by for months — every calorie target, every "kcal left", every
on-target day derives from it. A Swift divergence there is worse than a
divergence anywhere else, which is why it should be extracted with a
value-for-value test (the way `ACTIVITY` was) before the port begins.

## Stack and layout

| Path | What |
|---|---|
| `src/App.jsx` | The entire app — ~7,200 lines, one file. All components, the `sb` client, auth, parsers. |
| `src/themes.js` | The 12 mode-locked home palettes (design export) + `hexA`/`luminance`. |
| `src/TabBar.jsx` | The bottom tab bar + quick-add fan (2026-09-07), rendered once by App for every tab. Keys are App's tab keys. |
| `src/HomeTab.jsx` | The redesigned Home tab (2026-09-06). Reads theme via `useTheme`; every write goes through App's existing handlers. |
| `src/lib/weekSummary.js` | Pure helpers for the Home week rail: Mon–Sun builder, on-target rule, streak, `todayPlanFor`. |
| `src/lib/paletteToTheme.js` | Turns a palette into a full theme object with the legacy keys plus the extended Home keys. |
| `src/main.jsx` | Mount point. |
| `api/coach.js` | Vercel **Edge** function proxying Anthropic. The only server-side code. |
| `supabase/migrations/` | Applied migrations, recorded after the fact. |
| `eslint.config.js` | Flat config, ESLint 9. Two rules only: `no-undef` error, `no-unused-vars` warn. |

Supabase project `vghqqksbjpgdzmvfmnru`, region **us-east-1**. Vercel deploys to
**iad1** — the same AWS region, so server-to-Supabase round trips are single-digit ms.

**Style note:** the codebase uses string concatenation rather than template literals
throughout. This is intentional legacy, not a defect. Do not "fix" it.

---

## Database schema (live, verified)

All 11 tables have **RLS enabled**. Every `user_id` is a FK to `auth.users(id)` with
`ON DELETE CASCADE`.

### profiles
PK `id` (FK → `auth.users`, cascade). One row per user.

| Column | Type | Null | Default |
|---|---|---|---|
| id | uuid | NO | — |
| name | text | YES | |
| age | integer | YES | |
| weight_lbs | numeric | YES | |
| height_in | numeric | YES | |
| activity_level | text | YES | `'moderate'` |
| **goal** | text | YES | `'maintain'` | 
| cal_goal | integer | YES | 2200 |
| protein_goal | integer | YES | 140 |
| carbs_goal | integer | YES | 180 |
| fat_goal | integer | YES | 78 |
| theme | text | YES | `'dark'` |
| created_at | timestamptz | YES | now() |
| updated_at | timestamptz | YES | now() |
| gender | text | YES | |
| bmr | numeric | YES | |
| tdee | numeric | YES | |
| **goal_rate** | **text** | YES | |

`goal_rate` is **TEXT, not numeric** — values are keys like `"lose_2"`, `"lose_1"`,
`"maintain"`, `"gain_1"`, `"gain_2"`. It was briefly created as numeric and every
profile save 400'd until corrected.

`theme` is a composite string: `"<family>_<dark|light>"`, e.g. `"aurora_dark"`. It is
split on `_` when read; `parts[0]` is the family, the last part is the mode.

**`goal` is vestigial.** Superseded by `goal_rate`. Nothing writes it. One read path
still maps legacy values (`"lose"` → `"lose_1"`) for backward compatibility.

### food_log
| Column | Type | Null | Default |
|---|---|---|---|
| id | uuid | NO | gen_random_uuid() |
| user_id | uuid | NO | |
| logged_date | date | **NO** | CURRENT_DATE |
| meal_slot | text | **NO** | |
| food_name | text | **NO** | |
| brand | text | YES | |
| grams | numeric | **NO** | |
| per100_cal / _protein / _carbs / _fat / _fiber / _sodium | numeric | YES | 0 |
| **per100_sugar** | numeric | YES | **null** |
| color | text | YES | |
| created_at | timestamptz | YES | now() |

`per100_sugar` defaults to **null**, unlike the other `per100_*` columns which default
to 0. Read it as `r.per100_sugar || 0`.

Macros are stored **per 100 grams**. `calc()` multiplies by `grams/100`. Any code that
divides by a serving size must divide by the *gram weight*, never by a raw serving
number in some other unit.

### custom_foods
`id`, `user_id`, `name` (NOT NULL), `brand`, `serving_g` numeric,
`per100_cal/_protein/_carbs/_fat/_fiber/_sugar/_sodium` numeric default 0,
`created_at`, plus:

- **`serving_qty`** numeric — what the user typed (e.g. `4`)
- **`serving_unit`** text — the unit they picked (e.g. `"oz"`)

`serving_g` is the source of truth in grams. `serving_qty`/`serving_unit` exist so a
future edit screen can redisplay "4 oz" instead of "113.4 g". Nothing reads them yet.

### workout_sessions
| Column | Type | Null | Default |
|---|---|---|---|
| id | uuid | NO | gen_random_uuid() |
| user_id | uuid | NO | |
| workout_name | text | **NO** | |
| completed_date | date | **NO** | CURRENT_DATE |
| duration_secs | integer | YES | 0 |
| sets_completed | integer | YES | 0 |
| total_sets | integer | YES | 0 |
| exercises | jsonb | YES | `'[]'` |
| created_at | timestamptz | YES | now() |
| **prs** | **jsonb** | **NO** | `'[]'` — **no longer written or read (2026-09-07, #28)**; inserts rely on the default. Drop in a later migration. |

`prs` was missing for months while the client sent it on every insert — PostgREST
returned 400 `PGRST204`, `sb.insert` swallowed it, and the table stayed empty while
the UI showed saved workouts. Since #28 PR events come from the `exercise_pr_events`
view and the column is dead.

`exercises` shape: `[{name, sets:["8×135lbs", ...], setsData:[{reps, weight}]}]`.
Older rows also carry `isPR` — dead, ignored.

### workout_plans
`id`, `user_id`, `name` (NOT NULL), `tag`, `level`, `est_min` integer,
`scheduled_day` text, `exercises` **jsonb NOT NULL default `'[]'`**, `sort_order`
integer default 0, `created_at`.

### supplement_stack
`id`, `user_id`, `name` (NOT NULL), `sub`, `dot_color` text default `'#888888'`,
`reminder_time` text, `reminder_enabled` boolean default false, `sort_order` integer
default 0, `created_at`, plus:

- **`category`** text — one of **eight lowercase PURPOSE values**: `protein`,
  `vitamin`, `mineral`, `performance`, `health`, `sleep`, `fat_burner`,
  `probiotic`. NULL is legal and means Uncategorised.
- **`note`** text — the AI's usage tip

Before these existed, the ADD_SUPP path flattened `dose`+`timing` into `sub`, consumed
`category` only to pick a hex color, and dropped `note` entirely. Both the AI path and
the manual add path now persist `category` and `note`.

**`category` is a PURPOSE, not a product type — and it is not the `DOT_COLORS` key.**
The column briefly held two vocabularies: the coach wrote the lowercase enum above,
while the manual add path wrote capitalised product types from `SUPP_DB` and the create
picker (`"Creatine"`, `"Protein"`). Two different axes in one column — `'Creatine'` and
`'performance'` would have grouped as unrelated buckets. Normalised on 2026-08-29
(`20260829_normalize_supplement_stack_category.sql`, one row: `Creatine` →
`performance`); `toSuppCategory` now maps at write time so the picker's labels are
unchanged but the stored value is always the enum.

Product type is **not** lost — it lives on `SUPP_DB.category` (`"Creatine"`,
`"Omega-3"`, …), which is the *catalogue's* own field and still drives browse filtering
and local search. The two were never the same field; they only shared a name.

Colours come from two separate maps, by design: `DOT_COLORS` is keyed by product type
and is used when adding from the catalogue; `SUPP_CATEGORY_DOTS` is keyed by the purpose
enum and is used by the coach cards. The stored `dot_color` column is what renders — the
category is never consulted at render time.

**No CHECK constraint yet.** The pre-ACTIONS `ADD_SUPP` path is live until C2 retires it
and does not validate `category`, so a constraint today would turn a bad model response
into a failed insert surfacing as "couldn't save". Add
`check (category is null or category in (...))` once C2 has landed.

### supplement_log
`id`, `user_id`, `supplement_id` (NOT NULL, FK → `supplement_stack(id)` cascade),
`log_date` date NOT NULL default CURRENT_DATE, `taken` boolean default false,
`created_at`.

**UNIQUE (supplement_id, log_date)** — upsert with `resolution=merge-duplicates`
updates the day's row rather than appending.

### water_log
`id`, `user_id`, `log_date` date NOT NULL, **`cups` integer default 0**, `created_at`,
**`oz` integer NOT NULL default 0**.

**UNIQUE (user_id, log_date)** — one cumulative row per day. The write sends the
day's **running total**, not the tap delta.

**`cups` is dead.** Zero reads, zero writes. Superseded by `oz`.

### body_weight_log
`id`, `user_id`, **`weight_lbs` numeric NOT NULL**, `log_date` date NOT NULL default
CURRENT_DATE, **`note` text**, `created_at`.

**UNIQUE (user_id, log_date)** — same-day edits update rather than duplicate.

The column is `weight_lbs`, **not `lbs`**. The client wrote `lbs` to a table called
`weight_log` (which does not exist) — a 404 that became `[]`, so the weight chart and
the coach's weight context were silently empty forever.

**`note` is dead.** Nothing reads or writes it.

### coach_usage
`id`, `user_id` (FK → `auth.users`, cascade), `created_at` timestamptz NOT NULL
default now(). One row per accepted `/api/coach` request.

Index: `coach_usage_user_created_idx (user_id, created_at DESC)` — matches the query's
sort order; the windowed count runs on every request.

**RLS: INSERT and SELECT of own rows only. There is deliberately NO UPDATE and NO
DELETE policy.** With RLS on, a command with no matching policy is denied, so a user
cannot clear or backdate their usage to reset the rate limit. That is what allows the
Edge function to authenticate these queries with the caller's own JWT instead of a
service-role key. Verified as the `authenticated` role: SELECT saw 2 rows, DELETE
removed 0, UPDATE changed 0.

### exercise_bests — VIEW (2026-09-07)

```
exercise_bests   user_id, name, best_lbs        security_invoker = true
                 = max((setsData[].weight)) per exercise over workout_sessions
                 GRANT select TO authenticated; nothing to anon (verified)
```

The PR baseline. Read with `sb.selectAuth` at mount, on Retry, and after a
session insert lands; never derived on the client. `workout_sessions.exercises[]`
now carries `setsData: [{reps, weight}]` alongside the display `sets` strings —
backfilled once by `20260907_exercise_bests_view_and_sets_data.sql`, written by
`finishWorkout` since. See `DECISIONS.md` §"Derived values belong in the database".

### daily_summary · supplement_due_from · weight_monthly — VIEWS (2026-09-07)

```
daily_summary        user_id, day, kcal, protein_g, carbs_g, fat_g, food_rows,
                     workout_count, workout_names, supps_taken, supps_due, weight_lbs
                     one row per (user, day) that has ANY data — no date spine
supplement_due_from  user_id, supplement_id, name, due_from
                     = least(created_at::date, first log_date)
weight_monthly       user_id, month 'YYYY-MM', first_lbs, last_lbs, entries
all three            security_invoker = true; GRANT select TO authenticated only (verified)
```

Gate 2 (Progress). The per-day numbers get one definition in Postgres instead of
four client re-derivations (Home rail, Calendar, Progress, `calc`). kcal/macros are
`sum(round(per100 * grams / 100))` per row — the same arithmetic as `calc()`, but
in `numeric`: IEEE doubles disagree on 21 of 3,996 exact-.5 products (32.3 per100 ×
500 g = 161.5 → numeric 162, double 161). **The view is the definition.** Progress
reads it; Home/Calendar/`calc` still compute in JS and can differ by 1 kcal on such
rows — switching them is a follow-up. **Hard Swift requirement** (also in
`HANDOFF.md` and the migration header): all macro arithmetic in the Swift client
must use `Decimal`, not `Double` — a `Double` port reproduces the JS answer and
disagrees with `daily_summary`, so the same day shows different totals depending
on which side computed it. Do not port `reduceWeekRows`, `CalendarTab`'s bucket,
or `calc()`/`totals()`; read the view. `supps_due` counts a supplement only from `due_from` (closes D2: a
supplement added on day 29 no longer scores 29 misses); the client uses
`supplement_due_from` for the same rule on days the view has no row for.
Migration: `20260907_daily_summary_views.sql`. See `DECISIONS.md` §"daily_summary".

### exercise_pr_events — VIEW (2026-09-07)

```
exercise_pr_events   user_id, session_id, completed_date, name, lbs, prev_best
                     = sessions whose top setsData weight for an exercise beats
                       max over ALL earlier sessions (completed_date, created_at, id)
                     strict; first-ever lift and ties are not PRs; weight 0 ignored
                     security_invoker = true; GRANT select TO authenticated only (verified)
```

Read with `loadBests` (mount, Retry, after a session insert) keyed by session id for
the Train history cards, and by Progress for "PRs this month". Replaces the stored
`workout_sessions.prs` / `exercises[].isPR` (#28). Migration
`20260907_exercise_pr_events_view.sql`.

### workouts — LEGACY, DO NOT USE
`id, user_id, name, tag, level, est_min, exercises, created_at, updated_at`. Zero rows.
The application never references it. Plans live in `workout_plans`.

---

## The `sb` wrapper — read this before touching any data code

`sb` is a hand-rolled Supabase REST client (module-level in `App.jsx`, ~line 4524).
**No `@supabase/supabase-js`.** `sb.headers()` reads `sb._session` at call time, so a
just-refreshed token is used automatically.

| Method | Returns on success | Returns on failure |
|---|---|---|
| `select(table, filters, opts)` | parsed array | **`[]` on ANY non-2xx** |
| `selectAuth(table, filters, opts)` | `{authError:false, rows:[...]}` | `{authError:<401\|403>, rows:[]}` |
| `insert(table, row)` | the row | **`null`** |
| `upsert(table, row)` | the row | **`null`** |
| `update(table, changes, {filter})` | `true` | `false` |
| `delete(table, filter)` | `true` | `false` |

**None of these throw.** All log `[sb.<method>] <table> <status> <body>` to the console
on failure — that logging is the only reason the schema mismatches above were ever found.

### The two rules that matter

1. **`select` collapses every error into `[]`.** A 401, a 500, and "no rows" are
   indistinguishable. 15 call sites depend on this contract and are `[]`-guarded, and
   several sit inside `Promise.all` batches where a throw would propagate differently.
   **Do not change it.**

2. **`insert`/`upsert` return `null` on failure without throwing.** A `try/catch`
   around them catches *nothing*. Callers **must** check the return value:
   ```js
   const row = await sb.insert("food_log", {...});
   if (!row) throw new Error("insert returned no row");   // then roll back + surface
   ```
   This exact gap is why users saw workouts and food "save" for months while the tables
   stayed empty.

### `selectAuth` — narrow by design

**`ok` vs `authError` (2026-09-07).** `selectAuth` returns `{ok, authError, status,
rows}`. `authError` is true only for 401/403 and drives routing (the profile
read). `ok` is false for ANY non-2xx or network failure. Readers that must not
launder a failure into "no rows" — `exercise_bests`, the sessions read, the
week-history reads — key on `ok`. Before `ok` existed, a 500 on the view read
came back `{authError:false, rows:[]}`, the same shape as a new lifter, and
Start would have proceeded with an empty PR baseline. Verified: 500 and a
network abort both pause Start; 200-with-no-rows lets a session start with no
baseline and no PR on a first lift.

Used at **exactly one call site**: the mount profile check in `loadUserData`. It exists
because `select`'s `[]`-on-error contract makes a 401 look like a brand-new user. It is
a sibling method, not a replacement — adding callers is fine, changing `select` is not.

---

## Auth

Session lives in `localStorage["sb_session"]` and in `sb._session`.
`expires_at` is **UNIX seconds**, not milliseconds.

- `persistSession(d)` — derives `expires_at` from `expires_in` when the refresh grant
  omits it; writes both `sb._session` and localStorage.
- `refreshSession(token)` — POSTs `grant_type=refresh_token`. Guarded by a
  **module-level `_refreshInFlight` promise** so StrictMode double-mounts and concurrent
  remounts collapse onto **one** network call. The refresh token is single-use and
  rotates, so a second concurrent call would fail with an already-consumed token.
- `resolveSession()` → `{status: "valid" | "refreshed" | "logged-out", session?}`.
  Refreshes at most once. `REFRESH_SKEW_MS = 60s` — a token expiring within a minute is
  treated as needing refresh.

The mount effect awaits `resolveSession()` **before any data load**, inside
`try/catch`; an unexpected throw routes to sign-in rather than hanging the spinner.

### Routing rule — get this wrong and you destroy data

```
authError            -> "auth"        (returning user, expired/invalid session)
rows.length > 0      -> "app"
genuine 200, 0 rows  -> "onboarding"  (authenticated, truly no profile)
```

**Onboarding must never be a fallback.** It is the one path that overwrites a real
profile. Before this was fixed, an expired token produced `[]` from `select`, which read
as "new user" and dropped a returning user into the onboarding wizard — completing it
would have overwritten their real data.

`loadUserData`'s catch uses a `profileLoaded` flag: a failure **after** the profile
resolved keeps the app usable (`"app"`), a failure **before** it goes to `"auth"`.
`handleAuth` calls the same function, so a post-sign-in failure behaves identically.

### Dates — `localDate()`

```js
const localDate = (d = new Date()) => d.toLocaleDateString("en-CA");
```

**Every `date` column stores the user's LOCAL day.** `toISOString()` returns the UTC
day, which is already tomorrow for anyone west of UTC logging in the evening — a
workout at 2026-07-28 19:42 PDT was stored as 2026-07-29, and every "today" view then
failed to find it. Writes, read filters, and comparisons all go through `localDate()`
so they cannot drift apart.

`updated_at`/`created_at` (timestamptz) correctly stay UTC via `toISOString()`.

**Known limitation:** `today` is computed **once per `App` mount**. A session left open
across midnight keeps writing yesterday's date.

---

## Workout session persistence — and a premise that was wrong

An in-progress workout is snapshotted to `localStorage` under
`wifit_workout_<uid>` (`workoutKey`, `readWorkoutSnapshot`,
`clearWorkoutSnapshot`, ~line 6216). Written debounced at 500ms from
`ActiveWorkout`, read once on `WorkoutTab` mount, cleared on finish, on cancel
and on sign-out, and discarded when older than **6h measured from `startedAt`**.

### What it is actually for

**It is not protection against tab switching.** The commit that added it
(`0e032ee`) said it was, and that was wrong:

- `ActiveWorkout` renders `position:fixed`, inset 0, opaque `T.bg`,
  **`zIndex:190`** (~line 3606).
- The bottom nav is **`zIndex:99`** (~line 7007).
- `App`'s root is `position:relative` with **no** `z-index`, so it creates no
  stacking context and the two compete directly. 190 wins.

The nav stays mounted in the DOM during a workout — it is never conditionally
hidden — but it is completely covered by an opaque overlay with no
`pointer-events:none`. **It cannot be tapped, so the tab switch that would
unmount `WorkoutTab` and destroy the session was never reachable.** Both z-index
values have been what they are since the first commit `eca72a5`; this was never
possible at any point in the project's history.

Verified in the running app rather than by reading: `document.elementFromPoint`
at the centre of the Train nav item during a workout returns a set row inside
`ActiveWorkout`, not the nav.

The snapshot is justified by what remains, which is not theoretical for a phone
in a pocket during a 45-minute session: **hard reload, accidental refresh, the
OS evicting a backgrounded tab, the tab being closed.** `index.html` sets
`apple-mobile-web-app-capable` but there is **no service worker and no
manifest**, so on iOS "Add to Home Screen" a backgrounded session frequently
gets a full reload on return — for that case the reload is close to the normal
path back into the app, not an edge case.

See `DECISIONS.md` §"Verify reachability before fixing reachability".

### Exit paths

There is no router, and **no `popstate`, `pushState`, `beforeunload`,
`pagehide` or `visibilitychange` handler anywhere in `App.jsx`.** Tab state is
plain React state. That gives exactly three in-app exits, plus the environment:

| Path | Snapshot | Session saved |
|---|---|---|
| "✕ Cancel" (header) | **cleared** | **no — discarded** |
| "Finish" (header) | cleared | yes |
| "🏁 Finish workout" (bottom) | cleared | yes |
| Browser/Android back, swipe-back | survives | resumable |
| Reload, tab close, OS eviction | survives | resumable |
| Sign out | cleared (deliberate) | no |

Back does **not** close the workout — with no router it leaves the app entirely,
and with no `beforeunload` there is no prompt. The snapshot is what makes that
recoverable.

**Cancel is the only path that destroys work**, which is why it asks for
confirmation when `doneSets > 0`. Supplement reminders are not an exit: they are
`new Notification()` from `setTimeout` with no service worker and no
`notificationclick` handler, so a tap just focuses the tab.

### Demo mode cannot exercise any of this

**Verified end to end 2026-09-06** against a signed-in account: restore after a
hard reload, the 6h staleness rule, foreign-uid isolation, clearing on finish
and on cancel, and the cross-midnight `completed_date`. See `DECISIONS.md`
§"How to test a restore without fooling yourself" for the method — in particular
why "reload and the sets are still there" is not a valid test, and what to
inject instead.

`uid` is `sb.getUser()?.id`, and demo mode has no session, so `workoutKey`
returns `null` and nothing is written or restored. That is the intended
"no uid means no key" behaviour — an unkeyed snapshot would restore one
account's workout for another on a shared device. **The practical consequence is
that verifying the snapshot, the restore, or the resumed-session banner requires
a signed-in account; demo mode is not enough.**

---

## `/api/coach` security

**Local dev burns the real rate limit (2026-09-07).** `vite.config.js` proxies
`/api` to the deployment, so every coach call from `localhost:5173` counts
against `coach_usage` for the signed-in user — the same **60/hour + 400/day**
the production app uses. When iOS testing starts on the same account, that
budget is shared three ways (web prod, localhost, the Swift client) and a 429
will look like a client bug. Check `coach_usage` for the user before debugging
a coach that "stopped working".

Vercel Edge runtime. Not streaming — `await upstream.json()` buffers the whole response.

**Auth gate.** The client attaches its `access_token` via `coachHeaders()`, read at call
time. The server verifies against `GET {SUPABASE_URL}/auth/v1/user` and **rejects on any
non-2xx — not `status === 401`.** Verified against the live endpoint:

| Request | Response |
|---|---|
| garbage token | **403** `bad_jwt` |
| no Authorization header | 401 `no_authorization` |
| **the public anon key** | **403** `invalid claim: missing sub claim` |

A 401-only check would admit both a malformed token **and the anon key that ships in the
client bundle**. The gate runs before anything else, so no unauthenticated request ever
reaches Anthropic. Confirmed in production: an unauthenticated curl returned an Anthropic
`request_id` before the fix and returns `401 {"code":"unauthenticated"}` with no
`request_id` after — the absence of that field is the proof Anthropic was not called.

**Body caps** — the gate alone still lets a signed-up user request the most expensive
model in a loop, so the payload is **rebuilt from validated parts**, never forwarded:

- `model` **pinned server-side**, client value discarded
- `max_tokens` clamped to **1200**
- `messages` must be a non-empty array of ≤ 24
- `system` truncated at 20,000 chars
- 5 MB body ceiling when an `image` block is present, **128 KB** when text-only

Size tiers key off whether an image block actually exists. A client-declared "purpose"
field would be attacker-controlled and would enforce nothing.

**Rate limit: 60/hour + 400/day per authenticated user**, counted **on entry** —
recorded before the Anthropic call, so nobody can burn quota and retry for free. Keyed
to user id, not IP (mobile NAT sharing, IP rotation). State lives in `coach_usage`
because Edge isolates are ephemeral, concurrent and per-region — an in-memory counter
would enforce nothing. Over the limit returns **429** with `Retry-After` and a message
naming the real wait. Any Supabase failure during the check **fails closed** (503).

**Request accounting:** a plain-text coach reply costs **2** requests (`callClaude` +
`generateSuggestions`). A structured reply — `MULTI_FOOD`, `MEAL_SUGGESTION`, `RECIPE`,
`WORKOUT_PLAN` — returns early and costs **1**. A photo log costs 2.

Anthropic response formats are unchanged and out of scope for security work:
`MULTI_FOOD`, `MEAL_SUGGESTION`, `RECIPE`, `WORKOUT_PLAN`, `ADD_SUPP`, `WATER_LOG`.

---

## Known issues / not done

1. **10 `sb.*` call sites still ignore the return value.** Re-verified 2026-09-06
   against the current file — still exactly 10 ignored against 9 checked. Locate by
   identifier, not by line; these shift:

   | Line | Call | What silently fails |
   |---|---|---|
   | ~~2924~~ | ~~`sb.delete` food_log~~ | **fixed 2026-09-07** — result checked, item restored + `showError` on failure |
   | ~~4228~~ | ~~`sb.delete` supplement_stack~~ | **fixed 2026-09-07** — checked, restored in place + `showError` |
   | ~~4236~~ | ~~`sb.update` supplement_stack~~ | **fixed 2026-09-07** — checked, reverted + `showError` |
   | ~~4251~~ | ~~`sb.update` supplement_stack~~ | **fixed 2026-09-07** — checked, reverted + `showError` |
   | ~~4337~~ | ~~`sb.update` supplement_stack~~ | **fixed 2026-09-07** — out of the state updater, every PATCH awaited and checked, order reverted on failure |
   | ~~5259~~ | ~~`sb.upsert` profiles~~ | **fixed 2026-09-07** — a failed upsert no longer calls onComplete; the wizard stays on the summary step with Retry |
   | ~~5887~~ | ~~`sb.upsert` profiles~~ | **fixed 2026-09-07** — ✓ and local goals/name are gated on the row; failure shows a message |
   | ~~6623~~ | ~~`sb.upsert` profiles~~ | **fixed 2026-09-07** — row checked, previous theme restored + toast; the try/catch that caught nothing is gone |
   | ~~6835~~ | ~~`sb.insert` custom_foods~~ | **fixed 2026-09-07** — returns whether the row landed; the toast waits for it |
   | ~~7017~~ | ~~`sb.delete` workout_plans~~ | **fixed 2026-09-07** — result checked, plan restored + `showError` on failure |

   Line 4337 is worse than the rest: it is `sb.update(...)` with **no `await`**, so
   it is fire-and-forget — not even a rejected promise would be observed. The
   others at least resolve before the handler returns.

   Note the shape of the `try/catch` on several of these. `try{await sb.delete(…)}
   catch{}` reads like error handling and is not: `sb` does not throw, so the catch
   is unreachable and the `null`/`[]` return sails straight past it. That is the
   trap this whole section exists to flag.

   Both of those are **separate bug classes**, not variants of this one, and
   `DECISIONS.md` records each with what would structurally prevent it —
   §"Fire-and-forget async is a different bug from an ignored result" and
   §"A catch block around code that cannot throw is worse than none". The second
   matters most to a reviewer: an unchecked call looks unfinished and gets read
   on; a `catch` block looks considered and stops the reading.

   `addFoodItem` (6823) and `saveWorkoutSession` (6916) are the two that *do* check
   — copy their shape. Fixing one is always in scope.

2. **Open Food Facts search is CORS-blocked** from the browser. USDA works. Needs a
   proxy (an Edge function like `/api/coach`) or removal.

3. **The AI parser contradicts the custom-food form.** `parseIntent` hardcodes
   `cup → 240 g` and `scoop/serving → 30 g`, while the custom-food form deliberately
   refuses to guess and requires the user to supply grams for food-dependent units. Two
   different positions on what a cup weighs.

4. ~~**USDA `servingSizeUnit` is never read.**~~ **RESOLVED 2026-09-06.**
   `usdaServingGrams` (above `searchUSDA`) now reads the unit: grams pass through,
   ounces convert at 28.3495, and ml / IU / anything unrecognised return `null`.
   Both call sites use it — the food search and the supplement search, which was
   the worse of the two (a 5000 IU vitamin D rendered as "5000g/serving"). ml is
   deliberately **not** converted: ml→g needs a density, which is a property of the
   food, and issue #3 below already documents the app holding two positions on that
   question — this does not add a third. `null` is safe because the food UI falls
   back to 100 g **and says so**. 6 tests in `src/__tests__/usdaServing.test.js`.
   See `DECISIONS.md`.

5. **No edit or delete UI for custom foods.** Create-only. A bad row can only be removed
   from the database directly.

6. ~~**`GoalDots`** (~line 498) is a complete component nothing renders.~~
   **RESOLVED 2026-09-06 — deleted.** Unlike `WeightLogWidget`, which had a place to
   be wired into, nothing in the app had a use for it. It also called `useTheme()`
   and never used the result, so it accounted for **two** of the `no-unused-vars`
   warnings, not one.

7. **`coach_usage` retention.** One row per request, ~110 bytes with the index. At 100
   active users it approaches the 500 MB free tier within a year. Only the last 24h is
   ever read. When the table nears ~1M rows, add a nightly `pg_cron`:
   `delete from coach_usage where created_at < now() - interval '2 days';` — it runs as
   `postgres`, so the absent DELETE policy does not block it.

8. **`today` is computed once per mount** (see Dates above).

   **Same family, Home week rail (2026-09-06):** `weekHistory` — the six prior
   days of the Mon–Sun week — is loaded once per mount by `loadWeekHistory`.
   If the app stays open across midnight the new "yesterday" is not in it and
   its ring renders as unknown until reload. Accepted for now; fix together with
   `today`.

9. **ESLint reports 25 `no-unused-vars` warnings**, 0 errors. Mostly untriaged —
   but worth knowing they are not all noise. Twice now a warning here has been
   pointing at something real:

   - `SUPP_CATS` was a dead 13-entry category list sitting next to a hardcoded
     8-entry copy in the browse filter. The warning marked a real UX bug — five
     categories no filter could reach — for as long as it went unread. 28 → 27 on
     2026-08-29, when the constant was given its purpose back.
   - `GoalDots` was an entire unrendered component (issue #6). 27 → 25 on
     2026-09-06 when it was deleted, two warnings rather than one because it also
     called `useTheme()` without using the result.

   `AGENTS.md` is now tracked in git (commit `81aaa26`) and its counts are updated
   in the same commits that move them. The previous note here — that it still said
   28 and could not be kept in sync because it was untracked — no longer applies.

10. **The pinned model ID in `api/coach.js` is a maintenance liability — and it is
    the first thing to check when the coach breaks.** `MODEL` is pinned
    server-side (deliberately: callers must not choose the model). But a model ID
    is not permanent. `claude-sonnet-4-20250514` retired on 2026-06-15, and from
    that moment every authenticated coach request returned **HTTP 404** — the
    proxy passes `upstream.status` through verbatim, so Anthropic's
    `not_found_error` surfaced as a 404 from `/api/coach` and looked exactly like
    a missing or undeployed function. There is **no graceful degradation**: the
    coach simply stops, with a status code that points at the wrong layer.

    Dateless IDs like `claude-sonnet-5` are **still pinned snapshots, not
    evergreen pointers** — this one will retire too. Check the constant against
    <https://platform.claude.com/docs/en/about-claude/models/overview> before
    debugging anything else.

    Two diagnostics that tell a retired model apart from a broken deployment:
    the Vercel runtime log shows the request reaching the function
    (`source=edge-function`) and returning 404 rather than the route 404ing; and
    `coach_usage` gains a row per attempt, because usage is recorded on entry,
    just before the Anthropic call.

11. **`react-hooks/exhaustive-deps` is deliberately OFF.** `rules-of-hooks` is on
    and set to `error` — it is what would have caught the `RecipeCard` crash, where
    a `useState` inside `renderMsg` (called from a `.map`) made the hook count
    depend on how many recipe messages existed and blank-screened the app.
    `exhaustive-deps` reports **7 advisory warnings** in `App.jsx` (lines ~740,
    955, 1861, 4533, 4538, 5880, 6679 — missing deps such as `loadUserData`,
    `callClaude`, `fetchMonthData`). Turning it on would move the documented
    25-warning baseline for no correctness gain today, so it is a decision, not
    an oversight. Revisit if a stale-closure bug ever shows up.

12. ~~**Two category vocabularies share `supplement_stack.category`.**~~
    **RESOLVED 2026-08-29.** Both paths now write the lowercase purpose enum:
    `ACTION_VALID.supplement` validates the coach path, `toSuppCategory` maps the
    manual path at write time, and the one capitalised row was backfilled by
    `20260829_normalize_supplement_stack_category.sql`. Live table is now
    `performance` 2, `health` 1, NULL 2 — zero non-conforming. See
    §supplement_stack. Remaining follow-up: add the CHECK constraint once C2 has
    retired the unvalidated `ADD_SUPP` path.

13. **`supplement_stack.category` is still write-only.** Written by both paths,
    read back into `suppList`, and then never used — the dot renders from the
    separate `dot_color` column. Normalising it now was cheap precisely because
    nothing depends on it; Phase 2 grouping is the first consumer.

14. **The CHECK constraint on `supplement_stack.category` is deliberately
    deferred, not forgotten.** The obvious guard —
    `check (category is null or category in ('protein','vitamin','mineral',
    'performance','health','sleep','fat_burner','probiotic'))` — is the thing
    that would make the normalisation permanent. It is **not** applied yet for
    one reason: the pre-ACTIONS `ADD_SUPP` path is still live until C2 retires
    it, and that path does **not** validate `category` (only `ACTION_VALID.
    supplement` on the ACTIONS path does). With the constraint in place, a model
    that emitted an out-of-enum category on the legacy path would produce a
    constraint violation, `sb.insert` would return `null`, and the user would
    see "Supplement couldn't be saved. Check your connection." — a database
    error surfacing as a network error, on a response that is the model's fault.

    **Apply it as the first commit after C2 lands.** At that point every write
    goes through `ACTION_VALID.supplement` or `toSuppCategory`, both of which
    already guarantee the enum-or-null invariant, so the constraint becomes a
    belt-and-braces guard rather than a live failure mode.

15. **Phase 4 (after the Home redesign): audit every `T.accent` consumer used as
    TEXT — not fill or border — across all tabs, and switch to `T.accentText`
    where contrast fails on light palettes.** Found in the Phase 1 pass: the 12
    mode-locked palettes deliberately have a light `acc` (rings, borders,
    glows) and a separate `accTxt` "safe for small text"; legacy code uses
    `T.accent` for both. Settings' "Manage" chip is pink-on-pink under Pastel.
    Neither Phase 2 nor 3 touches Settings, so this is its own pass. Logged
    2026-09-06.

16. **Onboarding can leave a partial `profiles` row.** Row `768bb3ac…` has
    `theme` set and `name` null (2026-07-04). The wizard's upsert fires per step
    or on an incomplete run and nothing requires `name` at the database. Logged
    2026-09-06, not fixed: needs either a NOT NULL + default, or a single write
    at wizard completion. Check this row before trusting any per-user report.

17. ~~**The coach can emit the same action twice in one reply.**~~ **RESOLVED
    2026-09-07 — and it was the client, not the model.** `send` passed
    `[...messages, userMsg]` as history and `callClaude` appended `userMsg`
    again, so **every request carried the user's message twice**. The model did
    exactly what it was asked, twice: two `water 16` actions, two chicken rows
    6 ms apart, and on a cleared chat it literally replied "Logged both 16oz
    entries". Fixed in request assembly — `buildRequestMessages` puts the new
    turn on exactly once and is tested — and `send` now passes prior turns
    only. Two related changes shipped with it: applied-action cards are
    replayed into the model's context as `[Logged …]` lines (they were dropped
    entirely, so the model could not know a request had been acted on), and
    the prompt gained explicit action-hygiene rules. Verified against the live
    model on a cleared chat: one water action, one food action, and a plain
    question produced no actions. No time-window dedup was added.

18. **Open Food Facts v2 search returns unrelated products for a non-matching
    query.** Audit 2026-09-07: `zzzqqqxx` returned "Sidi Ali", "Perly", "Fromage
    Blanc Nature". The cgi endpoint is CORS-blocked (#2), so v2 is what actually
    answers, and it never answers "nothing" — a true no-results state is
    unreachable through OFF, and a user searching a food OFF lacks sees foreign
    junk instead. Log only. **The fix is a name-match filter on OFF results, not
    dropping OFF** — it is also the barcode source.
    With USDA off (#21) this now matters more: OFF is the only remote source, so
    **the "No results" empty state is unreachable through search** — every
    nonsense query returns the same three products. Verified 2026-09-07 at
    390 px with `qwzxjvkplm` and `zzzqqqxx`.

19. ~~**The built-in food catalogue (`LOCAL_FOOD_DB`) has no sugar field.**~~
    **RESOLVED 2026-09-07.** Every one of the 43 entries now carries `sugar`
    per 100 g — label/USDA values where known, `null` for the three Real Good
    meals (unknown is honest; 0 is a claim). `food_log` writes `per100_sugar`
    as null when unknown and `brand` as null when blank, so empty means empty
    in both tables. Totals treat null as 0. Tested.

20. **Food surfaces, cosmetic — for the redesign, not now (audit 2026-09-07,
    390×844):** the Create-food view carries the previous search's "No results
    found" banner into the form; `AddFoodModal`'s nutrition preview uses
    hardcoded white text on a light card and is near-invisible on light
    palettes.

    Also recorded from the same audit, all correct: the same food logged twice is
    two rows (no merge); decimal grams (87.5) round-trip; apostrophe/slash in
    search and an apostrophe in a custom-food name are fine; a food logged at a
    fake 23:55 local stamps the local day; offline, a logged item rolls back
    within a second with "Food couldn't be saved" — there is no pending-sync
    queue, the write is lost and the user is told; no `[sb.*]` line in any run.
    Not exercised: barcode (needs a camera), USDA→log (needs `USDA_API_KEY` on
    Vercel), quantity edit and slot change (do not exist).

21. **USDA search is OFF by design (2026-09-07), not broken.** `USDA_ENABLED =
    false` in `App.jsx` gates the fan-out: the proxy is never called and search
    reports only the sources that ran, so an empty result is an empty state. The
    branded dataset's search relevance was not worth the dependency. `api/usda.js`,
    the client, the `USDA_API_KEY` env contract and the honest failed-search UI
    are all kept — flip the flag to re-enable, or point the same proxy at another
    provider. `searchSupp` returns the local catalogue only while off.

22. **Long-tail and restaurant foods have no source.** With USDA off, search is
    the 43-entry local catalogue, the user's custom foods, and Open Food Facts
    (packaged goods; v2 relevance is poor, see #18). Anything else — a
    restaurant meal, a regional brand, a home recipe — has nowhere to come from
    except the coach's estimate. Four candidate routes, **no decision taken**:
    grow the local catalogue; Nutritionix (restaurant + branded, paid);
    FatSecret (broad, free tier, attribution); coach-as-lookup (the model
    estimates per-100 g and the app labels it as an estimate). The redesign's
    search surface should be planned against whichever is chosen.

23. **`workout_sessions.prs` — the app's only computed-and-stored value — was
    computed wrong in four ways (Train audit 2026-09-07).** Fixed the same day,
    all four; the mechanism is recorded in `DECISIONS.md` §"A stored derived
    value is only as right as the moment it was derived".
    - `parseInt` on every weight and rep read truncated 27.5 to 27 in the set
      inputs, the PR comparison and the history rebuild → `parseFloat`, one
      shared reader (`setWeightOf`).
    - PRs were decided at set-tick time into an append-only list, so editing
      the weight afterwards or un-ticking left a stale entry that persisted →
      `computePRs` runs once in `finishWorkout` from the final sets; the live
      banner is derived from the same function.
    - The history read was `sb.select`, so a 401 became an empty `prHistory`
      and every genuine PR in that session persisted as `isPR:false` →
      `selectAuth`; on failure Train shows "Couldn't load your history — PRs
      can't be checked, so starting is paused" with Retry, and every Start
      (Today card, plan cards, Home's Start) is blocked until it loads. Note:
      the *timing* variant — a session starting before the read lands — is
      unreachable: `loadUserData` awaits every read before showing the app.
    - `prHistory` was rebuilt from the last **20** sessions only, so an older
      best was forgotten and a lower lift later was stamped a PR — reproduced
      live against a seeded 23-session history (true best 80, app showed
      "Best: 30", 40 persisted as a PR). See #24 for the fix decision.

24. ~~**`prHistory` completeness (F4).**~~ **RESOLVED 2026-09-07** — the
    client cache is gone; `bests` is read from the `exercise_bests` view
    (§schema) at mount, on Retry and after each finish, via `selectAuth`, and a
    failed read pauses Start. Verified against a seeded 23-session history:
    "Best: 80" where the old code showed 30, and 40 not a PR.

    Logged, not fixed, from the same audit: `workout_plans.sort_order` is
    written as `0` by the coach path and `workouts.length` by the manual path
    (two conventions) — **fixed 2026-09-07, append everywhere**; every stored
    plan exercise set carries a runtime `done:false` — **left as is**, not
    worth a migration for a flag nothing reads; sessions kept a local
    `"h"+Date.now()` id with no uuid write-back — **fixed**, `saveWorkoutSession`
    now carries the row's uuid into state so #25's delete cannot have the food
    bug; a plan restored after a failed delete reappeared at the top — **fixed**,
    restored at its original index.

25. ~~**REQUIRED PRE-LAUNCH — edit / delete a logged workout session.**~~
    **DONE 2026-09-07.** Train history cards have **Delete** (inline confirm) and
    **Edit sets** (reps/weight on completed sets). Scope, deliberately: no
    add/remove set or exercise, no date edit, no exercise rename — date and
    name are the views' ordering and group keys, and set count changes the
    stored `sets_completed`/`total_sets`. The write is a whole-array PATCH of
    `exercises` (partial jsonb update is not possible through PostgREST without
    an RPC); the editor re-reads the row before opening and last-writer-wins is
    accepted for v1 (single user, two windows). `editSet` rewrites `sets[i]`
    and `setsData[i]` from the same numbers; `normalizeExercises` runs before
    the write. **Refresh contract:** after any successful mutation
    `retryHistory()` re-reads history + `exercise_bests` + `exercise_pr_events`
    with ok-keyed `selectAuth`; if that re-read fails, `historyStatus` is
    `failed` — Start paused, the History list replaced by "Couldn't load your
    history — what was shown before may be out of date" — never a stale list
    rendered as truth. No optimistic delete (a local filter leaves 19 rows while
    row 21 exists). Verified: deleting the session that set a PR promotes the
    later lift without a reload; forced 500 on PATCH leaves state and the row
    unchanged with the editor open; forced 500 on the re-read after a
    successful delete shows the failed state with Start blocked.
    Correction path for the `exercise_bests` corollary now exists — the 500 lb
    bench in the second corollary would be a two-tap delete.

26. **REQUIRED PRE-LAUNCH (iOS) — real reminders via `UNUserNotificationCenter`.**
    The web app's "reminders" are a `setTimeout` in the open tab. As of
    2026-09-07 the UI says so (time label + in-app nudge; no push/alert copy;
    dead Settings toggles removed) and the mechanism is at least correct
    (cancelled on unmount, re-armed daily). `supplement_stack.reminder_time` /
    `reminder_enabled` are the schedule the iOS app should register. See
    `DECISIONS.md` §"A claimed capability is the feature-level case of the
    lying class".

27. **Every mount read now fails loud (P0, 2026-09-07).** `loadUserData`'s
    `read()` records failed sections in `loadFailures`; a top banner names them
    with Retry. Writes that would be destructive against an empty state are
    guarded: water `+8` (the upsert REPLACES the day), supplement capsules
    (would flip a true row to false), plan create/edit (a 500 used to seed
    `INITIAL_WORKOUTS` as if the user were new — the seed is no longer shown
    on failure, and Train pauses). Calendar, Progress and ProfilePage refuse
    to render numbers/form on a failed read (ProfilePage's Save is disabled —
    a blank form saved is data loss). Additive writes (food, custom foods,
    weight) are banner-only. Ten `sb.select` sites remain nowhere; the profile
    read keeps `authError` on purpose (routing).

    Also from the Supps audit: a capsule tap on a supplement still saving
    (local key at a uuid column) is refused with "still saving" instead of a
    swallowed 400; `supplement_stack.sub` stores null for blank.

28. ~~**PLANNED — `exercise_pr_events` view replaces `workout_sessions.prs`.**~~
    **DONE 2026-09-07** (sequenced BEFORE #25 after all: an edit UI built while
    `prs` is stored would have to maintain a derived column on every edit). The
    view (`20260907_exercise_pr_events_view.sql`) derives PR events from
    `setsData` — a session's top weight beats the max over all earlier
    sessions, strictly; first-ever lifts and ties are not PRs; weight 0 never
    counts. The client **stopped writing** `prs` and `exercises[].isPR`; the
    history cards and Progress' PR card read the view. **`prs` column and
    existing `isPR` keys are still in the schema/data** — drop them in a later
    migration once nothing reads them (a column drop is not reversible; nothing
    reads them now, so it is safe whenever). The only PR logic left on the
    client is ActiveWorkout's live banner (`computePRs` against `exercise_bests`
    loaded at session start) — the session isn't saved yet, so no view can
    answer it. Verified against a seeded 5-session history (3 expected events,
    5 decoys, exactly 3 rows) and zero sessions → zero rows.

29. **`body_weight_log` read was the OLDEST 30 rows** (`order=log_date.asc&limit=30`)
    — fixed 2026-09-07: newest 30, reversed. From weigh-in #31 every weight
    number in the app had silently frozen on the first month. The ceiling now
    serves only what needs "latest" (Home strip, coach context, today's entry);
    range history comes from `daily_summary` and all-time from `weight_monthly`,
    neither bounded by a row count. The class: a `limit` is a correctness
    ceiling on a delay — the same shape as the 20-session `prHistory` window.

---

## Current data state (2026-08-13)

`profiles` 3 · `workout_plans` 2 · `supplement_stack` 2 · `supplement_log` 1 ·
`custom_foods` 1 · **`food_log` 0 · `workout_sessions` 0 · `water_log` 0 ·
`body_weight_log` 0 · `coach_usage` 0** · `workouts` 0 (legacy).

The zeroes are a deliberate clean slate. Five `workout_sessions` rows were deleted as
click-through artifacts (3–13 second durations; one recorded 12 sets in 13 seconds and
generated 4 phantom PRs because `prHistory` was empty). Leaving them would have seeded
the planned PR baseline with template-default weights.

**No real workout, water, or body-weight entry has ever been persisted through the UI.**
Those write paths are fixed in code but not yet runtime-confirmed.

## TrainerHQ shared-backend development integration (2026-09-08)

This repository is the canonical migration owner for WiFit and TrainerHQ. See [accepted decisions and migration status](TRAINERHQ_INTEGRATION.md). The user waived the backup gate only for disposable development data; managed backups, isolated environments and recovery procedures remain mandatory before real users.

Applied additive migration trainerhq_identity_and_consent introduces public.trainer_profiles, public.trainer_client_relationships, public.trainer_client_permissions, and private approval/invitation/audit/idempotency tables. New public tables use RLS and authenticated SELECT only. Mutations and category-limited reads of existing WiFit logs use the server-only trainerhq_api RPC through a secured Edge Function; original logging tables and owner policies are unchanged. All existing account IDs and logging tables remain canonical.

Applied trainerhq_assignments_scheduling_messaging adds trainer_workout_assignments, trainer_appointments, trainer_appointment_changes, trainer_availability, trainer_conversations/members/messages/receipts/attachments and trainer_reminders. Nullable trainer_assignment_id on existing workout_plans and workout_sessions links accepted plans and client-authored completions without copying logs; composite foreign keys enforce matching client ownership. Existing WiFit writes omit this optional field and remain compatible. New mutations use the server-only gateway. Private Storage upload reservations and every message/attachment read check current consent. Group support initially covers one client and that client’s independently authorized trainers, with explicit trainer join.

Applied trainerhq_adherence_realtime_push adds client-owned tracking preferences, explicitly confirmed dated nutrition targets, versioned derived adherence summaries, notification preferences, private installation tokens and disabled notification jobs. Formula v1 uses calories/protein/carbs/fat weights 50/30/10/10, calorie tolerance ±10%, carb/fat tolerance ±15%, and protein as a minimum. Tracking timezone and eligible weekdays are explicit; missing data before cutoff is pending, missing eligible logs after cutoff incomplete. Unshared/unconfigured/ineligible categories are omitted and coverage below two suppresses the overall score. Workout adherence initially measures due trainer assignments completed in WiFit; session adherence measures this relationship’s appointments. Original WiFit data is read directly using numeric macro arithmetic. Private Broadcast carries only refresh signals and uses consent epochs; original log writes survive notification failures. APNs delivery is intentionally disabled until registered identifiers, credentials and a protected delivery worker are configured.

Applied trainerhq_roster_projection_contract fixes aliases in the new clients.list response and uses the canonical progress_measurements scope for weight-log invalidations. Authorization assertions now use NULL-safe comparisons. Original WiFit table/policy definitions remain untouched.

Applied trainerhq_pending_group_consent filters unaccepted group invitations through current trainer approval and active messaging consent, preventing title/creator metadata from surviving revocation.

The authenticated `/trainer-consent` React route uses the existing sb session and secured trainerhq-api Edge Function. Routes are lazy loaded; the main WiFit mount/Auth and food/supplement logging are preserved. Accepted assignment origins pass through workout plan loading and session writes via assignmentOrigin, which validates UUIDs. See TRAINERHQ_INTEGRATION.md and supabase/testing for current verification/provenance.

Applied trainerhq_conversation_display_names adds only display names to the current-member-authorized messages.threads projection. Other profile attributes remain private; native group UI does not show internal account IDs.


### Release hold and target-date correction (2026-09-09 UTC)

The owner explicitly prohibits updating remote `main` or deploying WiFit
production until full UI/device/recovery/preview/regression gates pass and a new
explicit approval is given. TrainerHQ remains a separate iOS project, UI,
identifier, architecture and release lifecycle; only backend contracts are
shared. See `TRAINERHQ_INTEGRATION.md`.

Prepared `trainerhq_client_timezone_targets` changes two date comparisons in the
new private TrainerHQ command function. `tracking.get` and `client.targets` select
the current nutrition target using the client's configured timezone instead of
the database date. Existing WiFit tables, RLS, logging and Auth remain unchanged.
The exact prior function/policies, six timezone authorization checks, targeted
rollback and in-memory recovery evidence are version controlled.
