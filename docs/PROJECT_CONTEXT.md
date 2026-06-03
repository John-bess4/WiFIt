# WiFit — Project Context Handoff

This document is the bridge between the Claude artifact-chat development sessions and Claude Code on your local repo. Paste relevant sections into Claude Code or keep this file as `docs/PROJECT_CONTEXT.md` in the repo so future sessions can read it.

---

## What WiFit is

A personal fitness tracking React app with food logging, workout tracking, supplement adherence, an AI Coach side panel (Claude API), and progress analytics. Single-page React app deployed on Vercel, backed by Supabase for auth + persistence.

## Stack

| Layer | Tech |
|---|---|
| Frontend | React (functional components + hooks), single-file build, vanilla CSS-in-JS via inline styles + theme context, SVG icons |
| Backend | Supabase (Postgres + Auth + REST) at `https://vghqqksbjpgdzmvfmnru.supabase.co` |
| AI | Anthropic Claude API (`claude-sonnet-4-20250514`), called directly from client |
| External APIs | USDA FoodData Central (food search), Open Food Facts (barcode lookup) |
| Hosting | Vercel |
| Repo | GitHub (existing, name unknown to me) |

## Single source of truth

The current working file is `fitness_app.jsx` (~6,340 lines). Until the refactor it contains **every component, helper, and constant** in one module. You'll find it at the project root or wherever you map it on import.

## Top-level components (in order they appear in the file)

1. **Theme system** — `ThemeCtx`, `useTheme`, `THEMES`, `THEME_FAMILIES`, `GLOBAL_CSS`
2. **Utility functions** — `fmtDate`, `searchUSDA`, `searchOpenFoodFacts`, `barcodeLookup`, `searchLocalSupp`, `parseIntent`
3. **Supabase client** — `sb` (custom thin fetch wrapper, not @supabase/supabase-js — it exposes `select`, `upsert`, `delete`, `update`, `getUser`, etc.)
4. **WeightLogWidget** — body weight quick logger
5. **AISidePanel** — the AI Coach, 11 features (see below)
6. **SuppSearchPanel** — supplement library search
7. **HomeTab** — dashboard with calorie ring, macro bars, WeekStrip, shortcut cards, today's meals
8. **WeekStrip** — Mon–Sun activity strip at top of Home
9. **QuickAddPanel** — center-tab modal with macro-aware food/supp/water add flows
10. **FoodTab** — meal-by-meal log with search, edit, delete
11. **WorkoutTab** + **ActiveWorkout** — plan builder + live session tracker with PR detection
12. **SuppsTab** — supplement stack with drag-to-reorder, reminders
13. **CalendarTab** — month-grid view, only reachable from WeekStrip
14. **ProgressPage** — 7d/30d/90d analytics: weight chart, calorie bars, training grid, monthly highlights, PRs (newest, replaced old Calendar shortcut card)
15. **OnboardingWizard** — 5-step setup (Name/Gender/Age → Height/Weight → Activity → Goal rate → Summary), uses Revised Harris-Benedict
16. **SettingsPage** — Account / Notifications / Appearance / Units & data / Privacy / Advanced
17. **ProfilePage** — body stats editor, live TDEE recalc, shared `GoalRatePicker`
18. **HealthSyncSection** — `navigator.health` integration (Android), graceful fallback
19. **PersonalizationPage** — theme family + light/dark picker
20. **Auth screens** — sign-in / sign-up
21. **App** — root component, state hub, tab router

## AI Coach features (11 + 1)

| # | Feature | Format |
|---|---|---|
| 1 | Context-aware responses | `buildContextBlock()` injects live cal/macros/water/workout/supps/weightLog/suppStack into every system prompt |
| 2 | Meal suggestions | `MEAL_SUGGESTION:[...]\|msg` → card with "Log this meal" |
| 3 | Weekly check-in | Monday-only, gated by `wifit_checkin_<year>_<month>_w<week>` localStorage key |
| 4 | Voice input | `SpeechRecognition` API, mic button toggles red |
| 5 | Weight progress | `WeightLogWidget`, `weight_log` table, AI sees last 7 entries |
| 6 | Recipe mode | `RECIPE:{...}\|msg` with ingredients + steps + "Log all ingredients" |
| 7 | Persistent chat | `localStorage` key `wifit_chat_{userId}`, last 30 messages, cleared on sign-out |
| 8 | Suggested replies | Secondary Claude call generates 3 chips after plain-text bot responses |
| 9 | Photo logging | Camera → base64 → Claude vision → `MULTI_FOOD:` |
| 10 | Health sync | `HealthSyncSection` in Settings → Units & data |
| 11 | Supplement reorder | Drag-to-reorder rows, `sort_order` column |
| ★ | **ADD_SUPP** (latest) | `ADD_SUPP:[...]\|msg` — Claude adds supplements directly, with `name`, `dose`, `timing`, `category`, `note` |

### AI response formats (all use string concatenation, NOT template literals — see Known Issues)

- `MULTI_FOOD:[...]\|msg` — food logging (single or multi)
- `MEAL_SUGGESTION:[...]\|msg` — macro-aware suggestions
- `WATER_LOG:{"oz":N}\|msg` — water
- `RECIPE:{...}\|msg` — full recipe
- `WORKOUT_PLAN:{...}\|msg` — workout (≥4 exercises required)
- `ADD_SUPP:[...]\|msg` — supplement add/recommend

## Supabase schema (inferred from code — verify against your actual DB)

| Table | Key columns |
|---|---|
| `profiles` | `id` (FK auth.users), `name`, `gender`, `age`, `weight_lbs`, `height_in`, `activity_level`, `goal_rate`, `cal_goal`, `protein_goal`, `carbs_goal`, `fat_goal`, `theme`, `bmr`, `tdee`, `updated_at` |
| `food_log` | `id`, `user_id`, `logged_date`, `slot` (breakfast/lunch/dinner/snacks), `name`, `grams`, `cal_per_100g`, `protein_per_100g`, `carbs_per_100g`, `fat_per_100g` |
| `custom_foods` | `id`, `user_id`, `name`, per-100g macros |
| `supplement_stack` | `id`, `user_id`, `name`, `sub`, `dot`, `category`, `note`, `reminder_time`, `sort_order` |
| `supplement_log` | `id`, `user_id`, `log_date`, `supplement_id`, `taken` (bool) |
| `workout_sessions` | `id`, `user_id`, `completed_date`, `workout_name`, `exercises` (jsonb), `prs` (jsonb), `duration_min` |
| `weight_log` | `id`, `user_id`, `log_date`, `lbs` |

## Theme system

Two families: **Aurora** (default) and your two main themes:
- **Midnight Purple** (dark) — `aurora_dark`
- **Clean Slate** (light) — `aurora_light`

Theme is persisted to `profiles.theme` as `"<family>_<dark|light>"`. Auto-saves on every change via `saveTheme()`.

## Key constants

- `GOAL_OZ = 128` (water goal)
- `GOAL_RATES` — 7 options: lose 2/1/0.5, maintain, gain 0.5/1/2 lbs/wk
- `ACTIVITY` — 7 levels matching calculator.net
- `INITIAL_SUPPS` — sample supps shown only in demo mode (NOT for real users)
- `MEAL_SLOTS = ["breakfast","lunch","dinner","snacks"]`

## Known issues / gotchas

### 1. Template literals were nuked across the entire file
The Claude artifact viewer's Babel parser chokes on certain nested template literal patterns. To work around this, **every template literal outside of two specific blocks has been replaced with string concatenation**. The two surviving template literals are:

- `GLOBAL_CSS` (lines ~146–155) — plain CSS, no `${}` expressions
- `buildSystem` (lines ~659–731) — system prompt for AI Coach, uses `${buildContextBlock()}` interpolation

**In Claude Code (real build environment) this is a non-issue.** Feel free to restore template literals during refactor — they're cleaner. The string-concatenation style is a chat-artifact artifact, not a stylistic choice.

### 2. Custom Supabase client (`sb`)
We rolled our own thin REST wrapper instead of `@supabase/supabase-js`. Methods: `getUser`, `signIn`, `signUp`, `signOut`, `select`, `upsert`, `update`, `delete`. Auth uses access tokens from password sign-in. If you want to switch to the official client, the API surface is similar but not identical.

### 3. Direct Anthropic API calls from client
The AI Coach calls Anthropic directly using `fetch("https://api.anthropic.com/v1/messages", ...)` with no API key in the request — relies on the artifact viewer's proxy. **This will not work in production.** Move to a serverless function (Vercel Edge Function or API route) before launch.

### 4. Single-file architecture
6,340 lines in one file. The first refactor task should be splitting into `src/components/`, `src/lib/`, `src/hooks/`. See "First Claude Code prompt" below.

### 5. Hardcoded sample data
`INITIAL_SUPPS` ships with demo supplements. Make sure real users get empty arrays (already handled in sign-out reset).

## What's already been built and tested

- ✅ Full auth flow (sign-in, sign-up, sign-out with data reset)
- ✅ Onboarding wizard with Revised Harris-Benedict TDEE
- ✅ Food logging (USDA + custom + barcode)
- ✅ Supplement stack with reminders + drag reorder
- ✅ Workout tracker with PR detection
- ✅ AI Coach with all 11 features + ADD_SUPP
- ✅ Calendar grid view (accessed via WeekStrip)
- ✅ Progress page (7d/30d/90d, weight chart, calorie bars, training grid, monthly highlights, PRs)
- ✅ Theme system with auto-save
- ✅ Settings + Profile + Personalization pages

## What's NOT done

- ❌ Anthropic API key moved to server side (security) — **FIXED: 71e0741**
- ❌ Component file splitting (still monolithic)
- ❌ Real test coverage (zero tests)
- ❌ Mobile-specific PWA manifest / install prompt polish
- ❌ Notification scheduling for supplements (uses Web Notifications, browser-only, not reliable on iOS)
- ❌ Data export (CSV/PDF) — mentioned in Settings "Pro" plan but not implemented
- ❌ Body composition tracking — same

---

## Session Log — 2026-06-02

### 8 commits shipped to production today

| Commit | Description |
|--------|-------------|
| `71e0741` | Anthropic API moved server-side to Vercel Edge Function (`/api/coach`) |
| `8a4bba1` | Added 503 error visibility when `/api/coach` edge function is unavailable |
| `78a4c0b` | Fixed `workoutParsed` ReferenceError in AI Coach response handler |
| `b5f1147` | AI Coach supplement recommendations persist to DB; PR max-weight saves to `workout_sessions` |
| `bb23d90` | `prHistory` rebuilt from `workout_sessions` on sign-in; write-error handling added |
| `5d1feb0` | AI Coach WORKOUT_PLAN multi-format parsing fixed (handles pipe separator + plain JSON) |
| `48953cb` | **Fix C: persist workout plans to `workout_plans` table** |

### Fix C — workout plan persistence (commit `48953cb`)

**What changed in `App.jsx`:**

- **`loadUserData`** — after loading weight log, now selects all rows from `workout_plans` ordered by `sort_order ASC` and hydrates the `workouts` state. If the user has no saved plans, `INITIAL_WORKOUTS` is kept as the default.
- **`addWorkoutPlan`** (AI Coach path) — now `async`; after optimistic local prepend it inserts the plan into `workout_plans` and swaps the temp `"w{timestamp}"` id for the real Supabase UUID.
- **`saveWorkoutPlanDB`** — new function. Called by WorkoutTab for both create (inserts) and edit (patches). On insert, swaps temp id with DB UUID; on update, PATCHes name/tag/level/est_min/scheduled_day/exercises.
- **`deleteWorkoutPlanDB`** — new function. DELETEs the row via `id=eq.{id}&user_id=eq.{uid}`. No-op for unauthenticated / demo users.
- **`WorkoutTab`** — accepts two new props (`onSavePlan`, `onDeletePlan`). `saveWorkout` detects new vs edit and calls `onSavePlan`; `deleteWorkout` calls `onDeletePlan`.
- **WorkoutTab mount** — passes `onSavePlan={saveWorkoutPlanDB}` and `onDeletePlan={deleteWorkoutPlanDB}`.

**`workout_plans` table columns used:** `id`, `user_id`, `name`, `tag`, `level`, `est_min`, `scheduled_day`, `exercises` (jsonb), `sort_order`, `created_at`.

**sort_order:** set to 0 on AI-Coach-added plans (prepend), to `workouts.length` on manually created plans (append). Reorder UI does not exist for plans yet; column is in place for future drag-to-reorder feature.
