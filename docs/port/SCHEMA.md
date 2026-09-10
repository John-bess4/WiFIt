# WiFit shared database schema snapshot

Verified read-only on 2026-09-10 against Supabase project
`vghqqksbjpgdzmvfmnru` using `information_schema.columns`, `pg_constraint`,
`pg_get_viewdef`, `pg_class` and `has_table_privilege`. This file records
the existing production schema. No DDL or committed data mutations were applied
in phase-one verification; synthetic test writes were deliberately rolled back.

WiFit and TrainerHQ are sister apps sharing this project. FitDataKit owns the
common personal-fitness contract; trainer relationship/consent commands remain
behind the separate gateway described in
[TRAINERHQ_CONTRACT.md](../TRAINERHQ_CONTRACT.md). A common database does not
grant either app unconditional access to another user's data.

All 11 tables listed here have RLS enabled. All five views use
`security_invoker=true`, with SELECT allowed for `authenticated` and not
`anon`. Base-table SELECT privileges exist for both roles, subject to RLS.
Catalog facts are not a user-JWT isolation test; see [RLS.md](RLS.md) and the
pending integration gates in [GEN2_PHASE_ONE.md](../GEN2_PHASE_ONE.md).

The live [FitDataKit contract test](../../supabase/tests/fitdatakit_contract.sql)
completed **156/156** assertions with synthetic-account/row cleanup verified on
2026-09-10. Its separately reported supplement-parent diagnostic returned
**false**, exposing an existing cross-row ownership gap. This was PostgreSQL
`authenticated`/`anon` role and request-claim simulation, not a JWT/PostgREST test.
The proposed fix below is not part of the applied schema snapshot.

## Write identities and conflicts

| Table | Write |
|---|---|
| `profiles` | Upsert on `id` |
| `water_log` | Upsert on `user_id,log_date` |
| `body_weight_log` | Upsert on `user_id,log_date` |
| `supplement_log` | Upsert on `supplement_id,log_date` |
| Other active tables | Plain insert for create, verified UUID/owner filter for update/delete |

All table PKs are `id uuid`. Every table's `user_id` is a NOT NULL FK to
`auth.users(id) ON DELETE CASCADE`, except `profiles`, whose `id` itself
is that FK. The table-specific constraint listings below are exact catalog
definitions. **No CHECK constraints were present on these 11 tables at this
verification**, including grams positivity and supplement category values.

## Tables

Column types/nullability/defaults below are from the live catalog. "—" means
no default, not an empty string. Nullable numeric fields decode as optional
Decimal; defaults do not make them non-null. Default date/timestamp values run
in the server session; the client explicitly sends local calendar dates.

### profiles

`id` is also the authenticated user's ID. `goal_rate` is text, with keys such as `lose_1` and `maintain`; it is not a numeric rate. `goal` is legacy. `theme` may contain a legacy value or a palette key; decoding must not erase an unknown value. There are no `fiber_goal` or `sodium_goal` columns. Nullable profile fields permit partial onboarding rows; an existing partial row is not an absent account.

| Column | PostgreSQL type | Nullable | Default |
|---|---|---|---|
| `id` | `uuid` | NO | — |
| `name` | `text` | YES | — |
| `age` | `int4` | YES | — |
| `weight_lbs` | `numeric` | YES | — |
| `height_in` | `numeric` | YES | — |
| `activity_level` | `text` | YES | `'moderate'::text` |
| `goal` | `text` | YES | `'maintain'::text` |
| `cal_goal` | `int4` | YES | `2200` |
| `protein_goal` | `int4` | YES | `140` |
| `carbs_goal` | `int4` | YES | `180` |
| `fat_goal` | `int4` | YES | `78` |
| `theme` | `text` | YES | `'dark'::text` |
| `created_at` | `timestamptz` | YES | `now()` |
| `updated_at` | `timestamptz` | YES | `now()` |
| `gender` | `text` | YES | — |
| `bmr` | `numeric` | YES | — |
| `tdee` | `numeric` | YES | — |
| `goal_rate` | `text` | YES | — |

Constraints:

- `profiles_id_fkey`: `FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE`
- `profiles_pkey`: `PRIMARY KEY (id)`

### food_log

Macros are per 100 grams; scale with Decimal and round each row before summing. `per100_sugar` defaults to null (unknown), unlike the other nutrient defaults. **There is no CHECK requiring positive grams.** Validate positive finite grams in the shared write path; do not assume zero will return HTTP 400. The documented meal-slot vocabulary is an application contract, not a database CHECK.

| Column | PostgreSQL type | Nullable | Default |
|---|---|---|---|
| `id` | `uuid` | NO | `gen_random_uuid()` |
| `user_id` | `uuid` | NO | — |
| `logged_date` | `date` | NO | `CURRENT_DATE` |
| `meal_slot` | `text` | NO | — |
| `food_name` | `text` | NO | — |
| `brand` | `text` | YES | — |
| `grams` | `numeric` | NO | — |
| `per100_cal` | `numeric` | YES | `0` |
| `per100_protein` | `numeric` | YES | `0` |
| `per100_carbs` | `numeric` | YES | `0` |
| `per100_fat` | `numeric` | YES | `0` |
| `per100_fiber` | `numeric` | YES | `0` |
| `per100_sodium` | `numeric` | YES | `0` |
| `color` | `text` | YES | — |
| `created_at` | `timestamptz` | YES | `now()` |
| `per100_sugar` | `numeric` | YES | — |

Constraints:

- `food_log_pkey`: `PRIMARY KEY (id)`
- `food_log_user_id_fkey`: `FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE`

### custom_foods

`serving_g` is the gram source of truth; `serving_qty`/`serving_unit` preserve the entered amount/unit for editing. All columns, including nutrients, are nullable except ID, owner and name. `per100_sugar` has default zero here; explicitly send null for unknown sugar. Editing/deletion needs a native UI; no web UI currently provides it.

| Column | PostgreSQL type | Nullable | Default |
|---|---|---|---|
| `id` | `uuid` | NO | `gen_random_uuid()` |
| `user_id` | `uuid` | NO | — |
| `name` | `text` | NO | — |
| `brand` | `text` | YES | — |
| `serving_g` | `numeric` | YES | — |
| `per100_cal` | `numeric` | YES | `0` |
| `per100_protein` | `numeric` | YES | `0` |
| `per100_carbs` | `numeric` | YES | `0` |
| `per100_fat` | `numeric` | YES | `0` |
| `per100_fiber` | `numeric` | YES | `0` |
| `per100_sugar` | `numeric` | YES | `0` |
| `per100_sodium` | `numeric` | YES | `0` |
| `created_at` | `timestamptz` | YES | `now()` |
| `serving_qty` | `numeric` | YES | — |
| `serving_unit` | `text` | YES | — |

Constraints:

- `custom_foods_pkey`: `PRIMARY KEY (id)`
- `custom_foods_user_id_fkey`: `FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE`

### workout_sessions

`completed_date` must be explicitly supplied from the original workout start day; `CURRENT_DATE` is merely the server fallback. `exercises` stores numeric `setsData` and derived display `sets` labels. The legacy `prs` column is no longer written/read by the app; PR views are authoritative. Preserve nullable `trainer_assignment_id` when editing or completing trainer-origin work.

| Column | PostgreSQL type | Nullable | Default |
|---|---|---|---|
| `id` | `uuid` | NO | `gen_random_uuid()` |
| `user_id` | `uuid` | NO | — |
| `workout_name` | `text` | NO | — |
| `completed_date` | `date` | NO | `CURRENT_DATE` |
| `duration_secs` | `int4` | YES | `0` |
| `sets_completed` | `int4` | YES | `0` |
| `total_sets` | `int4` | YES | `0` |
| `exercises` | `jsonb` | YES | `'[]'::jsonb` |
| `created_at` | `timestamptz` | YES | `now()` |
| `prs` | `jsonb` | NO | `'[]'::jsonb` |
| `trainer_assignment_id` | `uuid` | YES | — |

Constraints:

- `trainerhq_session_assignment_owner`: `FOREIGN KEY (trainer_assignment_id, user_id) REFERENCES trainer_workout_assignments(id, client_id)`
- `workout_sessions_pkey`: `PRIMARY KEY (id)`
- `workout_sessions_user_id_fkey`: `FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE`

### workout_plans

`exercises` is NOT NULL JSONB, unlike session exercises. Preserve stable exercise IDs and nullable `trainer_assignment_id`. Standalone WiFit plans leave assignment origin null.

| Column | PostgreSQL type | Nullable | Default |
|---|---|---|---|
| `id` | `uuid` | NO | `gen_random_uuid()` |
| `user_id` | `uuid` | NO | — |
| `name` | `text` | NO | — |
| `tag` | `text` | YES | — |
| `level` | `text` | YES | — |
| `est_min` | `int4` | YES | — |
| `scheduled_day` | `text` | YES | — |
| `exercises` | `jsonb` | NO | `'[]'::jsonb` |
| `sort_order` | `int4` | YES | `0` |
| `created_at` | `timestamptz` | YES | `now()` |
| `trainer_assignment_id` | `uuid` | YES | — |

Constraints:

- `trainerhq_plan_assignment_owner`: `FOREIGN KEY (trainer_assignment_id, user_id) REFERENCES trainer_workout_assignments(id, client_id)`
- `workout_plans_pkey`: `PRIMARY KEY (id)`
- `workout_plans_user_id_fkey`: `FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE`

### supplement_stack

`category` is a lowercase purpose: `protein`, `vitamin`, `mineral`, `performance`, `health`, `sleep`, `fat_burner`, `probiotic`, or null. There is no category CHECK today. Product-type labels are a separate catalog concern. `reminder_time` is text; the native app must validate/interpret it before registering real notifications.

| Column | PostgreSQL type | Nullable | Default |
|---|---|---|---|
| `id` | `uuid` | NO | `gen_random_uuid()` |
| `user_id` | `uuid` | NO | — |
| `name` | `text` | NO | — |
| `sub` | `text` | YES | — |
| `dot_color` | `text` | YES | `'#888888'::text` |
| `reminder_time` | `text` | YES | — |
| `reminder_enabled` | `bool` | YES | `false` |
| `sort_order` | `int4` | YES | `0` |
| `created_at` | `timestamptz` | YES | `now()` |
| `category` | `text` | YES | — |
| `note` | `text` | YES | — |

Constraints:

- `supplement_stack_pkey`: `PRIMARY KEY (id)`
- `supplement_stack_user_id_fkey`: `FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE`

### supplement_log

One row per `(supplement_id, log_date)`. The upsert target intentionally excludes `user_id`; ownership still belongs in the payload. Deleting a supplement cascades to its log rows.

| Column | PostgreSQL type | Nullable | Default |
|---|---|---|---|
| `id` | `uuid` | NO | `gen_random_uuid()` |
| `user_id` | `uuid` | NO | — |
| `supplement_id` | `uuid` | NO | — |
| `log_date` | `date` | NO | `CURRENT_DATE` |
| `taken` | `bool` | YES | `false` |
| `created_at` | `timestamptz` | YES | `now()` |

Constraints:

- `supplement_log_pkey`: `PRIMARY KEY (id)`
- `supplement_log_supplement_id_fkey`: `FOREIGN KEY (supplement_id) REFERENCES supplement_stack(id) ON DELETE CASCADE`
- `supplement_log_supplement_id_log_date_key`: `UNIQUE (supplement_id, log_date)`
- `supplement_log_user_id_fkey`: `FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE`

**Observed gap:** the single-column supplement FK checks parent existence but
does not require the log and parent to have the same `user_id`. In the rolled-back
test, fixture A inserted an A-owned log for fixture B's real stack UUID. The row
owner remained A, so existing RLS accepted it. This does not grant A a read of B's
stack; it allows an inconsistent parent reference and can occupy that
supplement/date unique key.

**Proposed, NOT APPLIED:** add
`supplement_stack_id_user_id_key UNIQUE (id,user_id)` to the parent, then
`supplement_log_supplement_owner_fkey FOREIGN KEY (supplement_id,user_id)
REFERENCES supplement_stack(id,user_id) ON DELETE CASCADE` to the log. All four
identity columns are already NOT NULL UUIDs. The current row PKs, original
cascade FK and `UNIQUE (supplement_id,log_date)` stay unchanged; normal
same-owner upserts retain their wire shape and UUID behavior. See the
[count-preflight proposal](../../supabase/proposals/supplement_parent_ownership.sql).
It aborts before DDL if a missing or mismatched parent exists; it does not
delete or reassign those rows. Existing constraint lists above remain the live
state until a separately verified migration is applied.

### water_log

One cumulative ounces total per `(user_id, log_date)`. `cups` is legacy and is not read/written by the current app. Same-day uniqueness is not an atomic increment; concurrent cumulative replacements can overwrite one another.

| Column | PostgreSQL type | Nullable | Default |
|---|---|---|---|
| `id` | `uuid` | NO | `gen_random_uuid()` |
| `user_id` | `uuid` | NO | — |
| `log_date` | `date` | NO | `CURRENT_DATE` |
| `cups` | `int4` | YES | `0` |
| `created_at` | `timestamptz` | YES | `now()` |
| `oz` | `int4` | NO | `0` |

Constraints:

- `water_log_pkey`: `PRIMARY KEY (id)`
- `water_log_user_id_fkey`: `FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE`
- `water_log_user_id_log_date_key`: `UNIQUE (user_id, log_date)`

### body_weight_log

One weigh-in per `(user_id, log_date)`. The value is `weight_lbs`, not `lbs`, and the table is not `weight_log`. `note` is legacy/unexposed in the current UI.

| Column | PostgreSQL type | Nullable | Default |
|---|---|---|---|
| `id` | `uuid` | NO | `gen_random_uuid()` |
| `user_id` | `uuid` | NO | — |
| `weight_lbs` | `numeric` | NO | — |
| `log_date` | `date` | NO | `CURRENT_DATE` |
| `note` | `text` | YES | — |
| `created_at` | `timestamptz` | YES | `now()` |

Constraints:

- `body_weight_log_pkey`: `PRIMARY KEY (id)`
- `body_weight_log_user_id_fkey`: `FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE`
- `body_weight_log_user_id_log_date_key`: `UNIQUE (user_id, log_date)`

### ai_coach_usage

One row per accepted coach request. The policy contract permits own-row INSERT/SELECT, not UPDATE/DELETE, so the caller cannot reset its quota. The table was renamed from `coach_usage`; constraint names still retain the old prefix. The native client calls the Vercel coach proxy, not a privileged usage endpoint.

| Column | PostgreSQL type | Nullable | Default |
|---|---|---|---|
| `id` | `uuid` | NO | `gen_random_uuid()` |
| `user_id` | `uuid` | NO | — |
| `created_at` | `timestamptz` | NO | `now()` |

Constraints:

- `coach_usage_pkey`: `PRIMARY KEY (id)`
- `coach_usage_user_id_fkey`: `FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE`

### workouts

Legacy table. Do not build a repository or migrate plans into it; current plans live in `workout_plans`. Included for complete inventory, not native feature scope.

| Column | PostgreSQL type | Nullable | Default |
|---|---|---|---|
| `id` | `uuid` | NO | `gen_random_uuid()` |
| `user_id` | `uuid` | NO | — |
| `name` | `text` | NO | — |
| `tag` | `text` | YES | — |
| `level` | `text` | YES | — |
| `est_min` | `int4` | YES | — |
| `exercises` | `jsonb` | YES | `'[]'::jsonb` |
| `created_at` | `timestamptz` | YES | `now()` |
| `updated_at` | `timestamptz` | YES | `now()` |

Constraints:

- `workouts_pkey`: `PRIMARY KEY (id)`
- `workouts_user_id_fkey`: `FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE`

## Workout JSON and trainer assignment coupling

Session exercises use `[{name, sets: ["8×135lbs"], setsData: [{reps, weight}]}]`.
`setsData` is numeric authority; labels are derived, with equal array length.
Read-boundary normalization must handle historical malformed/label-only rows
without fabricating successful server reads. Neither JSON shape nor numeric
weights have a database CHECK. The exercise views below cast weights to numeric,
so malformed data can make a view read fail.

Plans/sessions carry composite foreign keys
`(trainer_assignment_id, user_id) → trainer_workout_assignments(id, client_id)`.
Null origin is legal for personal workouts; non-null origin must belong to the
same client. Preserve assignment origin through plan reads, session completion
and session edits. Do not bypass the trainer gateway to manufacture assignments.

## Views

View nullability in `information_schema` is conservative: PostgreSQL reports
YES for all columns here, even for expressions that coalesce to zero. Decoders
may use a required value only when its defining expression/source guarantees
it; actual nullable values such as `workout_names` and `weight_lbs` remain
optional. Invalid/missing required fields are decoding failures, not empty data.

| View | Meaning and limits |
|---|---|
| `exercise_bests` | Maximum positive numeric weight per exact exercise name over all sessions |
| `exercise_pr_events` | Strictly greater session top weight than every earlier session; excludes first lift; orders by completed_date, created_at, session_id |
| `daily_summary` | Row for days with food, workouts, supplement logs or weight; **no water-only day**; integer macro/count outputs |
| `supplement_due_from` | Earliest of stack creation date cast by the database and first logged day |
| `weight_monthly` | First and last weight by log_date and entry count, per YYYY-MM |

`daily_summary` has **no** water, fiber, sugar, sodium, burned-calorie,
goal or on-target fields. Its macro arithmetic is
`sum(round(per100 * grams / 100))` using numeric, with integer output casts.
Read water separately and use shared Decimal scaling for row-level/unsupported
nutrient totals. Do not duplicate values already defined in the views.

For calendar days without a summary row, the app builds a date spine and reads
`supplement_due_from` for due denominators. A missing summary row is only a
successful absence when the view read succeeded. The current due-start rule
uses server `created_at::date`; do not substitute a client-timezone cast.

Exact definitions are included below so this reference is self-contained.
These are snapshots to compare with the live database, not migrations to apply.

### daily_summary

Options: `security_invoker=true`.

| Column | PostgreSQL type | Catalog nullable |
|---|---|---|
| `user_id` | `uuid` | YES |
| `day` | `date` | YES |
| `kcal` | `int4` | YES |
| `protein_g` | `int4` | YES |
| `carbs_g` | `int4` | YES |
| `fat_g` | `int4` | YES |
| `food_rows` | `int4` | YES |
| `workout_count` | `int4` | YES |
| `workout_names` | `text` | YES |
| `supps_taken` | `int4` | YES |
| `supps_due` | `int4` | YES |
| `weight_lbs` | `numeric` | YES |

```sql
WITH food AS (
         SELECT food_log.user_id,
            food_log.logged_date AS day,
            sum(round(COALESCE(food_log.per100_cal, 0::numeric) * COALESCE(food_log.grams, 0::numeric) / 100::numeric)) AS kcal,
            sum(round(COALESCE(food_log.per100_protein, 0::numeric) * COALESCE(food_log.grams, 0::numeric) / 100::numeric)) AS protein_g,
            sum(round(COALESCE(food_log.per100_carbs, 0::numeric) * COALESCE(food_log.grams, 0::numeric) / 100::numeric)) AS carbs_g,
            sum(round(COALESCE(food_log.per100_fat, 0::numeric) * COALESCE(food_log.grams, 0::numeric) / 100::numeric)) AS fat_g,
            count(*) AS food_rows
           FROM food_log
          GROUP BY food_log.user_id, food_log.logged_date
        ), workouts AS (
         SELECT workout_sessions.user_id,
            workout_sessions.completed_date AS day,
            count(*) AS workout_count,
            string_agg(COALESCE(workout_sessions.workout_name, ''::text), ', '::text ORDER BY workout_sessions.created_at) AS workout_names
           FROM workout_sessions
          GROUP BY workout_sessions.user_id, workout_sessions.completed_date
        ), supps AS (
         SELECT supplement_log.user_id,
            supplement_log.log_date AS day,
            count(*) FILTER (WHERE supplement_log.taken) AS supps_taken
           FROM supplement_log
          GROUP BY supplement_log.user_id, supplement_log.log_date
        ), weight AS (
         SELECT body_weight_log.user_id,
            body_weight_log.log_date AS day,
            body_weight_log.weight_lbs
           FROM body_weight_log
        ), days AS (
         SELECT food.user_id,
            food.day
           FROM food
        UNION
         SELECT workouts.user_id,
            workouts.day
           FROM workouts
        UNION
         SELECT supps.user_id,
            supps.day
           FROM supps
        UNION
         SELECT weight.user_id,
            weight.day
           FROM weight
        )
 SELECT d.user_id,
    d.day,
    COALESCE(f.kcal, 0::numeric)::integer AS kcal,
    COALESCE(f.protein_g, 0::numeric)::integer AS protein_g,
    COALESCE(f.carbs_g, 0::numeric)::integer AS carbs_g,
    COALESCE(f.fat_g, 0::numeric)::integer AS fat_g,
    COALESCE(f.food_rows, 0::bigint)::integer AS food_rows,
    COALESCE(w.workout_count, 0::bigint)::integer AS workout_count,
    w.workout_names,
    COALESCE(s.supps_taken, 0::bigint)::integer AS supps_taken,
    (( SELECT count(*) AS count
           FROM supplement_due_from df
          WHERE df.user_id = d.user_id AND df.due_from <= d.day))::integer AS supps_due,
    wt.weight_lbs
   FROM days d
     LEFT JOIN food f ON f.user_id = d.user_id AND f.day = d.day
     LEFT JOIN workouts w ON w.user_id = d.user_id AND w.day = d.day
     LEFT JOIN supps s ON s.user_id = d.user_id AND s.day = d.day
     LEFT JOIN weight wt ON wt.user_id = d.user_id AND wt.day = d.day;
```

### exercise_bests

Options: `security_invoker=true`.

| Column | PostgreSQL type | Catalog nullable |
|---|---|---|
| `user_id` | `uuid` | YES |
| `name` | `text` | YES |
| `best_lbs` | `numeric` | YES |

```sql
SELECT w.user_id,
    e.value ->> 'name'::text AS name,
    max((s.value ->> 'weight'::text)::numeric) AS best_lbs
   FROM workout_sessions w,
    LATERAL jsonb_array_elements(w.exercises) e(value),
    LATERAL jsonb_array_elements(COALESCE(e.value -> 'setsData'::text, '[]'::jsonb)) s(value)
  WHERE ((s.value ->> 'weight'::text)::numeric) > 0::numeric
  GROUP BY w.user_id, (e.value ->> 'name'::text);
```

### exercise_pr_events

Options: `security_invoker=true`.

| Column | PostgreSQL type | Catalog nullable |
|---|---|---|
| `user_id` | `uuid` | YES |
| `session_id` | `uuid` | YES |
| `completed_date` | `date` | YES |
| `name` | `text` | YES |
| `lbs` | `numeric` | YES |
| `prev_best` | `numeric` | YES |

```sql
WITH lifts AS (
         SELECT w.user_id,
            w.id AS session_id,
            w.completed_date,
            w.created_at,
            e.value ->> 'name'::text AS name,
            max((s.value ->> 'weight'::text)::numeric) AS top_lbs
           FROM workout_sessions w,
            LATERAL jsonb_array_elements(w.exercises) e(value),
            LATERAL jsonb_array_elements(COALESCE(e.value -> 'setsData'::text, '[]'::jsonb)) s(value)
          WHERE jsonb_typeof(w.exercises) = 'array'::text AND ((s.value ->> 'weight'::text)::numeric) > 0::numeric
          GROUP BY w.user_id, w.id, w.completed_date, w.created_at, (e.value ->> 'name'::text)
        ), ranked AS (
         SELECT lifts.user_id,
            lifts.session_id,
            lifts.completed_date,
            lifts.created_at,
            lifts.name,
            lifts.top_lbs,
            max(lifts.top_lbs) OVER (PARTITION BY lifts.user_id, lifts.name ORDER BY lifts.completed_date, lifts.created_at, lifts.session_id ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING) AS prev_best
           FROM lifts
        )
 SELECT user_id,
    session_id,
    completed_date,
    name,
    top_lbs AS lbs,
    prev_best
   FROM ranked
  WHERE prev_best IS NOT NULL AND top_lbs > prev_best;
```

### supplement_due_from

Options: `security_invoker=true`.

| Column | PostgreSQL type | Catalog nullable |
|---|---|---|
| `user_id` | `uuid` | YES |
| `supplement_id` | `uuid` | YES |
| `name` | `text` | YES |
| `due_from` | `date` | YES |

```sql
SELECT s.user_id,
    s.id AS supplement_id,
    s.name,
    LEAST(s.created_at::date, min(l.log_date)) AS due_from
   FROM supplement_stack s
     LEFT JOIN supplement_log l ON l.supplement_id = s.id
  GROUP BY s.user_id, s.id, s.name, s.created_at;
```

### weight_monthly

Options: `security_invoker=true`.

| Column | PostgreSQL type | Catalog nullable |
|---|---|---|
| `user_id` | `uuid` | YES |
| `month` | `text` | YES |
| `first_lbs` | `numeric` | YES |
| `last_lbs` | `numeric` | YES |
| `entries` | `int4` | YES |

```sql
SELECT user_id,
    to_char(log_date::timestamp with time zone, 'YYYY-MM'::text) AS month,
    (array_agg(weight_lbs ORDER BY log_date))[1] AS first_lbs,
    (array_agg(weight_lbs ORDER BY log_date DESC))[1] AS last_lbs,
    count(*)::integer AS entries
   FROM body_weight_log
  GROUP BY user_id, (to_char(log_date::timestamp with time zone, 'YYYY-MM'::text));
```

## TrainerHQ-owned objects

TrainerHQ's `trainer_*`/`client_*` tables and `trainerhq_private` schema
remain separately owned. This snapshot is scoped to the common WiFit base
tables and views; it does not pretend to specify all trainer command DTOs.
The approved sister-app requirement means changes to common shapes need
coordinated compatibility tests and shared-package adoption in both app targets.

Neither iOS app embeds a service-role key. Personal table operations use the
current user's JWT; trainer/client-consent operations use the gateway contract.
Consult [PROJECT_CONTEXT.md](../PROJECT_CONTEXT.md) before any data changes and
update it in the same commit as any future schema change.

## Reverification queries

Use the same explicit relation allowlist; do not treat every object in this
shared project as WiFit-owned.

```sql
select c.table_name, c.column_name, c.data_type, c.udt_name,
       c.is_nullable, c.column_default
from information_schema.columns c
where c.table_schema = 'public'
  and c.table_name in (
    'profiles','food_log','custom_foods','workout_sessions','workout_plans',
    'supplement_stack','supplement_log','water_log','body_weight_log',
    'ai_coach_usage','workouts','exercise_bests','exercise_pr_events',
    'daily_summary','supplement_due_from','weight_monthly')
order by c.table_name, c.ordinal_position;

select c.relname, k.conname, k.contype, pg_get_constraintdef(k.oid)
from pg_constraint k
join pg_class c on c.oid = k.conrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in (
    'profiles','food_log','custom_foods','workout_sessions','workout_plans',
    'supplement_stack','supplement_log','water_log','body_weight_log',
    'ai_coach_usage','workouts')
order by c.relname, k.conname;

select c.relname, c.reloptions, pg_get_viewdef(c.oid, true)
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('exercise_bests','exercise_pr_events','daily_summary',
                   'supplement_due_from','weight_monthly')
order by c.relname;

select c.relname, c.relrowsecurity, c.reloptions,
       has_table_privilege('anon', c.oid, 'SELECT') as anon_select,
       has_table_privilege('authenticated', c.oid, 'SELECT') as authenticated_select
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in (
    'profiles','food_log','custom_foods','workout_sessions','workout_plans',
    'supplement_stack','supplement_log','water_log','body_weight_log',
    'ai_coach_usage','workouts','exercise_bests','exercise_pr_events',
    'daily_summary','supplement_due_from','weight_monthly')
order by c.relname;
```
