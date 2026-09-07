-- Applied 2026-09-07 via the Supabase MCP (recorded after the fact, like the others).
-- F4: the PR baseline moves from a client cache (last 20 sessions, regex over
-- display strings) to a per-exercise max computed in Postgres.

-- 1. Structured set data alongside the display strings. Backfilled ONCE here
--    from the "reps×weightlbs" strings; the app writes setsData directly from
--    now on and the PR baseline never depends on render format again.
update public.workout_sessions w
set exercises = (
  select jsonb_agg(
    case when e.val ? 'setsData' then e.val
    else e.val || jsonb_build_object('setsData', coalesce((
      select jsonb_agg(jsonb_build_object(
        'reps',   nullif((regexp_match(s, '^(\d+(?:\.\d+)?)×'))[1], '')::numeric,
        'weight', nullif((regexp_match(s, '×(\d+(?:\.\d+)?)lbs'))[1], '')::numeric))
      from jsonb_array_elements_text(coalesce(e.val->'sets', '[]'::jsonb)) s
      where jsonb_typeof(e.val->'sets') = 'array'), '[]'::jsonb))
    end order by e.ord)
  from jsonb_array_elements(w.exercises) with ordinality as e(val, ord))
where jsonb_typeof(w.exercises) = 'array' and jsonb_array_length(w.exercises) > 0;

-- 2. Per-exercise best, computed in the database. security_invoker makes the
--    view inherit workout_sessions' RLS: a caller sees only their own rows.
create or replace view public.exercise_bests
with (security_invoker = true) as
select w.user_id, e->>'name' as name, max((s->>'weight')::numeric) as best_lbs
from public.workout_sessions w,
     jsonb_array_elements(w.exercises) e,
     jsonb_array_elements(coalesce(e->'setsData', '[]'::jsonb)) s
where (s->>'weight')::numeric > 0
group by w.user_id, e->>'name';

-- 3. Grants: authenticated SELECT only; anon nothing. The explicit revoke from
--    authenticated matters: Supabase's default privileges grant ALL on new
--    objects in public, and `grant select` alone left INSERT/UPDATE/DELETE in
--    place — caught by querying role_table_grants after the first apply.
revoke all on public.exercise_bests from public;
revoke all on public.exercise_bests from anon;
revoke all on public.exercise_bests from authenticated;
grant select on public.exercise_bests to authenticated;
-- verify: select grantee, privilege_type from information_schema.role_table_grants
--         where table_name='exercise_bests';  -> authenticated: SELECT only
