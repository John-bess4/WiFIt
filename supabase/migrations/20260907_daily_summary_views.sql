-- Applied 2026-09-07 via the Supabase MCP (recorded after the fact, like the others).
-- Gate 2 (Progress): the per-day numbers every tab re-derives on the client
-- get one definition in Postgres. Three views, all security_invoker so RLS on
-- the underlying tables applies to the caller; authenticated may SELECT only.
--
--   daily_summary        one row per (user, day) that has ANY data. No date
--                        spine: the client keeps its own and joins by day.
--   supplement_due_from  the first day a supplement counts as due — the earlier
--                        of created_at::date (UTC) and its first log (local
--                        date), so a supplement logged before its UTC creation
--                        date is still due that day. daily_summary.supps_due
--                        and the client's empty-day denominator both use it.
--   weight_monthly       first/last weigh-in per calendar month, all time.
--                        Progress' "best weight change" no longer depends on
--                        how many body_weight_log rows the client happened to
--                        read (it was the oldest 30).
--
-- kcal/macros use the same per-row arithmetic as the client's calc():
-- round(per100 * grams / 100), summed. Postgres computes it in numeric; the
-- client in IEEE doubles, which differ on 21 of 3,996 exact-.5 products
-- (e.g. 32.3 per100 × 500 g = 161.5: numeric → 162, double → 161). The view
-- is the definition; see DECISIONS.md §"daily_summary".
--
-- HARD SWIFT REQUIREMENT, not an observation:
-- All macro arithmetic in the Swift client must use Decimal, not Double.
-- JS doubles disagree with Postgres numeric on exact-.5 products (21 of
-- 3,996 tested; 32.3 × 500 / 100 → 161 in JS, 162 in the view). A Double
-- port reproduces the JS answer and disagrees with daily_summary, so the
-- same day shows different totals depending on which side computed it.
--
-- The JS side is the wrong one and stays wrong until the client reads
-- daily_summary everywhere. Still provisional (do NOT port these):
--   - Home week rail — src/lib/weekSummary.js reduceWeekRows
--   - Calendar month — CalendarTab's per-day cal bucket
--   - calc() / totals() — today's meals on Home and Food

create or replace view public.supplement_due_from
with (security_invoker = true) as
select s.user_id, s.id as supplement_id, s.name,
       least(s.created_at::date, min(l.log_date)) as due_from
from public.supplement_stack s
left join public.supplement_log l on l.supplement_id = s.id
group by s.user_id, s.id, s.name, s.created_at;

create or replace view public.daily_summary
with (security_invoker = true) as
with food as (
  select user_id, logged_date as day,
    sum(round(coalesce(per100_cal,0)     * coalesce(grams,0) / 100)) as kcal,
    sum(round(coalesce(per100_protein,0) * coalesce(grams,0) / 100)) as protein_g,
    sum(round(coalesce(per100_carbs,0)   * coalesce(grams,0) / 100)) as carbs_g,
    sum(round(coalesce(per100_fat,0)     * coalesce(grams,0) / 100)) as fat_g,
    count(*) as food_rows
  from public.food_log group by 1, 2),
workouts as (
  select user_id, completed_date as day, count(*) as workout_count,
    string_agg(coalesce(workout_name,''), ', ' order by created_at) as workout_names
  from public.workout_sessions group by 1, 2),
supps as (
  select user_id, log_date as day, count(*) filter (where taken) as supps_taken
  from public.supplement_log group by 1, 2),
weight as (
  select user_id, log_date as day, weight_lbs from public.body_weight_log),
days as (
  select user_id, day from food
  union select user_id, day from workouts
  union select user_id, day from supps
  union select user_id, day from weight)
select d.user_id, d.day,
  coalesce(f.kcal,0)::int      as kcal,
  coalesce(f.protein_g,0)::int as protein_g,
  coalesce(f.carbs_g,0)::int   as carbs_g,
  coalesce(f.fat_g,0)::int     as fat_g,
  coalesce(f.food_rows,0)::int as food_rows,
  coalesce(w.workout_count,0)::int as workout_count,
  w.workout_names,
  coalesce(s.supps_taken,0)::int as supps_taken,
  (select count(*) from public.supplement_due_from df
     where df.user_id = d.user_id and df.due_from <= d.day)::int as supps_due,
  wt.weight_lbs
from days d
left join food     f  on f.user_id  = d.user_id and f.day  = d.day
left join workouts w  on w.user_id  = d.user_id and w.day  = d.day
left join supps    s  on s.user_id  = d.user_id and s.day  = d.day
left join weight   wt on wt.user_id = d.user_id and wt.day = d.day;

create or replace view public.weight_monthly
with (security_invoker = true) as
select user_id, to_char(log_date, 'YYYY-MM') as month,
  (array_agg(weight_lbs order by log_date))[1]      as first_lbs,
  (array_agg(weight_lbs order by log_date desc))[1] as last_lbs,
  count(*)::int as entries
from public.body_weight_log
group by user_id, to_char(log_date, 'YYYY-MM');

-- Grants: same discipline as exercise_bests. Supabase's default privileges
-- grant ALL on new objects in public, so the explicit revoke is what makes a
-- replay land the same. verify:
--   select table_name, grantee, privilege_type from information_schema.role_table_grants
--   where table_name in ('daily_summary','supplement_due_from','weight_monthly');
--   -> authenticated: SELECT only, nothing for anon
revoke all on public.daily_summary, public.supplement_due_from, public.weight_monthly from public;
revoke all on public.daily_summary, public.supplement_due_from, public.weight_monthly from anon;
revoke all on public.daily_summary, public.supplement_due_from, public.weight_monthly from authenticated;
grant select on public.daily_summary, public.supplement_due_from, public.weight_monthly to authenticated;
