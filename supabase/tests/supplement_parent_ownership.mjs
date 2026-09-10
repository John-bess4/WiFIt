// Isolated PostgreSQL test of the exact proposal, not a production migration.
// Usage: /path/to/node22 supplement_parent_ownership.mjs /absolute/path/to/@electric-sql/pglite/dist/index.js
// The dependency is supplied explicitly and is not added to the app's package.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

assert.equal(Number(process.versions.node.split('.')[0]), 22, 'Run this reproducible check with Node 22');
assert.ok(process.argv[2], 'Supply the absolute PGlite dist/index.js module path');
const moduleURL = pathToFileURL(resolve(process.argv[2]));
const { PGlite } = await import(moduleURL.href);
const { version: pgliteVersion } = JSON.parse(await readFile(new URL('../package.json', moduleURL), 'utf8'));
const proposal = await readFile(new URL('../proposals/supplement_parent_ownership.sql', import.meta.url), 'utf8');

// Minimal verified current schema for these two tables and their auth FK.
// This is not a full project clone, policy/trigger reproduction, or load test.
const baseline = `
CREATE SCHEMA auth;
CREATE TABLE auth.users (id uuid PRIMARY KEY);
CREATE TABLE public.supplement_stack (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  CONSTRAINT supplement_stack_pkey PRIMARY KEY (id),
  CONSTRAINT supplement_stack_user_id_fkey FOREIGN KEY (user_id)
    REFERENCES auth.users(id) ON DELETE CASCADE
);
CREATE TABLE public.supplement_log (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  supplement_id uuid NOT NULL,
  log_date date NOT NULL DEFAULT CURRENT_DATE,
  taken boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT supplement_log_pkey PRIMARY KEY (id),
  CONSTRAINT supplement_log_user_id_fkey FOREIGN KEY (user_id)
    REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT supplement_log_supplement_id_fkey FOREIGN KEY (supplement_id)
    REFERENCES public.supplement_stack(id) ON DELETE CASCADE,
  CONSTRAINT supplement_log_supplement_id_log_date_key UNIQUE (supplement_id,log_date)
);
INSERT INTO auth.users (id) VALUES
 ('00000000-0000-4000-8000-00000000a001'),
 ('00000000-0000-4000-8000-00000000b001');
INSERT INTO public.supplement_stack (id,user_id,name) VALUES
 ('00000000-0000-4000-8000-00000000a011','00000000-0000-4000-8000-00000000a001','A'),
 ('00000000-0000-4000-8000-00000000b011','00000000-0000-4000-8000-00000000b001','B');
INSERT INTO public.supplement_log (id,user_id,supplement_id,log_date,taken) VALUES
 ('00000000-0000-4000-8000-00000000a021','00000000-0000-4000-8000-00000000a001',
  '00000000-0000-4000-8000-00000000a011',DATE '2099-01-02',false);
`;
const constraintQuery = `
SELECT conname, convalidated, pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE (conrelid='public.supplement_stack'::regclass AND conname='supplement_stack_id_user_id_key')
   OR (conrelid='public.supplement_log'::regclass AND conname='supplement_log_supplement_owner_fkey')
ORDER BY conname`;
let checks = 0;
const check = (actual, expected, label) => {
  assert.deepEqual(actual, expected, label);
  checks += 1;
};
async function expectedError(action, code, messagePattern, label) {
  let observed;
  try { await action(); } catch (error) { observed = error; }
  assert.ok(observed, label + ': expected PostgreSQL failure');
  assert.equal(observed.code, code, label + ': exact SQLSTATE');
  if (messagePattern) assert.match(observed.message, messagePattern, label + ': expected cause');
  checks += 1;
}

const clean = new PGlite();
try {
  await clean.exec(baseline);
  check((await clean.query(constraintQuery)).rows, [], 'New constraints absent in current baseline');
  await clean.exec(proposal);
  const constraints = (await clean.query(constraintQuery)).rows;
  check(constraints.length, 2, 'Exact proposal adds both constraints');
  check(constraints.every(row => row.convalidated), true, 'Both constraints validate existing data');
  check(constraints.find(row => row.conname === 'supplement_log_supplement_owner_fkey').definition,
    'FOREIGN KEY (supplement_id, user_id) REFERENCES supplement_stack(id, user_id) ON DELETE CASCADE',
    'Composite FK binds owner and preserves cascade');
  check((await clean.query(`SELECT pg_get_constraintdef(oid) AS definition FROM pg_constraint
    WHERE conrelid='public.supplement_log'::regclass AND conname='supplement_log_supplement_id_log_date_key'`)).rows,
    [{ definition: 'UNIQUE (supplement_id, log_date)' }], 'Daily conflict target unchanged');
  const upsert = await clean.query(`INSERT INTO public.supplement_log (user_id,supplement_id,log_date,taken)
    VALUES ('00000000-0000-4000-8000-00000000a001','00000000-0000-4000-8000-00000000a011',DATE '2099-01-02',true)
    ON CONFLICT (supplement_id,log_date) DO UPDATE SET taken=excluded.taken RETURNING id,taken`);
  check(upsert.rows, [{ id: '00000000-0000-4000-8000-00000000a021', taken: true }],
    'Second same-day own upsert preserves UUID and toggles state');
  check((await clean.query('SELECT count(*)::integer AS count FROM public.supplement_log')).rows,
    [{ count: 1 }], 'Upsert does not duplicate the day');
  await expectedError(() => clean.exec(`INSERT INTO public.supplement_log (user_id,supplement_id,log_date,taken)
    VALUES ('00000000-0000-4000-8000-00000000a001','00000000-0000-4000-8000-00000000b011',DATE '2099-01-03',true)`),
    '23503', /supplement_log_supplement_owner_fkey/, 'Foreign-parent insert rejected');
  await expectedError(() => clean.exec(`UPDATE public.supplement_log
    SET supplement_id='00000000-0000-4000-8000-00000000b011'
    WHERE id='00000000-0000-4000-8000-00000000a021'`),
    '23503', /supplement_log_supplement_owner_fkey/, 'Foreign-parent update rejected');
  await expectedError(() => clean.exec(`UPDATE public.supplement_log
    SET user_id='00000000-0000-4000-8000-00000000b001'
    WHERE id='00000000-0000-4000-8000-00000000a021'`),
    '23503', /supplement_log_supplement_owner_fkey/, 'Changing child owner cannot bypass composite FK');
  check((await clean.query(`SELECT user_id,supplement_id,taken FROM public.supplement_log
    WHERE id='00000000-0000-4000-8000-00000000a021'`)).rows,
    [{ user_id: '00000000-0000-4000-8000-00000000a001', supplement_id: '00000000-0000-4000-8000-00000000a011', taken: true }],
    'Rejected writes leave valid log intact');
  await expectedError(() => clean.exec(proposal), 'P0001', /constraint name already exists/, 'Reapplication stops for review');
  await clean.exec('ROLLBACK');
  check((await clean.query(constraintQuery)).rows, constraints, 'Rejected reapplication preserves applied constraints');
  await clean.exec(`DELETE FROM public.supplement_stack WHERE id='00000000-0000-4000-8000-00000000a011'`);
  check((await clean.query('SELECT count(*)::integer AS count FROM public.supplement_log')).rows,
    [{ count: 0 }], 'Deleting own parent cascades log row');
  check((await clean.query('SELECT id FROM public.supplement_stack')).rows,
    [{ id: '00000000-0000-4000-8000-00000000b011' }], 'Cascade leaves other parent untouched');
} finally {
  await clean.close();
}

const dirty = new PGlite();
try {
  await dirty.exec(baseline);
  await dirty.exec(`INSERT INTO public.supplement_log (id,user_id,supplement_id,log_date,taken)
    VALUES ('00000000-0000-4000-8000-00000000a022','00000000-0000-4000-8000-00000000a001',
      '00000000-0000-4000-8000-00000000b011',DATE '2099-01-03',true)`);
  const before = (await dirty.query('SELECT * FROM public.supplement_log ORDER BY id')).rows;
  check(before.length, 2, 'Current minimal schema accepts cross-owner fixture');
  await expectedError(() => dirty.exec(proposal), 'P0001', /Ownership preflight failed: missing parents 0, mismatched owners 1/,
    'Existing owner mismatch aborts before DDL');
  await dirty.exec('ROLLBACK');
  check((await dirty.query(constraintQuery)).rows, [], 'Failed preflight leaves no new constraint');
  check((await dirty.query('SELECT * FROM public.supplement_log ORDER BY id')).rows, before,
    'Failed preflight preserves all original rows including mismatch');
  check((await dirty.query('SELECT count(*)::integer AS count FROM public.supplement_stack')).rows,
    [{ count: 2 }], 'Failed preflight preserves both parents');
} finally {
  await dirty.close();
}

check(checks, 20, 'All 20 behavioral checks ran');
console.log(JSON.stringify({ result: 'passed', behavioral_checks: 20, node: process.versions.node,
  pglite: pgliteVersion, proposal: 'supabase/proposals/supplement_parent_ownership.sql',
  scope: 'isolated minimal PostgreSQL schema; not a full project clone, load test, live JWT or production deployment',
  production_ddl_applied: false }, null, 2));
