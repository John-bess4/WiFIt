# WiFit — RLS, proven from a JWT client (port reference)

**The MCP / management connection bypasses RLS**, so nothing here was read with
it. Every claim below was proven from the browser with Johnny's real Supabase
access token hitting PostgREST directly (2026-09-09). Policy definitions are from
`pg_policies`; effective access is from the JWT probe at the bottom.

## The one rule

Every WiFit table has RLS enabled and exactly one policy: **a user sees and
writes only rows where `auth.uid()` matches the owner column.** There is no
"read others" path anywhere. Owner column is `user_id`, except `profiles` where
it is `id`.

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
- **WITH CHECK on every write**: inserting/updating a row whose owner ≠ you is a
  `42501` (insufficient_privilege), not a silent no-op. See the proof.

## Views

`exercise_bests`, `exercise_pr_events`, `daily_summary`, `supplement_due_from`,
`weight_monthly`: **`security_invoker=true`** (they run with the caller's
privileges, so the underlying tables' RLS applies — a caller sees only their own
aggregates) and **`GRANT SELECT TO authenticated` only** (verified; nothing to
`anon`, no INSERT/UPDATE/DELETE). A Swift client reads them exactly like a table,
scoped automatically to the signed-in user.

## Proof (Johnny's JWT, PostgREST direct, 2026-09-09)

```
me = 50bc7457-…-c467283a11e6      fake = 00000000-0000-4000-8000-000000000000
GET  food_log?user_id=eq.<me>        → 200, 5 rows        own data visible
GET  food_log?user_id=eq.<fake>      → 200, 0 rows        cannot see another user
GET  food_log            (NO filter) → 200, 5 rows        RLS scopes to me — NOT the whole table
POST food_log {user_id:<fake>, …}    → 403, code 42501    WITH CHECK blocks a spoofed owner
GET  exercise_bests                  → 200 (own rows only) security_invoker scoping works
GET  food_log            (no JWT)    → 200, 0 rows        anon sees nothing
```

The unfiltered read returning **exactly the 5 own rows, not the table**, is the
proof that scoping is server-side (RLS), not client filtering — the property the
Swift client inherits for free and must not try to reimplement with WHERE
clauses. Re-run this probe (any signed-in session) after any policy change.
