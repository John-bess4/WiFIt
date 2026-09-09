# WiFit-iOS + TrainerHQ-iOS — the shared data-layer package (spec)

**The single most important port document.** Both iOS apps read this one Supabase
project, so this layer is implemented ONCE, in a shared Swift package, and
imported by both. Two implementations of the contracts below WILL diverge — the
same argument that moved derived values into Postgres (DECISIONS.md). The JS
source of truth to translate is `src/lib/` (`supabase.js`, `nutrition.js`,
`dates.js`, `workouts.js`, `search.js`, `constants.js`, `coach.js`).

Do not use a third-party Supabase SDK convenience layer that hides the contracts
below; the whole app is written against these exact behaviours.

## 1. The client surface (`sb`-equivalent) — `src/lib/supabase.js`

A thin REST client over PostgREST + GoTrue. **No method throws.** Surface:

| Method | Returns | On failure |
|---|---|---|
| `select(table, filters, opts)` | `[Row]` | `[]` on ANY non-2xx (401/500/no-rows indistinguishable) |
| `selectAuth(table, filters, opts)` | `{ok, authError, status, rows}` | `ok=false` on ANY non-2xx/network; `authError=true` only 401/403 |
| `insert(table, row)` | `Row?` | `nil` |
| `upsert(table, row, onConflict)` | `Row?` | `nil` |
| `update(table, changes, filter)` | `Bool` | `false` |
| `delete(table, filter)` | `Bool` | `false` |

Swift shapes: `select`→`[T]` (empty on failure), `selectAuth`→`enum ReadResult<T> { case ok([T]); case failed(authError: Bool, status: Int) }`, `insert/upsert`→`T?`, `update/delete`→`Bool`. Every failure logs `[sb.<method>] <table> <status>` — keep that, it is the only trace of a swallowed write.

**Why two read methods:** `select` collapsing every non-2xx to `[]` is load-bearing
for 15 call sites AND a landmine — a 401 reads as "no rows", which once sent an
expired session to onboarding as a "new user". Use `selectAuth` for any read
where "failed" must be distinguished from "empty" (the treatment ladder below).

## 2. selectAuth's treatment ladder (what a caller does with a failed read)

`ok=false` is never rendered as an empty state. Five tiers, by how bad a wrong
"empty" would be — the Swift screens must reproduce the tier, not just the read:

1. **Refuse to render + say so** (Calendar month, Progress, Train history,
   ProfilePage): the section shows "couldn't load — these numbers are not yours",
   never zeros. A wrong zero here is a lie about the user's data.
2. **Render-from-state + failed/Retry line** (Home week rail): `null` means the
   read failed (show Retry), `{}`/`[]` means genuinely empty. Never conflated.
3. **No-seed guard** (mount reads that back writes): if the read failed, block
   the writes that would be destructive against a wrongly-empty state
   (`loadFailures` lists the section; the setter refuses).
4. **Banner-only** (the top-level mount banner): the section renders from state
   but a banner names what failed with Retry.
5. **Routing** (`authError` only): a 401/403 on the mount profile read routes to
   auth — NEVER to onboarding (onboarding overwrites a real profile). A 500 or
   network blip must NOT route anywhere (that is why `authError` is separate from
   `ok`).

`authError` is for tier 5 ONLY. Everything else keys on `ok`.

## 3. Per-table on_conflict (upsert) — SCHEMA.md has the constraints

`profiles`→`id`; `water_log`/`body_weight_log`→`user_id,log_date`;
`supplement_log`→`supplement_id,log_date`. PostgREST infers the PK unless told,
so the composite-unique tables 409 on the second same-day write without the
explicit target. Everything else is a plain insert.

## 4. Decimal, not Double — all macro arithmetic  (`src/lib/nutrition.js`)

**Hard requirement.** `round(per100 * grams / 100)` in Postgres `numeric` and in
IEEE `Double` disagree on **21 of 3,996** exact-.5 products in a 0.1-step grid.
Worked case: **`32.3 × 500 / 100 = 161.5` exactly → `Decimal` rounds to 162; the
Double is `161.49999999999997` → rounds to 161.** `daily_summary` computes in
`numeric` and is the definition; a `Double` port would show a different day total
than the view for the same rows. Use `Decimal` (banker's-rounding off; match
Postgres `round()` = round-half-up) for `calc`, `totals`, `per100From`, and
anything summing macros. `sugar` null = unknown: counts as 0 in a total, stored
and displayed as null/"—", never 0.

## 5. The four view reads and what each replaces  (defs in SCHEMA.md)

Never recompute these on the client; read the view (RLS-scoped, security_invoker):

| View | Replaces | Client had the bug |
|---|---|---|
| `exercise_bests` | a client `prHistory` cache (last 20 sessions, regex over display strings) | a 401 became empty → real PRs stamped false; a 20-session window forgot older bests |
| `exercise_pr_events` | stored `workout_sessions.prs` | prs froze whatever `bests` said at finish; deleting a PR session didn't promote the next lift |
| `daily_summary` | four client re-derivations (Home rail, Calendar, Progress, calc) | two different adherence denominators; a weight read frozen at row 31 |
| `weight_monthly` | client scan of a `limit:30` weight read | best-change depended on how many rows were read |

The **one** derivation that stays on the client is `computePRs` — the live
in-session PR banner, comparing the unsaved session against `exercise_bests`
loaded at Start. It cannot be a view (the session isn't saved yet) and applies
the same rule as `exercise_pr_events` (strictly greater than a recorded best;
first-ever lift and weight-0 never count). If the rule changes, change both.

## 6. Local id → uuid write-back (the delete/update landmine)  (`src/lib/supabase.js`, `workouts.js`)

New items get a client-local id; the database assigns a uuid on insert. **Write
the uuid back into state** (`withDbId`) or a same-session delete/update sends the
local id at a uuid column — a 400 the swallowing client hides, so the row
"deletes" in the UI and returns on reload. Rule: `hasDbId` (a real uuid) gates
every delete/update filter; if an item has only a local id, block the mutation
with "still saving, try again". Applies to food_log, custom_foods,
supplement_stack, workout_sessions, workout_plans.

Session rows additionally go through `normalizeExercises` at the read boundary:
`exercises` is an array; every entry has `name`, equal-length `sets[]` and
`setsData[]`; `setsData` is authoritative and `sets` labels are rebuilt from it
when missing/mismatched. One malformed row must not crash the tab.

## 7. Auth: 401 retry + session refresh  (`src/lib/supabase.js`)

- Every REST call goes through one chokepoint. On **401 only** (never 403 — that
  is an RLS denial refresh can't fix), refresh the session **once** and retry.
- Refreshes are **coalesced**: concurrent 401s (finishing a workout fires several
  writes) must redeem the single-use refresh_token exactly once, or the reused
  token is rejected and the user is signed out mid-workout. Compare the
  access_token the failed request used against the current one; if another
  refresh already happened, retry on the new token instead of refreshing again.
- `resolveSession()` runs BEFORE any data load and yields `valid | refreshed |
  logged-out` (refreshing at most once, with a 60 s expiry skew buffer).
- A refresh that fails deep in a write routes to auth via a registered handler —
  never onboarding.
- The bearer is read at call time, not captured, so a just-refreshed token is used.

## 8. Dates  (`src/lib/dates.js`)

Every `*_date` column is the user's **local** day. Convert a timestamp to the
local day (`Calendar.current`, device tz) before comparing it to a date column;
never use UTC ISO components. The bug this prevents: an evening signup compared
`created_at` (UTC) to the local day and marked the user's own first day
pre-creation.

## What the shared package explicitly does NOT contain

UI, theme, the coach request/replay (that is app-level, see COACH.md), and
anything TrainerHQ-owned. It is the data contract only: client, reads/writes,
the view reads, Decimal math, dates, auth.
