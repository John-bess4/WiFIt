-- PROPOSAL ONLY — NOT APPLIED. This file is not a migration.
-- Decision: enforce supplement-log parent ownership in the shared database.
-- 2026-09-10: fitdatakit_contract.sql passed 156 rollback-only assertions,
-- but its separate parent diagnostic was false: A could insert an A-owned
-- supplement_log referencing B's existing supplement_stack UUID.
--
-- Current schema: all four participating identity columns are NOT NULL uuid.
-- supplement_stack has PRIMARY KEY (id), but no UNIQUE (id,user_id).
-- supplement_log has FK (supplement_id) -> supplement_stack(id) ON DELETE
-- CASCADE and UNIQUE (supplement_id,log_date). Owner RLS alone does not
-- compare the child's user_id with the parent's user_id.
--
-- Apply only after recording a current successful backup/recovery point for
-- project vghqqksbjpgdzmvfmnru and testing this exact change in an isolated
-- database. This task has not verified a current restorable backup.
-- Convert the reviewed proposal into a migration using the project's normal
-- migration-creation workflow before deployment; do not run all proposals.
--
-- The transaction locks only these two WiFit tables while the preflight and
-- validated constraints run. It aborts before DDL if any missing/mismatched
-- parent exists; it never deletes, relabels, reparents or repairs stored rows.
-- It retains the old FK, row IDs, RLS, existing daily conflict target and
-- ON DELETE CASCADE. Correct same-owner inserts/upserts keep their wire shape.
-- No TrainerHQ-owned objects are changed.
-- Isolated evidence: supplement_parent_ownership.mjs passed 20 behavioral checks
-- with Node 22.23.1/PGlite 0.5.8 on a minimal two-table schema. This is not a full
-- project clone, production deployment, backup verification or load test.

BEGIN;

-- Fail promptly rather than waiting indefinitely for active logging traffic.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
LOCK TABLE public.supplement_stack, public.supplement_log IN ACCESS EXCLUSIVE MODE;

DO $supplement_owner_preflight$
DECLARE
  missing_parent_count bigint;
  mismatched_owner_count bigint;
BEGIN
  IF (SELECT count(*) FROM information_schema.columns
      WHERE table_schema='public' AND udt_name='uuid' AND is_nullable='NO'
        AND ((table_name='supplement_stack' AND column_name IN ('id','user_id'))
          OR (table_name='supplement_log' AND column_name IN ('supplement_id','user_id')))) <> 4
  THEN
    RAISE EXCEPTION 'Supplement ownership proposal requires the verified four NOT NULL uuid columns';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid='public.supplement_log'::regclass
      AND conname='supplement_log_supplement_id_fkey'
      AND contype='f' AND confrelid='public.supplement_stack'::regclass
      AND confdeltype='c' AND convalidated
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid='public.supplement_log'::regclass
      AND conname='supplement_log_supplement_id_log_date_key'
      AND contype='u'
      AND pg_get_constraintdef(oid)='UNIQUE (supplement_id, log_date)'
  ) THEN
    RAISE EXCEPTION 'Existing supplement cascade/conflict contract changed; review before applying';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE (conrelid='public.supplement_stack'::regclass
           AND conname='supplement_stack_id_user_id_key')
       OR (conrelid='public.supplement_log'::regclass
           AND conname='supplement_log_supplement_owner_fkey')
  ) THEN
    RAISE EXCEPTION 'Proposed ownership constraint name already exists; inspect state instead of reapplying';
  END IF;

  -- Count-only preflight: no user IDs, supplement names or row bodies emitted.
  SELECT count(*) FILTER (WHERE parent.id IS NULL),
         count(*) FILTER (WHERE parent.id IS NOT NULL
                          AND child.user_id IS DISTINCT FROM parent.user_id)
    INTO missing_parent_count, mismatched_owner_count
  FROM public.supplement_log child
  LEFT JOIN public.supplement_stack parent ON parent.id=child.supplement_id;

  RAISE NOTICE 'Supplement ownership preflight: missing parents %, mismatched owners %',
    missing_parent_count, mismatched_owner_count;
  IF missing_parent_count <> 0 OR mismatched_owner_count <> 0 THEN
    RAISE EXCEPTION 'Ownership preflight failed: missing parents %, mismatched owners %. No schema or data repair applied.',
      missing_parent_count, mismatched_owner_count;
  END IF;
END
$supplement_owner_preflight$;

-- A composite FK needs a matching unique parent key. The existing id PK stays.
ALTER TABLE public.supplement_stack
  ADD CONSTRAINT supplement_stack_id_user_id_key UNIQUE (id,user_id);

-- Validates existing rows immediately and enforces both columns on every write.
-- Retain the original single-column FK; removing it is not needed for this fix.
ALTER TABLE public.supplement_log
  ADD CONSTRAINT supplement_log_supplement_owner_fkey
  FOREIGN KEY (supplement_id,user_id)
  REFERENCES public.supplement_stack (id,user_id)
  ON DELETE CASCADE;

SELECT conrelid::regclass AS table_name, conname, convalidated,
       pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE (conrelid='public.supplement_stack'::regclass
       AND conname='supplement_stack_id_user_id_key')
   OR (conrelid='public.supplement_log'::regclass
       AND conname='supplement_log_supplement_owner_fkey')
ORDER BY conrelid::regclass::text, conname;

COMMIT;

-- After application, rerun supabase/tests/fitdatakit_contract.sql:
-- require assertions=expected_assertions=156, verified fixture cleanup AND
-- supplement_parent_owner_enforced=true. The existing diagnostic must become
-- an explicit release gate; asserted_contract_result alone is insufficient.
-- Verify the same-owner second same-day toggle/upsert returns the original UUID and
-- deleting the parent still cascades, then check both app write paths.
-- Record the new constraints in docs/PROJECT_CONTEXT.md and docs/port/SCHEMA.md
-- in the same migration commit. Until that verified deployment, docs retain
-- these constraints as proposed, not part of the live schema snapshot.
