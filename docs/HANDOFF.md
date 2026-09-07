# WiFit — Handoff (Pt.4 → Pt.5)

**Paste the START HERE PROMPT at the bottom into a new chat and attach this file. Everything above it is reference.**

---

## THE END GOAL

WiFit becomes a **native iOS app in SwiftUI**. Not a preference — four required features are impossible on web:

| Feature | Web status |
|---|---|
| **HealthKit** read/write (steps, heart rate, workouts, both directions) | No WebKit API exists. Absent, not degraded. |
| **Apple Watch** | Requires a watchOS target. No web path. |
| **WidgetKit** home screen widgets | Native-only; shares data via App Groups. |
| **Reliable background notifications** | iOS Web Push exists (16.4+, home-screen only) but is unreliable enough to apologize for. |

Only offline-first is achievable on web, and it's hard there.

**Johnny already knows SwiftUI and HealthKit.** This is translation, not learning. Don't pad explanations of Swift basics.

**Two goals run together:** the native rewrite AND a **layout redesign** (not a re-skin — screens, hierarchy, and possibly navigation all change). Design spec comes first so each view is built once in the target design.

---

## HOW JOHNNY WORKS

Two-tool flow: **this chat** = planning, architecture, review, debugging diagnosis. **Claude Code** (Mac terminal) = writing/committing code.

Operate as a **senior technical lead**: direct, willing to push back, sequence work correctly, flag risks he isn't seeing, and never say something works without giving him a way to verify it. Explain the "why."

### Verification discipline — this is the thing that made the last session work

1. **The UI lies.** Ground truth is the database. Query it.
2. **A clean build proves compilation, not behavior.**
3. **Ask: "what would a broken implementation also pass?"** This changed three tests in one session and caught a fix shipped for a bug that couldn't occur.
4. **Test the test.** Break the thing deliberately; confirm the test catches it.
5. **Prompts to Claude Code force: investigate → report → sign-off → edit.** Never straight to editing.
6. **Reference code by function name, not line number.** ~70 commits have moved every line.

---

## CURRENT STATE (web app — the reference implementation)

- Repo `github.com/John-bess4/WiFIt`, local `~/Documents/wifit`, live `wifit.vercel.app`
- Supabase project `vghqqksbjpgdzmvfmnru`, user_id `50bc7457-c7be-46a2-bacd-c467283a11e6`
- `src/App.jsx` ~7,100-line monolith · 69 Vitest tests · ESLint 25 warnings / 0 errors
- **Vercel deploys on PUSH, not commit.** 16 commits once sat unpushed for six weeks.
- In-repo docs: `AGENTS.md`, `CLAUDE.md`, `docs/PROJECT_CONTEXT.md`, `docs/DECISIONS.md` — all tracked

### Live schema (verified, authoritative — trust this over any prose)

```
body_weight_log   id, user_id, weight_lbs NOT NULL, log_date NOT NULL, note, created_at
                  UNIQUE(user_id, log_date)
coach_usage       id, user_id, created_at NOT NULL
                  RLS: INSERT+SELECT own only, NO UPDATE, NO DELETE
                  INDEX (user_id, created_at DESC)
custom_foods      id, user_id, name NOT NULL, brand, serving_g, per100_cal/protein/
                  carbs/fat/fiber/sugar/sodium, created_at, serving_qty, serving_unit
food_log          id, user_id, logged_date NOT NULL, meal_slot NOT NULL,
                  food_name NOT NULL, brand, grams NOT NULL, per100_cal/protein/
                  carbs/fat/fiber/sodium, color, created_at, per100_sugar
profiles          id, name, age, weight_lbs, height_in, activity_level, goal,
                  cal_goal, protein_goal, carbs_goal, fat_goal, theme, created_at,
                  updated_at, gender, bmr, tdee, goal_rate (TEXT — "lose_2")
supplement_log    id, user_id, supplement_id NOT NULL, log_date NOT NULL, taken, created_at
                  UNIQUE(supplement_id, log_date)  ← note: omits user_id
supplement_stack  id, user_id, name NOT NULL, sub, dot_color, reminder_time,
                  reminder_enabled, sort_order, created_at, category, note
water_log         id, user_id, log_date NOT NULL, cups (DEAD), created_at, oz NOT NULL
                  UNIQUE(user_id, log_date)
workout_plans     id, user_id, name NOT NULL, tag, level, est_min, scheduled_day,
                  exercises jsonb NOT NULL, sort_order, created_at
workout_sessions  id, user_id, workout_name NOT NULL, completed_date NOT NULL,
                  duration_secs, sets_completed, total_sets, exercises jsonb,
                  created_at, prs jsonb NOT NULL
workouts          LEGACY — 0 rows, app never touches it
```

Every table has RLS with `auth.uid() = user_id`.

### What survives the rewrite untouched

**All server-side work is language-agnostic:**
- The entire schema, all RLS policies, all migrations
- `/api/coach` Edge Function: JWT verified via `/auth/v1/user` **rejecting on `!r.ok`** (a bad token returns **403**, not 401 — a 401-only check passes every garbage token), model pinned server-side, `max_tokens` clamped (1200/600/120), `thinking:{type:"disabled"}`, rate limit **60/hour + 400/day** counted on entry in `coach_usage`
- The `ACTIONS:` contract and system prompt
- **Calibration: exactly 2 coach calls per user turn** (`callClaude` + `generateSuggestions`)

`supabase-swift` speaks to the same Postgres and Auth. The Swift client hits identical endpoints.

---

## THE BUG ARCHIVE — carry this into Swift

Every one of these was **silent**: wrong data or no data, no error shown. Food logging and workout sessions had **never written a single row** when the session began.

### Data layer (~20 fixed)
`prs` column missing → every session insert 400'd · FoodTab `onAddItem` passed but never destructured (Food tab never made a network call) · ProgressPage read `*_per_100g`, real columns are `per100_*` · `uid` ReferenceError in delete handler · `grams: undefined` dropped by JSON.stringify → NOT NULL violation · unit selector offered g/ml/oz/cup/tbsp/piece but stored the raw number as grams (28× macro error on "4 oz") · pre-filled `100` + typing `100` = `100100` (DOM concat, not code) · `weight_log` → `body_weight_log` AND `lbs` → `weight_lbs` · `water_log.oz` (app sent `oz`, table had `cups`) · four missing `profiles` columns · `per100_sugar` collected, computed, then dropped by both inserts and both read mappers · ADD_SUPP `category` one-way-hashed into a hex color, `note` never persisted

### The `on_conflict` class — same-day writes had NEVER worked
`sb.upsert` sent `Prefer: resolution=merge-duplicates` but PostgREST infers the conflict target from the **primary key** unless told otherwise. With no `id` in the payload it fell through to a plain INSERT and collided with the unique constraint. Water, weight, and supplement same-day second writes all 409'd. **Only the first write of each day ever succeeded**, which is why nobody noticed. Fixed with an explicit `on_conflict` parameter per call site — and the constraint columns differ per table (`supplement_log` is `(supplement_id, log_date)`, not `(user_id, log_date)`).

### Auth
- `sb.select` laundered 401s into `[]` → empty profile read as "new user" → **onboarding wizard, which overwrites a real profile**
- Fixed with sibling `sb.selectAuth` returning `{authError, rows}` — `sb.select` untouched because 15 of its 16 callers depend on the `[]` contract
- **Mid-session token death**: `resolveSession` refreshed on mount only. Tokens live one hour; a fitness app is open for an hour+. Users silently lost everything after the hour.
- Fixed via a single `_fetch` chokepoint retrying once on 401 (never 403 — that's RLS, refreshing can't fix it), with a **token-comparison guard**: sequential writes fail microseconds apart, and without comparing the sent token against the live session, the second redeems a rotated refresh token and signs the user out mid-workout.

### Crashes
`themeFam` (async profile-save) · `section` (**Settings crashed on every open**) · **RECIPE had never worked** — `useState` inside a `.map()` callback made hook count vary with message count, blank-screening the entire app. `rules-of-hooks` was installed but never enabled.

### Time
`toISOString().split("T")[0]` returns the **UTC** date — everything logged after 5pm PDT stamped tomorrow. Fixed with a `localDate()` helper across 13 sites.
`setInterval` counts **ticks, not time**. Backgrounded tabs throttle; locked phones stop timers entirely. A 45-minute session could record a fraction of its length — and fails toward *under*-counting, making a real session indistinguishable from a click-through artifact. Fixed with timestamp-derived elapsed. The stored value now reads the clock at tap time, not from React state.

### The intent parser
`"ate"` is a substring of `"water"` — asking *"how much water should I drink"* **logged 8 oz** before the model was consulted. `"protein"` in the supplement word list meant *"I had 30g of protein"* added a whey product to the stack and never logged the food. Local pre-emption deleted entirely; the model classifies, the client routes. Replaced with a single `ACTIONS:` typed action list supporting multi-intent by construction. **Verified against a live model, not stubs.**

### Two classes worth their own entries
- **Fire-and-forget async** — `sb.update(...)` with no `await`, inside a `setState` updater. StrictMode double-invokes updaters, so N supplements fire **2N** un-awaited writes per reorder. Not "ignores the return value" — *doesn't wait to learn there was one.*
- **`try{await sb.delete(…)}catch{}` around a function that never throws** — reads as handled, structurally unreachable. **Worse than no handling**, because omissions get found by grep and false assurances don't; nobody greps for what already looks handled.

### Stored derived values (Train audit, 2026-09-07)
`workout_sessions.prs` is the only computed-and-stored value in the app and every way it could be wrong, was — decided at tick time from an append-only list, `parseInt` truncating 27.5, a history rebuilt from the last 20 sessions, and a failed read laundered into "no history". Nothing recomputes it. For Swift: compute at commit time from final state, from a **complete** per-exercise max (server-side), and never let a missing history read as an empty one. And: sessions carry a local id with no uuid write-back — harmless while there is no session edit/delete, and the Food delete bug the moment there is.

### Claimed capabilities (Supps audit, 2026-09-07)
Reminders were `setTimeout` in the open tab, labelled "daily push notification". A toggle wired to `()=>{}` is the purest lie: it exists only to be believed. The web UI now says what it does; `supplement_stack.reminder_time` / `reminder_enabled` is the schedule the iOS app registers with `UNUserNotificationCenter` — required pre-launch (#26). Also from that audit: every mount read fails loud (#27), and the conflict target for `supplement_log` is `(supplement_id, log_date)` — no `user_id`.

### Decimal, not Double (Progress audit, 2026-09-07) — HARD REQUIREMENT
All macro arithmetic in the Swift client must use Decimal, not Double. JS doubles disagree with Postgres numeric on exact-.5 products (21 of 3,996 tested; 32.3 × 500 / 100 → 161 in JS, 162 in the view). A Double port reproduces the JS answer and disagrees with daily_summary, so the same day shows different totals depending on which side computed it.

The JS side is the wrong one and stays wrong until the client reads daily_summary everywhere. Still provisional (do NOT port these):
- Home week rail — `src/lib/weekSummary.js` `reduceWeekRows`
- Calendar month — `CalendarTab`'s per-day cal bucket
- `calc()` / `totals()` — today's meals on Home and Food

The definition is `daily_summary` (`20260907_daily_summary_views.sql`); the Swift
client reads it for any day total and computes nothing that the view already does.

### The reachability lesson
A tab-switch data-loss bug was diagnosed, approved, fixed, and committed — then found to be **unreachable at any point in the project's history**. `ActiveWorkout` renders `position:fixed, zIndex:190` with an opaque background over a nav at `zIndex:99`. The nav was never clickable during a workout. The check was one tap in the running app; nobody ran it.

**A code pattern that permits a bug is not the same as a bug a user can reach.**

(The snapshot work was kept — justified by *reload and OS eviction*, which matter more than expected because there's no service worker and iOS Add-to-Home-Screen reloads on return.)

---

## THE VERIFICATION TECHNIQUE WORTH KEEPING

The reload-restore tests are the model. Naive test: "reload, sets still there." **A workout that never unmounted passes identically.**

Discriminator used instead: **mutate the snapshot on disk after the app writes it, then reload.** React held `185`; disk held `999`. Restored UI showed `999` — a value that only ever existed on disk. In-memory state cannot produce it.

Negative cases are what actually prove things:
- stale snapshot → key must be **removed** (proves the staleness branch ran, not just that nothing restored)
- foreign uid → sentinel never renders, foreign key byte-identical
- "Keep going" must **not** clear (catches a dialog wired to clear on open)
- midnight: fake clock at 23:50 → work → 00:20 → reload → finish. Verified in Postgres: `completed_date 2026-09-06` against `created_at 2026-09-07 03:35Z`

---

## KNOWN ISSUES — deliberately not fixed (they disappear in the rewrite)

OFF search CORS-blocked (USDA works) · **10 unchecked `sb.*` return values** — documented as a requirement spec for Swift, every one is a place the new client must not ignore a result · AI parser invents cup→240g while the custom-food form refuses to guess · USDA `servingSizeUnit` decided: grams pass, oz converts at 28.3495, ml/IU return null (needs a density) · no edit/delete UI for custom foods · `coach_usage` retention (pg_cron prune at ~1M rows) · dead columns `water_log.cups`, `body_weight_log.note`, `profiles.goal` · deferred CHECK constraint on `supplement_stack.category` (legacy ADD_SUPP path doesn't validate until C2) · `exhaustive-deps` off (7 advisory warnings) · C2 (retire six legacy parsers) gated on the legacy-format `console.warn` going quiet

---

## THE PLAN

1. **Design spec** (Claude Design) — tokens, screen layouts, navigation, states. **Spec, not code.** Nothing implemented in React.
2. **Migration package** — data-model + API contract doc, screen-to-data mapping (needs the design)
3. **SwiftUI Phase 1** — auth + one data path end to end, built in the new design from the first screen

### Design brief must cover
- **Tokens**: background, surface, surfaceElevated, border, textPrimary, textSecondary, accent — plus **four category colors** (Food blue, Workout pink, Supplements green, Progress amber — these are navigation cues, not decoration). Radii, spacing, type scale. Light and dark. **Flag which tokens stay legible at widget scale** — widgets and watch should share the visual language.
- **Screens**: Home, Food, Workout (browse + active session), Supplements, Progress. Information hierarchy, what's above the fold, most common action.
- **Navigation**: currently 5 tabs + center Quick Add — *inherited from the web app, not chosen.* Decide deliberately for iOS.
- **The states that actually happen**: empty (new user — this is the first screen anyone sees), loading, error, mid-workout. The current full-screen workout takeover was an accident of z-index; decide it on purpose.
- **Constraint**: dense content needs opaque surfaces. Translucency over a gradient hurts legibility and Apple reviews contrast. One-handed, in a gym, sometimes sweaty hands — tap targets and reachability over density.

### Preserving functionality — the explicit ask
Johnny wants **extreme caution that the majority of functions stay intact**. Concretely: every feature that currently works must have a named home in the new design *before* SwiftUI begins. Food logging (USDA + custom + barcode), water, supplements (stack, reminders, daily toggle, drag-reorder), workout plans + active session + PR detection, weight logging, Progress analytics, Calendar, the AI Coach and all six `ACTIONS:` types, onboarding, themes, settings. **If a feature has no home in the new layout, that's a decision to surface — not something to discover missing after the rewrite.**

---

## START HERE PROMPT

```
Picking up WiFit. Read the attached handoff first — it has the full bug archive,
the live schema, the verification discipline, and the migration plan.

THE GOAL: WiFit becomes a native iOS SwiftUI app. HealthKit (both directions),
Apple Watch, WidgetKit, and reliable background notifications are all impossible
on web, so this is a requirement, not a preference. I already know SwiftUI and
HealthKit — this is translation, not learning, so don't pad explanations of
Swift basics. Alongside the rewrite I'm doing a full LAYOUT redesign, not a
re-skin.

Operate as a senior technical lead and architect — sharp, direct, willing to
push back. Don't rubber-stamp my ideas, flag risks I'm not seeing, sequence
work correctly, and never tell me something works without a way to verify it.

Two-tool flow: this chat = planning, architecture, review, debugging. Claude
Code (my terminal) = writing/committing code.

VERIFICATION DISCIPLINE (this is what made the last session work):
- The UI lies. Ground truth is the Supabase database (project
  vghqqksbjpgdzmvfmnru, user_id 50bc7457-c7be-46a2-bacd-c467283a11e6). You have
  a Supabase MCP connection — use it read-only to verify claims rather than
  trusting reports.
- Always ask "what would a broken implementation also pass?" That question
  caught a fix I shipped for a bug that turned out to be unreachable.
- Test the test: break it deliberately, confirm it catches the break.
- Prompts to Claude Code force investigate → report → sign-off → edit.

WHERE I AM: the web app is finished as a reference implementation — every write
path verified against the DB, auth closed including mid-session token expiry,
the coach secured and rate-limited, 69 tests, and docs/DECISIONS.md capturing
the bug classes so the rewrite inherits them instead of rediscovering them.

IMMEDIATE NEXT STEP: write me the design brief for Claude Design — a
specification, not code. Tokens (including which stay legible at widget and
watch scale), screen layouts, navigation decided deliberately for iOS rather
than inherited from the web tab bar, and the states that actually happen:
empty, loading, error, mid-workout.

THE THING I CARE MOST ABOUT: every feature that works today must have a named
home in the new design BEFORE any SwiftUI is written. If something has no home,
I want that surfaced as a decision, not discovered as a gap after the rewrite.
Build that inventory as part of the brief.

Ask me anything you need before writing it.
```
