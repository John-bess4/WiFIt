# WiFit Gen 1 — the narrative reference

Written 2026-09-09 for the engineer building Gen 2 (the SwiftUI rewrite). This
is the **how and why** of the React app: how it is put together, how state
moves through it, what each subsystem does, which rules it learned the hard
way, and what it still gets wrong on purpose.

It deliberately does **not** restate what `docs/port/` already specifies. The
schema, RLS, the data-layer contract, the coach protocol and the feature
inventory are single-sourced there — this file links to them and never copies
them. When this file and a `docs/port/` file disagree, `docs/port/` wins for
contracts and this file is stale; when this file and the source disagree, the
source wins and that is a finding worth reporting.

| Need | Go to |
|---|---|
| Columns, types, constraints, `on_conflict` targets | [port/SCHEMA.md](port/SCHEMA.md) |
| What a user JWT can actually read and write | [port/RLS.md](port/RLS.md) |
| The client contract both iOS apps implement | [port/DATA_LAYER.md](port/DATA_LAYER.md) |
| Every user-reachable function and its iOS home | [port/FEATURE_INVENTORY.md](port/FEATURE_INVENTORY.md) |
| `/api/coach` request shape, `ACTIONS:` format, rate limit | [port/COACH.md](port/COACH.md) |
| Reimplement / avoid / platform-gap triage | [port/KNOWN_ISSUES.md](port/KNOWN_ISSUES.md) |
| Every rule with the bug that produced it, in full | [DECISIONS.md](DECISIONS.md) |
| Live schema prose, numbered known issues | [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md) |
| The rewrite brief and bug archive by class | [HANDOFF.md](HANDOFF.md) |
| The second app's API surface | [TRAINERHQ_CONTRACT.md](TRAINERHQ_CONTRACT.md) |

Code is referenced by **symbol**, not line number. Roughly seventy commits
have moved every line in `App.jsx`; a function name still finds it.

---

## 1. Orientation

WiFit is a single-user fitness PWA: food logging with macros, workout plans and
live sessions, a supplement stack with daily taken toggles, water, body weight,
a calendar and progress view, and an AI coach that can log on the user's
behalf. React 18 with Vite 5, one Vercel project at `wifit.vercel.app`, one
Supabase project (Postgres and Auth) shared with a second app, TrainerHQ.

Three facts shape everything below:

1. **The web app is a reference implementation, not the product.** Four
   features the product needs are impossible on the web platform (HealthKit,
   Apple Watch, WidgetKit, reliable background notifications), so Gen 2 is a
   native rewrite. Gen 1's job was to get the data layer right so Gen 2
   inherits correctness rather than rediscovering ~25 silent data bugs.
2. **Everything server-side survives the rewrite as is.** The schema, the
   five views, all RLS, the migrations, the `/api/coach` edge function and the
   `trainerhq-api` gateway are language-agnostic. The Swift client hits the
   same endpoints with the same JWT.
3. **The client's failure model was the source of most bugs.** The REST
   wrapper never throws. A write that fails returns `null`; a read that fails
   returns `[]`. Every silent-data bug in the archive is some form of a caller
   trusting that shape. Gen 2's data layer must put failure in the type.

---

## 2. File map

From the tracked tree on 2026-09-09. Line counts are approximate and will
drift; the purposes will not.

### Root

| Path | Purpose |
|---|---|
| `AGENTS.md` | The agent rulebook. `CLAUDE.md` is a three-line pointer that imports it, so Codex and Claude Code read the same file. |
| `package.json` | `name: fittrack`, ESM. Dependencies are `react` and `react-dom` only — no `@supabase/supabase-js`, by rule. Scripts: `dev`, `build`, `preview`, `lint`, `test`, and `prepare`, which activates the pre-push hook. |
| `vite.config.js` | React plugin plus a dev-only proxy of `/api` to the production deployment, because the edge functions do not exist under `vite`. Consequence: local coach calls burn the real rate limit. |
| `vitest.config.js` | Node environment by default, jsdom opted in per file, `src/test/setup.js` stubs `localStorage`. |
| `eslint.config.js` | Two diagnostic rules on (`no-undef` error, `no-unused-vars` warn); `rules-of-hooks` on as error; `exhaustive-deps` off by decision. |
| `vercel.json` | One SPA rewrite: everything not under `/api` serves `index.html`. |
| `index.html` | The PWA shell. Sets `apple-mobile-web-app-capable` but there is no manifest and no service worker (see §5 Train). Title still reads "FitTrack". |
| `.env.example` | `USDA_API_KEY`, `ANTHROPIC_API_KEY`. The Supabase URL and anon key are hardcoded in `src/lib/supabase.js`. |
| `.githooks/pre-push` | Runs `npm run build` and refuses the push on failure. Why it exists is §6, invariant 12. |
| `WIFIT_GEN2_SWIFTUI_KICKOFF.md` | The prompt that opens the Gen 2 session. Untracked at the time of writing. |

### `api/` — the only server-side JavaScript (Vercel Edge)

| Path | Purpose |
|---|---|
| `api/coach.js` | The Anthropic proxy. Verifies the Supabase JWT, rebuilds the payload from validated parts, pins `MODEL`, enforces the 60/hour + 400/day limit in `ai_coach_usage`, passes the upstream status through verbatim. Contract in [port/COACH.md](port/COACH.md). |
| `api/off.js` | Open Food Facts free-text search proxy. Exists because every OFF endpoint is CORS-blocked in the browser. Same JWT gate. |
| `api/usda.js` | USDA FoodData Central proxy keeping the key server-side. Kept but gated off client-side (`USDA_ENABLED = false` in `src/lib/search.js`). |

### `src/` — top level

| Path | Purpose |
|---|---|
| `src/main.jsx` | Mount point. Lazily loads `TrainerConsent.jsx` when the path is `/trainer-consent`, otherwise `App.jsx`; renders in StrictMode under a Suspense fallback. This is the only path-based routing in the app. |
| `src/App.jsx` | Everything else: every screen except Home and the tab bar, every write handler, the root `App` component. ~5,900 lines, one file, on purpose (§7). |
| `src/HomeTab.jsx` | The redesigned Home screen. Imports from `src/lib/` only; every write goes through an App handler passed as a prop. The design reference for Gen 2. |
| `src/TabBar.jsx` | Bottom tab bar plus the raised quick-add fan. Rendered once by App for every tab. |
| `src/TabErrorBoundary.jsx` | Per-tab error boundary. A render throw becomes a loud, named card with a remount button, never a blank screen or a plausible empty state. |
| `src/TrainerConsent.jsx` | The `/trainer-consent` portal: scope picker, relationship cards, attachment viewer. Talks only to `src/lib/trainerAPI.js`. |
| `src/themes.js` | The 12 mode-locked home palettes from the design export, plus `buildThemeVars` and `KEYFRAMES`. Zero dependencies. |
| `src/trainerConsent.css` | Styles for the consent portal. |
| `src/test/setup.js` | A `MemoryStorage` stub for `globalThis.localStorage`; Node has none. |

### `src/lib/` — the port layer

Zero JSX (except `ui.jsx`), no imports of `App.jsx`, no cycles. This is the
list Gen 2 translates; [port/DATA_LAYER.md](port/DATA_LAYER.md) is the spec
for the shared package that most of it becomes.

| Path | Purpose |
|---|---|
| `src/lib/supabase.js` | The `sb` REST client over PostgREST and GoTrue, plus all session handling: `resolveSession`, `refreshSession`, the single `_fetch` chokepoint with its one-time 401 retry, `hasDbId` / `withDbId` / `foodDeleteFilter` for row identity. |
| `src/lib/coach.js` | The coach contract on the client side: `buildSystem`, `buildContextBlock`, `buildRequestMessages`, `parseActions`, `applyActions`, `callCoach`, the six legacy prefixes. |
| `src/lib/constants.js` | Catalogues and contracts: `MEAL_SLOTS`, `GOAL_OZ`, `LOCAL_FOOD_DB`, `SUPP_DB`, the supplement category enum and product-type map, `EXERCISE_LIBRARY`, `INITIAL_WORKOUTS`, `GOAL_RATES`, `ACTIVITY`. |
| `src/lib/nutrition.js` | `calc`, `totals`, `per100From`, custom-food serving to grams. Carries the Decimal-not-Double requirement. |
| `src/lib/dates.js` | `localDate`. The only way a `*_date` value is produced. |
| `src/lib/workouts.js` | Session shapes: `normalizeExercises`, `sessionFromRow`, `editSet`, `setsDataOf`, `computePRs` (the only client PR logic), `withPlanExerciseIDs`, `assignmentOrigin`. |
| `src/lib/search.js` | Source merge order (custom, local, OFF, USDA), the name-match filter, `usdaServingGrams`, the ok/partial/none/failed status ladder, the USDA gate. |
| `src/lib/weekSummary.js` | Pure helpers behind the Home week rail. `reduceWeekRows` is provisional (§8). |
| `src/lib/bodyMetrics.js` | BMR (revised Harris-Benedict), TDEE, calorie target from goal rate, macro split, `computeGoals`. |
| `src/lib/theme.js` | Theme registry and React context (`ThemeCtx`, `useTheme`, `resolveTheme`). Extracted to break the HomeTab-to-App import cycle; not for the port. |
| `src/lib/paletteToTheme.js` | Turns a palette into a full theme object with the 32 legacy keys plus the extended Home keys. Pure. |
| `src/lib/ui.jsx` | Shared primitives (`Card`, `SectionHeader`, `EmptyState`, `FailedState`, `MacroRow`, `mono`). Theme passed in explicitly; no hex in the file. |
| `src/lib/trainerAPI.js` | Thin client for the `trainerhq-api` edge function and the nine consent scopes. Documented, not owned, in [TRAINERHQ_CONTRACT.md](TRAINERHQ_CONTRACT.md). |

### `src/__tests__/`

Thirty-one Vitest files, 201 tests, about two seconds. A regression net over
the load-bearing logic, not an integration check: nothing here touches the
DOM beyond jsdom, the database, or a model. The invariants they pin are listed
against the rules in §6. **What the suite cannot see:** whether a write landed
(only the browser plus the table proves that), and whether the module graph
links (only the production build proves that; §6 invariant 12).

### `supabase/`

| Path | Purpose |
|---|---|
| `supabase/migrations/` | Applied migrations, recorded after the fact. The early ones are each the fix for one silent write bug (a missing `prs` column, a dropped serving unit, dropped sugar). The 2026-09-07 trio adds the five views. The seven `trainerhq_*` files are TrainerHQ's additive migrations. Do not `supabase db push` blindly; see `supabase/testing/README.md`. |
| `supabase/functions/trainerhq-api/` | The TrainerHQ gateway edge function. WiFit sessions do not call it. Out of scope here; contract in [TRAINERHQ_CONTRACT.md](TRAINERHQ_CONTRACT.md). |
| `supabase/tests/` | SQL assertion suites run in rolled-back subtransactions. |
| `supabase/rollbacks/` | The TrainerHQ compatibility rollback and one targeted rollback. |
| `supabase/testing/` | PGlite harness and provenance notes for isolated migration replay. |
| `supabase/preflight/` | JSON evidence snapshots from the TrainerHQ integration. |

### `docs/` and `design-export/`

`docs/` is indexed in the table at the top. `design-export/` holds the Home
design as exported (`HomeTab.jsx`, `home-reference.html`, `MIGRATION.md`);
`src/HomeTab.jsx` is that export with its defects fixed and its demo data
removed.

---

## 3. Architecture

### One tree, one state owner

There is no router, no store, no context beyond the theme. `App` owns every
piece of server-backed state as plain `useState` and passes handlers down.
Every screen is a child of `App`; no child calls `sb` directly. That rule is
stated in `HomeTab.jsx`'s header and holds for every tab: a write is always an
App-level function, so there is exactly one place to look for how a table is
written.

The render tree is a six-way switch on the `tab` string (home, food, workout,
supps, calendar, progress), each branch wrapped in `TabErrorBoundary`, with
`TabBar` rendered once outside the switch. The coach is a drawer toggled from
a right-edge tab, rendered alongside whatever tab is active. Profile, Settings,
Personalization, Upgrade and Help are full-screen pages reached from the
avatar menu, not tabs.

### The data layer, in one paragraph

`sb` is a hand-rolled client over the Supabase REST endpoints. Nothing in it
throws. `select` returns `[]` on any non-2xx; `selectAuth` returns
`{ok, authError, status, rows}` so a caller can tell failed from empty;
`insert` and `upsert` return the row or `null`; `update` and `delete` return
a boolean. One `_fetch` chokepoint attaches the session token at call time and
retries once on 401 after a refresh, never on 403. Every failure logs
`[sb.<method>] <table> <status>` to the console, which is the only reason
most of the schema mismatches were ever found. The full surface and the
treatment ladder for a failed read are in
[port/DATA_LAYER.md](port/DATA_LAYER.md) §1 and §2.

### Derived values live in Postgres

Five views (`exercise_bests`, `exercise_pr_events`, `daily_summary`,
`supplement_due_from`, `weight_monthly`) compute everything that can be
computed from stored rows: PR baselines, PR events, day totals, adherence
denominators, weight trend. The client keeps no cache of any of them. The
reasoning is in [DECISIONS.md](DECISIONS.md) "Derived values belong in the
database": a value with one writer cannot drift, and a second client (Gen 2)
gets it right for free.

### Server-side

`api/coach.js` is the only code that holds a secret. It runs as a Vercel Edge
function in the same AWS region as the database. It verifies the caller's JWT
against Supabase Auth, rejecting on any non-2xx (a garbage token and the
public anon key both return 403, not 401, so a 401-only check would admit
both). It records usage before calling Anthropic so a retry cannot be free,
and rebuilds the request body from validated parts so the client cannot
choose the model. [port/COACH.md](port/COACH.md) has the shape.

---

## 4. State flow

### Mount to first screen

1. `main.jsx` mounts `App` in StrictMode. StrictMode double-invokes effects
   and state updaters in development; two rules below exist because of that.
2. `App` starts at `authState = "loading"` and shows a spinner. Its mount
   effect registers `setAuthLostHandler` (so a refresh failure anywhere later
   routes to sign-in), then awaits `resolveSession()` before reading anything.
3. `resolveSession` reads `localStorage["sb_session"]`. No token: logged out.
   Token more than sixty seconds from expiry: valid. Otherwise exactly one
   `refreshSession`, coalesced through a module-level in-flight promise so a
   double mount cannot redeem the single-use refresh token twice.
4. Logged out, or any unexpected throw, routes to `AuthScreen`. Otherwise
   `loadUserData(uid)` runs.
5. `loadUserData` reads the profile with `selectAuth` and applies the routing
   rule: `authError` goes to sign-in, rows go to the app, a genuine 200 with
   zero rows goes to onboarding. **Onboarding is never a fallback** (§6,
   invariant 3). It then reads today's food log, custom foods, the supplement
   stack and today's supplement log together, the last twenty sessions plus
   the two PR views, today's water, the last thirty weights, and the workout
   plans. Each read goes through a local `read()` helper that records a
   failed section by name; the names drive a top banner with Retry. In
   parallel, `loadWeekHistory` reads the Mon-to-yesterday food, water and
   supplement rows for the Home rail, and any failure among the three makes
   the whole rail a failed state rather than an empty week.
6. `authState = "app"`. Home renders.

### A write, end to end

Every write handler has the same shape, and `addFoodItem` and
`saveWorkoutSession` are the reference copies:

1. Validate locally. Refuse if the write would be destructive against a state
   the app never loaded (water `+8` after a failed water read would replace
   the day; a capsule tap after a failed log read would flip a true row to
   false).
2. Update state optimistically with a local id.
3. Call `sb.insert` / `sb.upsert` / `sb.update` / `sb.delete` with the
   per-table `on_conflict` target where the table has a same-day unique
   constraint.
4. **Check the return value.** `null` or `false` means the write failed. Roll
   the state back and show the error banner. A `try/catch` here catches
   nothing (§6, invariant 1).
5. On success, replace the local id with the row's uuid via `withDbId`, so a
   later delete or update has a real filter. For sessions, re-read the PR
   views rather than bumping a local best.

### A coach turn, end to end

1. The panel's `send` appends the user bubble and calls `callClaude` with the
   **prior** turns only. Passing the new message in the history as well made
   every request carry it twice, and the model obediently logged twice.
2. `callCoach` builds the system prompt from `liveContext` (today's numbers,
   computed inline by `App` from current state) and the request messages via
   `buildRequestMessages`, which places the new turn exactly once and replays
   applied-action cards as short assistant lines so the model knows what has
   already been acted on.
3. `api/coach.js` verifies, counts, clamps, rebuilds, forwards, and returns
   the upstream status verbatim.
4. `parseActions` reads the `ACTIONS:` reply. Corrupt JSON fails closed;
   individual invalid actions fail open and are named in a trailing bubble.
5. `applyActions` commits water and food through the same App handlers a
   user tap would use, and renders meal suggestions, recipes, workout plans
   and supplements as proposals the user confirms.
6. A plain reply costs a second call for three suggestion chips. That is why a
   text turn costs two of the sixty hourly requests.

### A workout, end to end

`WorkoutTab` will not offer Start until `historyStatus` is ok: the PR baseline
is a view read, and starting against a baseline that failed to load would
stamp genuine PRs as false, permanently. `ActiveWorkout` then renders as a
fixed, opaque overlay above the tab bar. Every 500 ms of change it snapshots
the session to `localStorage` under `wifit_workout_<uid>`; the snapshot is
for reload and OS eviction, not tab switching (§7). Finish computes PRs once
from the final sets via `computePRs`, inserts the session with
`completed_date` derived from `startedAt`, writes the uuid back, clears the
snapshot, and re-reads the views. Cancel asks for confirmation only when sets
have been ticked, and is the only exit that destroys work.

### Sign-out

`handleSignOut` calls `sb.signOut`, then removes every `wifit_chat_*` and
`wifit_workout_*` key and resets all state. Four accounts exist and devices
are shared; the next person must not inherit the previous one's chat or
session.

---

## 5. Subsystem walkthroughs

### Auth and session — `src/lib/supabase.js`, `AuthScreen`, `OnboardingWizard`

Email/password through GoTrue, plus a demo mode that has no session and
therefore no uid. The session lives in `localStorage` and in `sb._session`;
`expires_at` is UNIX seconds. The two things that went wrong here were both
about time: a token that expired mid-session (a fitness app is open for over
an hour; tokens live one hour) silently lost every write after the hour, and
a 401 laundered into `[]` sent a returning user into onboarding. The first is
fixed by the `_fetch` retry with a token-comparison guard; the second by
`selectAuth` and the routing rule. Demo mode cannot exercise anything keyed on
uid, which includes the workout snapshot — verifying a restore needs a real
account.

`OnboardingWizard` computes goals via `computeGoals` and upserts the first
`profiles` row. It can leave a partial row if abandoned mid-way (§8). It once
wrote a stale theme literal, which is why theme keys now come from a constant
every reader also uses.

### Home — `src/HomeTab.jsx`

The design reference. Reads theme through `useTheme` and everything else
through props. Renders today's macros from `calc` and `totals`, the water
bottle, the supplement capsules, today's plan from `todayPlanFor`, and a
Mon-to-Sun rail from `summarizeWeek` and `streakFrom`. The rail is the one
place the client still derives a day total in JS instead of reading
`daily_summary`; it is provisional (§8). A failed week read shows
`FailedState` with Retry, never an empty week. Starter plans render as a
suggestion, not a schedule, so a new user does not see a workout they never
scheduled as due today.

### Food — `FoodTab`, `AddFoodModal`, `QuickAddPanel`, `BarcodeScanner`

Four meal slots per day, each a list of `food_log` rows with `per100_*`
macros and `grams`. Search merges four sources in a fixed order: the user's
custom foods, the curated local catalogue (ranked first so "chicken breast"
finds the 165 kcal entry), Open Food Facts through `api/off.js` for branded
and long-tail items, and USDA, which is gated off. The status ladder
(`searchStatus`) distinguishes ok, partial (a source failed but others
answered), none (every source answered and nothing matched) and failed; the
UI must never render a failed source as "no results". OFF returns unrelated
products for a query it cannot match, so `nameMatchesQuery` filters results
by name; barcode lookup is exempt because it is an exact-id fetch.

Custom foods are create-only. The form refuses to guess what a cup weighs and
asks for grams for food-dependent units; the coach path hardcodes cup to 240 g.
Two positions on one question, logged, not resolved (§8).

The unit bug worth knowing: the form once offered g/ml/oz/cup/tbsp/piece and
stored the raw number as grams, so "4 oz" logged as 4 g, a 28x macro error.
`cfGramsFor` and the USDA serving-unit reader (`usdaServingGrams`: grams pass,
ounces convert, everything else returns null and the UI says "1 serving =
100g") are the fixes.

### Train — `WorkoutTab`, `ActiveWorkout`, `CreateWorkoutModal`

Plans are `workout_plans` rows with an `exercises` jsonb array. Imported
trainer plans may omit client-side exercise ids, so `withPlanExerciseIDs`
assigns stable distinct ones at load and restore; two same-name exercises
must not share a React key or an expand/edit target. Sessions are
`workout_sessions` rows whose `exercises[]` carry both `sets` (display
strings like `10×80lbs`) and `setsData` (`{reps, weight}` numbers);
`normalizeExercises` guards the read boundary so the two always agree, and
`editSet` rewrites both from the same numbers.

PRs: the baseline is the `exercise_bests` view, PR events are the
`exercise_pr_events` view, and the only client PR logic is the live in-session
banner via `computePRs`, because the session is not saved yet and no view can
see it. `workout_sessions.prs` is no longer written; the column is dead until
a later migration drops it. Session edit (reps and weight on completed sets)
and delete exist; both re-read the views afterwards rather than filtering
locally, because a local filter of a twenty-row window leaves nineteen while
row twenty-one exists, and deleting the session that set a PR promotes a
later lift the user may not be looking at.

The elapsed clock derives from timestamps, not `setInterval` ticks.
Backgrounded tabs throttle timers and locked phones stop them; a tick-counted
45-minute session recorded a fraction of its length, failing toward
under-counting, which made a real session indistinguishable from a
click-through artifact.

### Supps — `SuppsTab`, `ReminderModal`, `SuppSearchPanel`

`supplement_stack` rows with a per-day `supplement_log` toggle. The log's
unique constraint is `(supplement_id, log_date)` with no `user_id`, so the
upsert names exactly that target; naming `user_id` returns a 42P10. A capsule
tap on a supplement still saving (local key, not yet a uuid) is refused with
"still saving". Drag-reorder writes `sort_order` per row, awaited and checked,
outside the state updater — it was once a fire-and-forget `sb.update` inside
`setSuppList(prev => ...)`, which StrictMode doubled to 2N un-awaited writes.

`category` is written by both the manual path (`toSuppCategory`) and the
coach path (`ACTION_VALID.supplement`) as a lowercase purpose enum, read
back, and used by nothing yet; the CHECK constraint is deferred (§7).

Reminders are `setTimeout` in the open tab. The UI now says exactly that: a
time label and an in-app nudge, no "push", no "alert", and the dead Settings
toggles are gone. `reminder_time` and `reminder_enabled` are the schedule Gen
2 registers with `UNUserNotificationCenter`; this is a launch feature, not a
port.

### Calendar and Progress — `CalendarTab`, `ProgressPage`

Both read `daily_summary` (plus `weight_monthly` for Progress) and keep only
a date spine. Both refuse to render numbers on a failed read. Progress's
range toggle applies to the day series; "Best weight change" is all-time and
"Workout PRs" is this month, and the cards say so. Calendar's per-day calorie
bucket is still a client derivation and is provisional (§8).

### Coach — `AISidePanel`, `RecipeCard`, `src/lib/coach.js`, `api/coach.js`

Text, voice (Web Speech), and photo (a base64 image block with a
`MULTI_FOOD:` instruction). The contract is [port/COACH.md](port/COACH.md).
What the walkthrough adds: the history of the intent parser. The client once
pre-empted the model with substring matching, so "ate" inside "water" logged
8 oz before the model was asked, and "protein" in the supplement word list
turned "I had 30 g of protein" into a whey product on the stack. All local
pre-emption was deleted. The model classifies, the client routes, and
multi-intent is handled by construction because the reply is a typed action
list. Six legacy prefixes are still parsed as a fallback with a
`console.warn`; retiring them (C2) is gated on that warning going quiet.

The transcript is persisted per uid under `wifit_chat_<uid>` and cleared on
sign-out. Error bubbles are excluded from replay: one replayed as the first
assistant turn makes Anthropic return 400.

### Profile, Settings, Personalization — `ProfilePage`, `SettingsPage`, `PersonalizationPage`

`ProfilePage` shows stats, activity level, goal rate and TDEE, logs weight,
and signs out. Its Save is disabled on a failed profile read, because a blank
form saved is data loss. TDEE math is `src/lib/bodyMetrics.js`, extracted
with a value-for-value test because it is the one formula whose output the
user lives by for months. `PersonalizationPage` picks a theme family and
palette; the choice persists as `profiles.theme` through `saveTheme` and
resolves through `resolveTheme`, which keeps a bare legacy `"dark"` as dark
rather than silently defaulting it. `HealthSyncSection` is a stub with an
honest label; the web has no health store.

### Trainer consent — `src/TrainerConsent.jsx`, `src/lib/trainerAPI.js`

A separate lazy-loaded root for `/trainer-consent`, using the existing `sb`
session to call the `trainerhq-api` edge function. WiFit's tabs do not call
that API. Accepted trainer assignments flow back into normal WiFit tables
through a nullable `trainer_assignment_id` on `workout_plans` and
`workout_sessions`; `assignmentOrigin` emits it only for a real uuid so a
local template id can never be sent. Everything else about TrainerHQ is out
of scope for WiFit and lives in [TRAINERHQ_INTEGRATION.md](TRAINERHQ_INTEGRATION.md).

---

## 6. Invariants, each with the bug that produced it

Each of these is a rule Gen 2 must keep. The bug is why. The long form of
every one is in [DECISIONS.md](DECISIONS.md); the test that pins it, where
one exists, is named.

1. **Check every write's return value.** Food logging and workout sessions
   had never written a single row when the audit began; the UI said "saved"
   over an insert that returned `null`. Reference shapes: `addFoodItem`,
   `saveWorkoutSession`. A `try/catch` around `sb` catches nothing, and a
   `catch` that cannot be reached is worse than none because it stops a
   reviewer reading. Gen 2: put failure in the type (`Result`, typed
   `throws`), and treat a discarded result as a compile-time decision.

2. **Name the `on_conflict` target per table.** `sb.upsert` sent
   merge-duplicates but PostgREST infers the conflict target from the primary
   key, so every same-day second write to water, weight and supplement log
   409'd. Only the first write of each day ever succeeded, which is why nobody
   noticed. Targets in [port/SCHEMA.md](port/SCHEMA.md).

3. **Onboarding is never a fallback.** `select` laundered a 401 into `[]`,
   which read as "new user", and the wizard overwrites a real profile.
   Routing: `authError` to sign-in, rows to app, a genuine 200 with zero rows
   to onboarding. Pinned in `sbFetch.test.js` and `session.test.js`.

4. **A failed read is not an empty read where the difference matters.**
   `exercise_bests` returning `[]` on a 500 looked like a new lifter and would
   have stamped a genuine PR as false, permanently. `selectAuth` returns `ok`
   for any non-2xx or network failure; readers of the views, the sessions and
   the week rail key on it and pause or show a failed state. `select`'s `[]`
   contract is untouched because sixteen callers depend on it; Gen 2 does not
   carry the swallow forward as the default read.

5. **Retry once on 401, never on 403, and compare tokens first.** Tokens
   expire mid-session; without the retry every write after the hour was lost.
   403 is RLS and refreshing cannot fix it. Sequential writes fail
   microseconds apart, so without comparing the sent token to the live one
   the second retry redeems an already-rotated refresh token and signs the
   user out mid-workout. `sbFetch.test.js`.

6. **Every `*_date` column stores the local day through `localDate`.**
   `toISOString().slice(0,10)` is the UTC day; everything logged after 5 pm
   Pacific stamped tomorrow, and every "today" view then failed to find it.
   Thirteen sites were fixed at once. `localDate.test.js` runs under a pinned
   time zone.

7. **`completed_date` derives from `startedAt`, not from `today`.** `today`
   is computed once per App mount, so a session resumed after a reload took
   whatever day the app last mounted on, and an 11 pm session finishing at
   12:30 am belongs to the day it was trained. Verified with a faked clock
   across midnight against the Postgres row. `sessionDate.test.js`.

8. **Derive at the commit boundary from final state through one function.**
   PRs were decided at set-tick time into an append-only list, so editing a
   weight after ticking left a stale entry that persisted. `computePRs` runs
   once at finish from the final sets, and the banner derives from the same
   function. `trainPRs.test.js`.

9. **Derived values are views; the client caches none of them.** `prHistory`
   was rebuilt from the last twenty sessions, so an older best was forgotten
   and a lower lift later was stamped a PR — reproduced against a seeded
   23-session history. A value with one writer cannot drift. Corollary: a
   derived source of truth has no window that ages out a bad row, so every
   write path into its source needs a correction path, which is why session
   edit and delete were required before launch.

10. **Decimal, not Double, for macro arithmetic.** JS doubles disagree with
    Postgres `numeric` on 21 of 3,996 exact-.5 products; `32.3 × 500 / 100` is
    161 in JS and 162 in `daily_summary`. A Double port reproduces the wrong
    side and the same day shows two totals depending on who computed it.
    `docs/port/rounding-fixture.json` is the day-one Swift test and
    `roundingFixture.test.js` proves the fixture still discriminates.

11. **The new user turn appears in the request exactly once.** Two identical
    food rows 6 ms apart were diagnosed as the model hedging; the request
    body showed the user's message twice. Read the request before blaming the
    reply. `buildRequestMessages`, `coachContext.test.js`.

12. **The production build must pass before every push.** `App.jsx` imported
    a function `lib/workouts.js` did not yet export. 201 tests were green and
    the push succeeded; the Vercel build failed and the site served the prior
    deployment. Vitest resolves the module graph differently than the
    production Rollup build, so no test could have caught it. The pre-push
    hook and PR-only `main` with the Vercel check required are the gates.

13. **Verify reachability before fixing reachability.** A tab-switch data-loss
    bug was diagnosed, fixed and committed, then found to be unreachable at
    any point in the project's history: `ActiveWorkout` is an opaque overlay
    above the tab bar. Reading the code says a bug is possible; only the
    running app says it is reachable. When you cannot reproduce, write down
    why not.

14. **A read must fail loud, and destructive writes must refuse against an
    unloaded state.** A failed `workout_plans` read once seeded the starter
    plans as if the user were new. Every mount read records its failure by
    name; water `+8`, capsule taps and plan edits refuse until the read
    succeeds; additive writes show a banner only.

15. **Local id to uuid write-back before any delete or update.** A food item
    deleted in the session it was logged in had no uuid, so the delete filter
    matched nothing and the row survived. `withDbId` and `hasDbId` gate every
    mutation. `foodLogIdentity.test.js`, `customFoodId.test.js`.

16. **A stored value never depends on its display format.** Sets were stored
    as `"10×80lbs"`, so any baseline had to regex a render string. `setsData`
    carries the numbers; `sets` is derived from them. `normalizeSession.test.js`.

17. **Write vocabularies through a constant, never a literal.** The wizard
    upserted `theme: "dark"`, three schema changes stale, and no structural
    check catches a stale literal. `DEFAULT_THEME_KEY` is what every reader
    also uses; Gen 2 makes this an enum with a raw value.

18. **A toggle is a promise; a promise with no keeper is removed.** Reminder
    toggles wired to `() => {}` and Settings copy promising push
    notifications asserted a capability the platform does not have. The UI
    now says what the code does.

19. **Refresh once per mount, coalesced.** StrictMode double-mounts; the
    refresh token is single-use and rotates. Two concurrent refreshes fail
    the second with an already-consumed token. `refreshSession` shares one
    in-flight promise. `session.test.js`.

20. **No `useState` inside a render-time `.map`.** `RecipeCard` once called a
    hook inside a `.map` callback, so the hook count varied with message
    count and the whole app blank-screened. `rules-of-hooks` is an error.

---

## 7. Deliberate exceptions that look like bugs

Do not "fix" these. Each is a decision with a reason in
[DECISIONS.md](DECISIONS.md) or [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md).

- **String concatenation instead of template literals** throughout `App.jsx`.
  Intentional legacy.
- **`App.jsx` is one ~5,900-line file.** The UI is being replaced; splitting
  components about to be rewritten is wasted work. The logic was extracted to
  `src/lib/` instead, which is what the port needs. Decomposition is its own
  deliberate task, never a side effect.
- **`sb.select` swallows every non-2xx into `[]`.** Sixteen callers depend on
  it, several inside `Promise.all` batches. `selectAuth` is the sibling for
  callers that must tell failed from empty. Change the callers, not the
  wrapper.
- **`react-hooks/exhaustive-deps` is off.** Seven advisory warnings and no
  correctness gain today; `rules-of-hooks` is on as an error, which is the
  one that catches real crashes.
- **Twenty-two `no-unused-vars` warnings, zero errors.** Not all noise; twice
  a warning here pointed at a real dead feature (`SUPP_CATS`, `GoalDots`).
  Triaged slowly on purpose, and the count is tracked in `AGENTS.md`.
- **The CHECK constraint on `supplement_stack.category` is not applied.**
  The legacy `ADD_SUPP` coach path does not validate the enum, so the
  constraint today would turn a model's out-of-enum reply into "check your
  connection". Apply it as the first commit after the legacy parsers retire.
- **The workout snapshot in `localStorage` stays**, but for reload and OS
  eviction, not tab switching. iOS Add-to-Home-Screen reloads a backgrounded
  standalone web app on return, and there is no service worker. Gen 2 ports
  the behaviour (a session survives backgrounding), not the mechanism.
- **The nav dot for a live session and the resumed-session banner both
  exist.** They answer different questions: "there is a session, come back"
  from Home, and "these sets were carried over, not invented" inside the
  session. After a reload the workout view is not mounted, so only the dot
  can advertise it.
- **USDA search is off (`USDA_ENABLED = false`)**, with the proxy, the key
  contract and the failed-search UI kept. The branded dataset's relevance was
  not worth the dependency. Flip the flag to re-enable.
- **`workout_sessions.prs` is still a column.** No longer written, not yet
  dropped. Stop the write, prove nothing reads it, drop at leisure.
- **Session edit is reps and weight on completed sets only.** Exercise name
  and date are the views' group and ordering keys; set count is a stored
  column. All three are a second surface, not the correction path the view
  required.
- **Last-writer-wins on session edit.** A partial jsonb update needs an RPC;
  the editor re-reads the row when it opens, and the window is the seconds it
  is open. Accepted for a single user with two windows.
- **Same food logged twice is two rows.** No merge, by design.
- **`sort_order: 0` on every coach-created plan.** Nothing orders by it yet.
  Logged, not changed.
- **Every stored plan exercise set carries `done: false`.** A runtime flag
  nothing reads; not worth a migration.
- **The local `/api` proxy targets production.** Local coach calls count
  against the user's real 60/hour limit. Convenient and documented; check
  `ai_coach_usage` before debugging a coach that "stopped working".
- **`MODEL` in `api/coach.js` is a pinned snapshot, not an evergreen
  pointer.** A retired model surfaces as a 404 that looks like a missing
  deployment. It is the first thing to check when the coach breaks, and the
  client must never be allowed to choose it.

---

## 8. Honest gaps

What Gen 1 knows it gets wrong or leaves undone. Numbered items refer to
[PROJECT_CONTEXT.md](PROJECT_CONTEXT.md) §Known issues; the port triage is
[port/KNOWN_ISSUES.md](port/KNOWN_ISSUES.md).

**Still provisional on the JS side (do not port these derivations):**

- The Home week rail (`reduceWeekRows`), Calendar's per-day calorie bucket,
  and `calc` / `totals` for today's meals all derive day totals in JS with
  doubles. `daily_summary` is the definition. Gen 2 reads the view for any
  day total and computes nothing the view already does.

**Known and deliberately unfixed:**

- `today` and the week history are computed once per App mount (#8). An app
  left open across midnight keeps writing yesterday's date and shows the new
  "yesterday" as unknown until reload.
- The coach hardcodes cup to 240 g while the custom-food form refuses to
  guess (#3). Two positions on what a cup weighs.
- Custom foods have no edit or delete UI (#5). A bad row is removed in the
  database.
- Onboarding can leave a partial `profiles` row with `theme` set and `name`
  null (#16). Nothing requires `name` at the database.
- `supplement_stack.category` is written and never read (#13).
- Restaurant and menu foods have no structured source (#22). OFF is packaged
  goods; a restaurant meal is a custom food or a coach estimate.
- `ai_coach_usage` has no retention (#7). One row per request; add a nightly
  prune when the table nears a million rows.
- Two cosmetic Food defects die with the React client (#20): the Create-food
  view carries the previous search's banner, and the nutrition preview is
  near-invisible on light palettes.
- `T.accent` is used as text in legacy screens where the mode-locked
  palettes meant it for fills; a contrast pass over Settings is pending (#15).
- There is no pending-sync queue. Offline, a logged item rolls back within a
  second and the user is told. The write is lost, honestly.

**Platform gaps the rewrite exists to close:**

- Real reminders via `UNUserNotificationCenter` (#26), HealthKit both
  directions, Apple Watch, WidgetKit. None of these has a web implementation
  and none should be imitated from one.

**Pre-launch blockers that are not code to port:**

- The App Store privacy label must disclose consented trainer data-sharing
  (#31). Account deletion must handle an active trainer relationship (#32),
  and account deletion itself must exist.

**What browser verification cannot cover:**

- Anything keyed on uid in demo mode: the snapshot, the restore, the resumed
  banner. Barcode without a camera. USDA-to-log without the key on Vercel. A
  cross-midnight session outside 00:00 to 06:00 local without a faked clock.

**Data state to know about:**

- Four accounts exist. The owner's real logging history is short and the
  early sessions were deleted as click-through artifacts so the PR baseline
  would not be seeded with template weights. Do not trust a per-user report
  without checking the partial profile row first.

---

## 9. How Gen 1 was verified, because Gen 2 should be verified the same way

- **The UI lies; the table is the truth.** A green screen after a write is
  not evidence. Read the row back, or the console line `[sb.<method>]`.
- **Ask what a broken implementation would also pass.** "Reload and the sets
  are still there" is passed by a workout that never unmounted. The
  discriminator was to mutate the snapshot on disk after the app wrote it,
  then reload: a value that only ever existed on disk proves the restore ran.
- **Test the test.** Remove the export, confirm the hook refuses the push.
  Backdate the snapshot, confirm the key is removed, not merely ignored.
- **Read the request before blaming the model.** Both duplicate-action bugs
  were the client.
- **Screenshots are evidence of no behaviour change.** A byte-compare of all
  six tabs at 390×844 before and after each refactor commit, with a known
  tolerance for GPU gradient noise (≤4 channel levels; a real change is
  50–255).
- **Check reachability in the running app before fixing it in the code.**
