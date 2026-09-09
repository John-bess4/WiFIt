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

## Private development-export recovery drill

Run `node recovery-drill.mjs /absolute/path/to/private-development-export.json`
from this directory. Keep the export outside Git. The script reconstructs the
original WiFit schema in memory, restores original public records, compares
PostgreSQL-typed values, replays the canonical additive migrations, verifies
original policies, runs all authorization suites, and tests targeted and general
compatibility rollbacks. It rejects unmapped export columns and logs only counts,
checksums, fixed test labels and statuses. Both harnesses explicitly use UTC,
matching Supabase rather than PGlite's host-derived timezone.

The checked development export restored 51 records across 11 original tables.
Original records and owner policies survived both migration replay and rollback.
The report contains no record values. This is **not complete database recovery**:
Auth users are local FK stubs, Storage files and later TrainerHQ data are absent,
and managed Auth/Realtime/Storage services are not restored by PGlite. Before
production, perform a full protected database/Auth export plus independent
Storage-byte backup and a restore drill in an isolated Supabase-compatible
runtime. Do not restore over the shared WiFit project. The current development
waiver remains in effect; no plan upgrade is required for this local drill.
