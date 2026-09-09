# WiFit — database schema (port reference)

Generated from `information_schema` / `pg_catalog` on 2026-09-09, not written by
hand. Regenerate with the queries at the bottom. Project `vghqqksbjpgdzmvfmnru`.
All WiFit tables have **RLS enabled** (verified: every one `relrowsecurity=true`).
Every `user_id`/`id` is a FK to `auth.users(id)` `ON DELETE CASCADE`.

Types are Postgres types. A Swift client maps `numeric`→`Decimal` (NOT Double —
see DATA_LAYER.md), `date`→a local-day `YYYY-MM-DD` string (see `localDate`),
`timestamptz`→`Date`, `jsonb`→typed structs, `uuid`→`String`/`UUID`.

## The `on_conflict` targets (upsert)

PostgREST infers the conflict target from the **primary key** unless
`on_conflict` names the columns. Get this wrong and the second same-day write
409s. Verified from `pg_constraint`:

| Table | Upsert on | Why |
|---|---|---|
| `profiles` | `id` (PK) | one row per user; PK is the natural key |
| `water_log` | **`user_id,log_date`** | surrogate `id` PK + separate UNIQUE → must name it |
| `supplement_log` | **`supplement_id,log_date`** | same |
| `body_weight_log` | **`user_id,log_date`** | same |
| everything else | plain INSERT | no upsert path |

UNIQUE constraints, verbatim: `water_log_user_id_log_date_key UNIQUE (user_id, log_date)`,
`supplement_log_supplement_id_log_date_key UNIQUE (supplement_id, log_date)`,
`body_weight_log_user_id_log_date_key UNIQUE (user_id, log_date)`.

## Tables (WiFit)

### profiles  — PK `id` (= auth.users.id), upsert on `id`
| col | type | null | default |
|---|---|---|---|
| id | uuid | NO | — (FK auth.users) |
| name | text | YES | |
| age | integer | YES | |
| gender | text | YES | |
| weight_lbs | numeric | YES | |
| height_in | numeric | YES | |
| activity_level | text | YES | `'moderate'` |
| goal | text | YES | `'maintain'` |
| goal_rate | text | YES | |
| cal_goal | integer | YES | `2200` |
| protein_goal | integer | YES | `140` |
| carbs_goal | integer | YES | `180` |
| fat_goal | integer | YES | `78` |
| bmr | numeric | YES | |
| tdee | numeric | YES | |
| theme | text | YES | `'dark'` (legacy default; resolveTheme maps it) |
| created_at | timestamptz | YES | `now()` |
| updated_at | timestamptz | YES | `now()` |

There are **no `fiber_goal` / `sodium_goal` columns.** FoodTab shows fiber/sodium
against `25`/`2300` client-side defaults — reference values, not user goals.

### food_log  — PK `id`, plain insert; delete/update by `id`+`user_id`
| col | type | null | default |
|---|---|---|---|
| id | uuid | NO | gen_random_uuid() |
| user_id | uuid | NO | |
| logged_date | date | NO | CURRENT_DATE |
| meal_slot | text | NO | (breakfast/lunch/dinner/snacks) |
| food_name | text | NO | |
| brand | text | YES | |
| grams | numeric | **NO** | — (0/NaN → 400; validate before write) |
| per100_cal | numeric | YES | 0 |
| per100_protein | numeric | YES | 0 |
| per100_carbs | numeric | YES | 0 |
| per100_fat | numeric | YES | 0 |
| per100_fiber | numeric | YES | 0 |
| per100_sugar | numeric | YES | **null** (null = unknown, not 0) |
| per100_sodium | numeric | YES | 0 |
| color | text | YES | |
| created_at | timestamptz | YES | now() |

Macros are stored **per 100 g**; a logged amount is `round(per100 * grams/100)`.

### custom_foods — PK `id`; the user's own catalogue
`id, user_id, name(NO), brand, serving_g, serving_qty, serving_unit,
per100_cal/protein/carbs/fat/fiber/sugar/sodium (numeric, default 0), created_at`.
No edit/delete UI in the web client (#5); the in-memory row keeps its uuid.

### workout_sessions — PK `id`; `exercises` jsonb is the payload
| col | type | null | default |
|---|---|---|---|
| id | uuid | NO | gen_random_uuid() |
| user_id | uuid | NO | |
| workout_name | text | NO | |
| completed_date | date | NO | CURRENT_DATE (= the day STARTED, from startedAt) |
| duration_secs | integer | YES | 0 |
| sets_completed | integer | YES | 0 |
| total_sets | integer | YES | 0 |
| exercises | jsonb | YES | `'[]'` |
| prs | jsonb | **NO** | `'[]'` — **dead since #28**, no longer written or read |
| trainer_assignment_id | uuid | YES | — (TrainerHQ; null for WiFit-only) |
| created_at | timestamptz | YES | now() |

`exercises[]` shape: `{name, sets:["8×135lbs",…], setsData:[{reps,weight},…]}`,
the two arrays equal length. `setsData` is authoritative (the views read it);
`sets` is the display label. See DATA_LAYER.md §normalize.

### workout_plans — PK `id`; `exercises` jsonb, upsert-less
`id, user_id, name(NO), tag, level, est_min, scheduled_day, exercises jsonb NOT
NULL '[]', sort_order int default 0, trainer_assignment_id uuid, created_at`.

### supplement_stack — PK `id`
`id, user_id, name(NO), sub, dot_color text default '#888888', reminder_time
text, reminder_enabled bool default false, sort_order int default 0, category
text (8 purpose values or null), note text, created_at`.

### supplement_log — PK `id`, upsert on `(supplement_id,log_date)`
`id, user_id, supplement_id(NO, FK supplement_stack ON DELETE CASCADE),
log_date date default CURRENT_DATE, taken bool default false, created_at`.

### water_log — PK `id`, upsert on `(user_id,log_date)`
`id, user_id, log_date, oz integer NOT NULL default 0, cups integer default 0
(cups is dead — client writes oz), created_at`.

### body_weight_log — PK `id`, upsert on `(user_id,log_date)`
`id, user_id, weight_lbs numeric NOT NULL, log_date date default CURRENT_DATE,
note text (dead), created_at`. Column is `weight_lbs`, **not `lbs`**.

### ai_coach_usage — PK `id`; INSERT+SELECT own only, NO update/delete
`id, user_id, created_at NOT NULL default now()`. One row per accepted
`/api/coach` request; the rate limiter (see COACH.md). Renamed from
`coach_usage` 2026-09-09.

### workouts — LEGACY, DO NOT USE
Zero rows, never referenced. Plans live in `workout_plans`.

## Views (WiFit) — all `security_invoker=true`, `GRANT SELECT TO authenticated` only

Verified grants: `authenticated:SELECT` on all five; nothing to `anon`.
Definitions are in the migrations and reproduced in DATA_LAYER.md §views. Summary:

| View | Key columns | Is |
|---|---|---|
| `exercise_bests` | user_id, name, best_lbs | max setsData weight per exercise, all sessions |
| `exercise_pr_events` | user_id, session_id, completed_date, name, lbs, prev_best | sessions whose top weight beat every earlier session (strict) |
| `daily_summary` | user_id, day, kcal, protein_g, carbs_g, fat_g, food_rows, workout_count, workout_names, supps_taken, supps_due, weight_lbs | one row per (user, day) with any data |
| `supplement_due_from` | user_id, supplement_id, name, due_from | `least(created_at::date, first log_date)` |
| `weight_monthly` | user_id, month 'YYYY-MM', first_lbs, last_lbs, entries | first/last weigh-in per calendar month |

`daily_summary.kcal` etc. are `sum(round(per100*grams/100))` in **numeric** — the
Swift client must match this in `Decimal` (DATA_LAYER.md).

## TrainerHQ tables — PRESENT in this database, OUT OF SCOPE for WiFit

Do not audit these as WiFit's, do not read/write them from WiFit code. Listed so
a "dump every table" pass knows they are owned elsewhere (PROJECT_CONTEXT
§TrainerHQ, TRAINERHQ_CONTRACT.md):

- `public`: the 16 `trainer_*` / `client_*` tables.
- schema `trainerhq_private`: 13 tables.
- edge function `trainerhq-api`.

**Cross-app coupling WiFit must respect:** `workout_plans` and
`workout_sessions` carry `trainer_assignment_id uuid` with a composite FK
`(trainer_assignment_id, user_id) → trainer_workout_assignments(id, client_id)`.
When WiFit writes these rows with `trainer_assignment_id = NULL` (the normal
case) the FK does not bind. If it is ever set, it must reference a real trainer
assignment for that client or the write fails. WiFit-iOS should treat the column
as read-through (populated by TrainerHQ) unless a feature explicitly assigns it.

## Queries used

```sql
-- columns
select c.table_name, c.column_name, c.data_type, c.is_nullable, c.column_default
from information_schema.columns c where c.table_schema='public'
  and c.table_name in ('profiles','food_log','custom_foods','workout_sessions',
    'workout_plans','supplement_stack','supplement_log','water_log',
    'body_weight_log','ai_coach_usage','workouts')
order by c.table_name, c.ordinal_position;

-- constraints (PK / UNIQUE / FK) → on_conflict targets
select conrelid::regclass, conname, pg_get_constraintdef(oid)
from pg_constraint where connamespace='public'::regnamespace
  and conrelid::regclass::text = any(array[/* the 11 tables */]);

-- view definitions + grants
select viewname, pg_get_viewdef((schemaname||'.'||viewname)::regclass, true) from pg_views where schemaname='public';
select grantee, privilege_type, table_name from information_schema.role_table_grants
where table_schema='public' and grantee in ('anon','authenticated');
```
