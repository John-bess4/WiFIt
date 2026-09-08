# Isolated shared-backend migration and authorization tests

Run `npm ci && npm test` from this directory. PGlite 0.5.8 is pinned in its own
lockfile; it does not change WiFit's application dependencies. PostgreSQL runs
entirely in memory; this command never connects to Supabase.

`local-baseline.sql` reconstructs the original WiFit schema from the committed
preflight inventory. Regenerate with `python3 generate-baseline.py` from any
working directory. Storage, Realtime and Auth support here are minimal test
stubs, not implementations of those services. The harness replays the additive
TrainerHQ migrations in order, then the original logging and authorization
suites. SQL fixtures roll back in a subtransaction.

This covers PostgreSQL behavior on PGlite's PG18.3. Live suites also passed on
WiFit PG17.6. HTTP Auth, Storage uploads, Broadcast delivery and APNs must be
verified separately. Do not report this harness as browser or device evidence.

## Live migration provenance

Keep the original WiFit migrations unchanged. Their historical filenames do not
all match the server-generated migration versions, and there is no original
initial-schema migration. The CLI-created TrainerHQ files also have slightly
earlier timestamps than MCP application. The name-to-live-version mapping is
in `../preflight/2026-09-08-integration-results.json`; file contents remain canonical.
Do not blindly run `supabase db push` on this legacy directory or replay old
backfills. Apply reviewed new files once through the Management migration API,
record the actual version, and rerun the logging and authorization suites after
each migration. No second migration owner exists in TrainerHQ.

If application fails, stop and report the exact SQL failure. Run the documented
non-destructive `../rollbacks/trainerhq_disable.sql` if a compatibility shutdown
is needed. It blocks TrainerHQ authorization while retaining WiFit logging and
all data. Never compensate by dropping existing objects or deleting user data.
