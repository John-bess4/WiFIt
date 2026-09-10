# WiFit — row ownership, parent integrity and verification scope

This reference combines the historical 2026-09-09 browser probe recorded below
with the 2026-09-10 live rollback-only PostgreSQL contract test. They are
different evidence: management access normally bypasses RLS; the newer SQL
explicitly sets `authenticated`/`anon` roles and request claims. It exercises
database policies, not GoTrue token validation, PostgREST or Swift auth.

## The one rule

Every WiFit table has RLS enabled. Ten tables have one owner `ALL` policy;
`ai_coach_usage` has separate own-row INSERT/SELECT policies. The owner column
is `user_id`, except `profiles`, where it is `id`. These policies restrict row
ownership. **They do not, by themselves, ensure that a referenced parent row has
the same owner.** The supplement-parent gap below is confirmed and still open.

| Table | Policy | Cmd | Roles | USING / WITH CHECK |
|---|---|---|---|---|
| profiles | Users can manage their own profile | ALL | public | `auth.uid() = id` |
| food_log | Users can manage their own food log | ALL | public | `auth.uid() = user_id` |
| custom_foods | …their own custom foods | ALL | public | `auth.uid() = user_id` |
| workout_sessions | …their own workout sessions | ALL | public | `auth.uid() = user_id` |
| workout_plans | users manage own plans | ALL | public | `auth.uid() = user_id` |
| supplement_stack | …their own supplement stack | ALL | public | `auth.uid() = user_id` |
| supplement_log | …their own supplement log | ALL | public | `auth.uid() = user_id` |
| water_log | …their own water log | ALL | public | `auth.uid() = user_id` |
| body_weight_log | …their own weight log | ALL | public | `auth.uid() = user_id` |
| workouts (legacy) | …their own workouts | ALL | public | `auth.uid() = user_id` |
| **ai_coach_usage** | ai_coach_usage_insert_own | **INSERT** | authenticated | CHECK `auth.uid() = user_id` |
| ai_coach_usage | ai_coach_usage_select_own | **SELECT** | authenticated | USING `auth.uid() = user_id` |

Notes for the port:

- **`ALL` policy, role `public`**: one policy covers SELECT/INSERT/UPDATE/DELETE.
  Role `public` includes `authenticated` and `anon`; `auth.uid()` is null for
  `anon`, so an anonymous request matches no rows and can write none — anon is
  effectively locked out without a separate deny policy.
- **`ai_coach_usage` is deliberately asymmetric**: INSERT and SELECT of own rows,
  and **no UPDATE, no DELETE policy at all**. A user cannot clear or backdate
  their usage to reset the rate limit. The Swift clients must not expect to
  delete usage rows; retention cleanup runs as `postgres` (bypasses RLS).
- **WITH CHECK on mutable owner rows**: spoofing the row's owner is rejected
  with `42501`; updating/deleting a row hidden by RLS affects zero rows. An
  own-user log with a foreign supplement parent is a distinct case below.

## Views

`exercise_bests`, `exercise_pr_events`, `daily_summary`, `supplement_due_from`,
`weight_monthly`: **`security_invoker=true`** (they run with the caller's
privileges, so the underlying tables' RLS applies — a caller sees only their own
aggregates) and **`GRANT SELECT TO authenticated` only** (verified; nothing to
`anon`, no INSERT/UPDATE/DELETE). A Swift client reads them exactly like a table,
scoped by the calling role and owner policies.

## Live PostgreSQL contract, 2026-09-10

[fitdatakit_contract.sql](../../supabase/tests/fitdatakit_contract.sql) ran
against `vghqqksbjpgdzmvfmnru` and returned **156/156 assertions** with verified
rollback of both synthetic auth users, every synthetic base-table row and
synthetic view result. It uses real fixture A/B users and populated records in
all 11 WiFit tables and five views, so a forbidden read/write cannot pass merely
because the other owner does not exist. Checks include foreign-owner insert
denial, zero-row foreign update/delete, ownership reassignment denial, anonymous
base-table exclusion/view privilege denial, own usage immutability, valid
same-owner upserts and preserved row UUIDs.

These checks confirm PostgreSQL policy behavior under simulated request claims.
They are not a live JWT, browser or Swift integration test, and they do not make
the separate failed parent-integrity diagnostic pass.

## Confirmed supplement-parent gap — proposal not applied

The contract's separate `supplement_parent_owner_enforced` result was **false**.
Fixture A inserted and re-read an A-owned `supplement_log` whose `supplement_id`
was B's real stack UUID. Its row owner satisfied RLS. The existing
`FOREIGN KEY (supplement_id) REFERENCES supplement_stack(id)` checks existence,
not equality between the log and stack owners. The diagnostic row was rolled
back immediately. The result proves a foreign-parent reference is possible;
it does not prove a read of B's supplement data. It can also occupy the shared
supplement/date unique key before the legitimate owner logs that date.

The [unapplied additive proposal](../../supabase/proposals/supplement_parent_ownership.sql)
adds `supplement_stack UNIQUE (id,user_id)` and a matching
`supplement_log FOREIGN KEY (supplement_id,user_id) REFERENCES
supplement_stack(id,user_id) ON DELETE CASCADE`. Row RLS and the existing daily
`UNIQUE (supplement_id,log_date)` remain. This binds parent identity and owner
for all clients without depending on an app-side pre-read. The proposal aborts
before DDL if its count-only preflight finds missing/mismatched existing parents
and never deletes or reassigns them. Rollout prerequisites and verification are
in [GEN2_PHASE_ONE.md](../GEN2_PHASE_ONE.md); no production fix has been applied.

## Historical JWT probe (recorded 2026-09-09; not rerun in phase one)

```
me = 50bc7457-…-c467283a11e6      fake = 00000000-0000-4000-8000-000000000000
GET  food_log?user_id=eq.<me>        → 200, 5 rows        own data visible
GET  food_log?user_id=eq.<fake>      → 200, 0 rows        fake owner has no returned rows
GET  food_log            (NO filter) → 200, 5 rows        RLS scopes to me — NOT the whole table
POST food_log {user_id:<fake>, …}    → 403, code 42501    WITH CHECK blocks a spoofed owner
GET  exercise_bests                  → 200 (own rows only) security_invoker scoping works
GET  food_log            (no JWT)    → 200, 0 rows        anon sees nothing
```

This historical probe records the original browser results; its nonexistent
foreign UUID is not by itself proof of exclusion of another user's real rows.
The newer SQL test supplies real synthetic owners for that database assertion.
Native acceptance still needs real JWT/PostgREST/Swift execution with dedicated
test users and both same-owner and foreign-owner negative cases. Owner filters
in a client remain useful for intent but cannot substitute for server RLS and
the proposed parent-integrity constraint.
