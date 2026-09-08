-- Applied 2026-09-07 via the Supabase MCP (recorded after the fact, like the others).
-- #28: PR *events* become a read, the way exercise_bests made the PR *baseline*
-- a read. workout_sessions.prs and exercises[].isPR were the app's last
-- computed-and-stored values — decided at finish time against whatever `bests`
-- said then, and never revisited. This view derives them from setsData:
--
--   a session's top weight for an exercise is a PR when it beats the max over
--   ALL earlier sessions (ordered completed_date, created_at, id). Strictly
--   greater: a tie is not a PR. The first time an exercise is ever lifted is
--   not a PR (no earlier session to beat) — the same rule computePRs applied,
--   which is what keeps a first real session from showing 4 phantom PRs.
--   Sets with weight 0 (bodyweight) never count.
--
-- Verified against a seeded 5-session history: Bench 100 → 110 (PR) → 105 →
-- 110 same day (tie, no) → 120 later that day (PR); Squat 200 → 190 → 200 (tie,
-- no); Deadlift 300 first-ever (no) → 315 (PR). Exactly those three rows; zero
-- sessions → zero rows. Seeds deleted afterwards.
--
-- The client stops WRITING prs/isPR with this migration; the column is dropped
-- in a later one once nothing reads it (a column drop is not reversible).

create or replace view public.exercise_pr_events
with (security_invoker = true) as
with lifts as (
  select w.user_id, w.id as session_id, w.completed_date, w.created_at,
         e->>'name' as name, max((s->>'weight')::numeric) as top_lbs
  from public.workout_sessions w,
       jsonb_array_elements(w.exercises) e,
       jsonb_array_elements(coalesce(e->'setsData','[]'::jsonb)) s
  where jsonb_typeof(w.exercises) = 'array' and (s->>'weight')::numeric > 0
  group by w.user_id, w.id, w.completed_date, w.created_at, e->>'name'),
ranked as (
  select *, max(top_lbs) over (partition by user_id, name
                               order by completed_date, created_at, session_id
                               rows between unbounded preceding and 1 preceding) as prev_best
  from lifts)
select user_id, session_id, completed_date, name, top_lbs as lbs, prev_best
from ranked
where prev_best is not null and top_lbs > prev_best;

-- Grants: same discipline as the other views. The explicit revoke is what makes
-- a replay land the same (default privileges grant ALL to authenticated).
-- verify: select grantee, privilege_type from information_schema.role_table_grants
--         where table_name='exercise_pr_events';  -> authenticated: SELECT only
revoke all on public.exercise_pr_events from public;
revoke all on public.exercise_pr_events from anon;
revoke all on public.exercise_pr_events from authenticated;
grant select on public.exercise_pr_events to authenticated;
