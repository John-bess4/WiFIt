-- saveWorkoutSession (src/App.jsx) has always sent a `prs` key in its
-- workout_sessions insert, but the column did not exist. PostgREST rejected
-- every insert with 400 PGRST204 and sb.insert swallowed it, so no workout
-- session was ever persisted.
ALTER TABLE workout_sessions
  ADD COLUMN prs jsonb NOT NULL DEFAULT '[]'::jsonb;
