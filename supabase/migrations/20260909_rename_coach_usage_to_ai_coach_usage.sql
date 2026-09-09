-- Applied 2026-09-09 via the Supabase MCP (recorded after the fact, like the others).
-- "coach" became ambiguous once TrainerHQ started sharing this project (WiFit's
-- AI coach vs TrainerHQ's human trainers). This table is WiFit's rate limiter;
-- api/coach.js reads/writes it. Renamed to ai_coach_usage.
--
-- Expand/contract, because a deployed api/coach.js was still writing the old
-- name: rename, then a TEMPORARY security_invoker view coach_usage -> ai_coach_usage
-- so the live function keeps rate-limiting until it redeploys. DROP the view
-- after api/coach.js ships with ai_coach_usage (tracked in PROJECT_CONTEXT).
alter table public.coach_usage rename to ai_coach_usage;
alter index if exists public.coach_usage_user_created_idx rename to ai_coach_usage_user_created_idx;
alter policy coach_usage_insert_own on public.ai_coach_usage rename to ai_coach_usage_insert_own;
alter policy coach_usage_select_own on public.ai_coach_usage rename to ai_coach_usage_select_own;

create view public.coach_usage with (security_invoker = true) as
  select * from public.ai_coach_usage;
grant select, insert on public.coach_usage to authenticated;
