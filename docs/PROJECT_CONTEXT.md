# WiFit — Project Context

**Rewritten 2026-08-13 from the live database and current `src/App.jsx`.**

The previous version of this file was written from inference and drifted ~40 commits
behind reality. It claimed `profiles.gender` did not exist, named the weight table
`weight_log` instead of `body_weight_log`, and documented macro columns as
`*_per_100g` instead of `per100_*`. Each of those became a silent HTTP 400 in
production, because `sb.insert`/`sb.upsert` swallow non-2xx responses. **Every
statement below was verified against the live schema or the current code. If you
change the schema, change this file in the same commit.**

---

## What WiFit is

A single-user fitness PWA: food logging with macros, workout plans and sessions,
supplements, water, body weight, and an AI coach. React + Vite, deployed on Vercel
at `wifit.vercel.app`, backed by Supabase (Postgres + Auth).

## Stack and layout

| Path | What |
|---|---|
| `src/App.jsx` | The entire app — ~6,600 lines, one file. All components, the `sb` client, auth, parsers. |
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
| **prs** | **jsonb** | **NO** | `'[]'` |

`prs` was missing for months while the client sent it on every insert — PostgREST
returned 400 `PGRST204`, `sb.insert` swallowed it, and the table stayed empty while
the UI showed saved workouts. It is a **native jsonb array**: read `r.prs` directly,
never `JSON.parse(r.prs)`.

`exercises` shape: `[{name, isPR, sets:["8×135lbs", ...]}]`.

### workout_plans
`id`, `user_id`, `name` (NOT NULL), `tag`, `level`, `est_min` integer,
`scheduled_day` text, `exercises` **jsonb NOT NULL default `'[]'`**, `sort_order`
integer default 0, `created_at`.

### supplement_stack
`id`, `user_id`, `name` (NOT NULL), `sub`, `dot_color` text default `'#888888'`,
`reminder_time` text, `reminder_enabled` boolean default false, `sort_order` integer
default 0, `created_at`, plus:

- **`category`** text — the AI's taxonomy (e.g. `"Creatine"`), also the key into `DOT_COLORS`
- **`note`** text — the AI's usage tip

Before these existed, the ADD_SUPP path flattened `dose`+`timing` into `sub`, consumed
`category` only to pick a hex color, and dropped `note` entirely. Both the AI path and
the manual add path now persist `category` and `note`.

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
   indistinguishable. 16 call sites depend on this contract and are `[]`-guarded, and
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

## `/api/coach` security

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

1. **10 `sb.*` call sites still ignore the return value.** Verified count — an earlier
   estimate of ~6 was low. Lines (approximate, locate by identifier):
   `sb.delete` food_log (~2769), `sb.delete` supplement_stack (~3940), `sb.update`
   supplement_stack (~3948, ~3963, ~4049), `sb.upsert` profiles (~4913, ~5541, ~6238),
   `sb.insert` custom_foods (~6445), `sb.delete` workout_plans (~6613). Each can fail
   silently. `addFoodItem` and `saveWorkoutSession` are the two that *do* check — copy
   their shape.

2. **Open Food Facts search is CORS-blocked** from the browser. USDA works. Needs a
   proxy (an Edge function like `/api/coach`) or removal.

3. **The AI parser contradicts the custom-food form.** `parseIntent` hardcodes
   `cup → 240 g` and `scoop/serving → 30 g`, while the custom-food form deliberately
   refuses to guess and requires the user to supply grams for food-dependent units. Two
   different positions on what a cup weighs.

4. **USDA `servingSizeUnit` is never read** — `servingG: f.servingSize` takes the number
   regardless of whether USDA reported grams, ml, or IU. Same class of bug as the
   custom-food unit bug, on data the user doesn't control.

5. **No edit or delete UI for custom foods.** Create-only. A bad row can only be removed
   from the database directly.

6. **`GoalDots`** (~line 498) is a complete component nothing renders. `WeightLogWidget`
   had the same problem and is now wired in.

7. **`coach_usage` retention.** One row per request, ~110 bytes with the index. At 100
   active users it approaches the 500 MB free tier within a year. Only the last 24h is
   ever read. When the table nears ~1M rows, add a nightly `pg_cron`:
   `delete from coach_usage where created_at < now() - interval '2 days';` — it runs as
   `postgres`, so the absent DELETE policy does not block it.

8. **`today` is computed once per mount** (see Dates above).

9. **ESLint reports 28 `no-unused-vars` warnings**, 0 errors. Untriaged.

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
