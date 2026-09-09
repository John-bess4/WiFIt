-- Applied 2026-09-09 via the Supabase MCP (recorded after the fact).
-- #30 resolved: api/coach.js redeployed writing ai_coach_usage directly, so the
-- temporary compatibility view from the rename migration is no longer needed.
-- Verified: with the view gone, a coach request recorded a row in
-- ai_coach_usage (31 -> 32). One name for the table again.
drop view if exists public.coach_usage;
