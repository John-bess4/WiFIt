-- Per-user rate limiting for /api/coach. One row per accepted request.
--
-- Edge Functions run in ephemeral, concurrent, per-region isolates, so an
-- in-memory counter would reset constantly and enforce nothing. This table is
-- the shared state. It is co-located with the function (Supabase us-east-1 /
-- Vercel iad1), so the windowed count costs single-digit milliseconds.
create table if not exists coach_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- The windowed count runs on EVERY /api/coach request, so this index is not
-- optional: without it the count degrades to a sequential scan as rows accrue.
create index if not exists coach_usage_user_created_idx
  on coach_usage (user_id, created_at desc);

alter table coach_usage enable row level security;

-- Insert only your own rows.
create policy coach_usage_insert_own on coach_usage
  for insert to authenticated
  with check (auth.uid() = user_id);

-- Read only your own rows.
create policy coach_usage_select_own on coach_usage
  for select to authenticated
  using (auth.uid() = user_id);

-- Deliberately NO update or delete policy. With RLS enabled, a command with no
-- matching policy is denied, so a user cannot clear or backdate their own usage
-- rows to reset the rate limit. That is what lets the Edge Function authenticate
-- these queries with the caller's own JWT instead of a service-role key.
--
-- Verified after applying, as the authenticated role with a real user's claim:
--   INSERT + SELECT -> 2 rows visible
--   DELETE          -> 0 rows removed
--   UPDATE          -> 0 rows changed
--
-- Retention: only the last 24h is ever read; older rows are dead weight. No
-- cleanup job yet. When one is needed, a nightly pg_cron
--   delete from coach_usage where created_at < now() - interval '2 days';
-- bounds the table permanently and runs as postgres, so RLS does not block it.
