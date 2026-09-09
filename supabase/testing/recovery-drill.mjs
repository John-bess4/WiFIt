import { PGlite } from '@electric-sql/pglite';
import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';

// In-memory only. This file has no Supabase connection, credentials or network client.
// The private input is never copied to this repository or printed in diagnostics.
const input = process.argv[2];
if (!input || /^[a-z]+:/i.test(input)) throw new Error('Provide a local private development export path.');
const tableNames = ['profiles','custom_foods','food_log','workout_plans','workouts',
  'supplement_stack','supplement_log','body_weight_log','water_log','coach_usage','workout_sessions'];
const db = new PGlite();
let stage = 'read private export';
try {
  // Match Supabase's UTC database timezone; client tracking uses its own explicit timezone.
  await db.exec("set time zone 'UTC'");
  const bytes = await readFile(input);
  const saved = JSON.parse(bytes);
  if (saved.project_ref !== 'vghqqksbjpgdzmvfmnru' || !saved.tables) throw new Error('Wrong export contract.');
  const report = { scope: 'Original WiFit public development records only',
    source_sha256: createHash('sha256').update(bytes).digest('hex'),
    source_exported_at: saved.exported_at, checked_at: new Date().toISOString(),
    database: 'PGlite 0.5.8, PostgreSQL 18.3, in memory', restored_rows: {}, suites: {},
    limitations: ['Auth users are FK-only local stubs; real Auth/session recovery is NOT verified.',
      'Storage object bytes and post-export TrainerHQ records are NOT present in this export.',
      'This drill does NOT satisfy the complete backup/recovery release gate.'] };
  stage = 'rebuild canonical baseline';
  for (const name of ['local-baseline.sql','local-storage.sql','local-realtime.sql'])
    await db.exec(await readFile(new URL(name, import.meta.url),'utf8'));
  const policies = async () => (await db.query("select to_jsonb(p) as policy from pg_policies p where schemaname='public' and tablename=any($1::text[]) order by tablename,policyname", [tableNames])).rows;
  const originalPolicies = JSON.stringify(await policies());
  const owners = new Set();
  for (const table of tableNames) {
    if (!Array.isArray(saved.tables[table])) throw new Error('Missing required table.');
    for (const row of saved.tables[table]) owners.add(table === 'profiles' ? row.id : row.user_id);
  }
  for (const id of owners) await db.query('insert into auth.users(id) values($1)',[id]);
  for (const table of tableNames) {
    stage = 'restore ' + table;
    const columns = new Set((await db.query("select column_name from information_schema.columns where table_schema='public' and table_name=$1",[table])).rows.map(r=>r.column_name));
    if (saved.tables[table].some(row=>Object.keys(row).some(key=>!columns.has(key)))) throw new Error('Unmapped export column.');
    await db.query(`insert into public.${table} select * from jsonb_populate_recordset(null::public.${table},$1::jsonb)`,[JSON.stringify(saved.tables[table])]);
    report.restored_rows[table] = saved.tables[table].length;
  }
  async function compareRecords() {
    for (const table of tableNames) {
      const projection = ['workout_plans','workout_sessions'].includes(table) ? "to_jsonb(t)-'trainer_assignment_id'" : 'to_jsonb(t)';
      stage = 'compare typed records: ' + table;
      // Normalize timestamps/numeric JSON through PostgreSQL types before comparison.
      const normalized = await db.query(`select coalesce(jsonb_agg(to_jsonb(e)-'trainer_assignment_id'),'[]'::jsonb) as records from jsonb_populate_recordset(null::public.${table},$1::jsonb) e`,[JSON.stringify(saved.tables[table])]);
      const expected = JSON.stringify(normalized.rows[0].records);
      const result = await db.query(`select count(*)::int as count, coalesce(jsonb_agg(${projection}),'[]'::jsonb) @> $1::jsonb and $1::jsonb @> coalesce(jsonb_agg(${projection}),'[]'::jsonb) as matches from public.${table} t`,[expected]);
      if (!result.rows[0].matches || result.rows[0].count !== saved.tables[table].length) throw new Error('Restored data mismatch.');
    }
  }
  stage = 'verify original record equality'; await compareRecords();
  stage = 'replay additive migrations';
  const directory = new URL('../migrations/',import.meta.url);
  report.migrations = (await readdir(directory)).filter(n=>n.includes('_trainerhq_')).sort();
  for (const name of report.migrations) await db.exec(await readFile(new URL(name,directory),'utf8'));
  stage = 'verify records and original policies after migration'; await compareRecords();
  if (JSON.stringify(await policies()) !== originalPolicies) throw new Error('Original RLS changed.');
  for (const name of ['wifit_logging_baseline','trainerhq_identity','trainerhq_domain','trainerhq_insights','trainerhq_timezone_targets']) {
    stage = name;
    const result = await db.exec(await readFile(new URL('../tests/'+name+'.sql',import.meta.url),'utf8'));
    const outcome = result.at(-1).rows[0];
    if (outcome.result !== 'passed') throw new Error('Suite failed.');
    report.suites[name] = {result:outcome.result, assertions:outcome.assertions};
  }
  stage = 'verify targeted timezone rollback and reapplication';
  await db.exec(await readFile(new URL('../rollbacks/trainerhq_client_timezone_targets.sql',import.meta.url),'utf8'));
  const oldLookup = await db.query("select pg_get_functiondef('trainerhq_private.later_command(uuid,text,jsonb)'::regprocedure) as definition");
  if ((oldLookup.rows[0].definition.match(/effective_from<=current_date/g) || []).length !== 2) throw new Error('Targeted rollback did not restore both comparisons.');
  await compareRecords();
  await db.exec(await readFile(new URL('../migrations/20260909061603_trainerhq_client_timezone_targets.sql',import.meta.url),'utf8'));
  const targetChecks = await db.exec(await readFile(new URL('../tests/trainerhq_timezone_targets.sql',import.meta.url),'utf8'));
  if (targetChecks.at(-1).rows[0].result !== 'passed') throw new Error('Reapplication failed.');
  report.targeted_timezone_rollback_and_reapplication = 'passed';
  stage = 'apply documented compatibility rollback in memory';
  await db.exec(await readFile(new URL('../rollbacks/trainerhq_disable.sql',import.meta.url),'utf8'));
  const control = await db.query('select enabled from trainerhq_private.integration_control where singleton');
  if (control.rows[0]?.enabled !== false) throw new Error('Rollback did not disable integration.');
  await compareRecords();
  if (JSON.stringify(await policies()) !== originalPolicies) throw new Error('Rollback changed original RLS.');
  const baseline = await db.exec(await readFile(new URL('../tests/wifit_logging_baseline.sql',import.meta.url),'utf8'));
  const outcome = baseline.at(-1).rows[0];
  if (outcome.result !== 'passed') throw new Error('Post-rollback logging failed.');
  report.compatibility_rollback = {result:'passed', logging_assertions:outcome.assertions, original_records_and_policies:'unchanged'};
  report.result = 'passed';
  console.log(JSON.stringify(report,null,2));
} catch(error) {
  // Do not print SQL parameters, row values or the private export on failure.
  console.error(JSON.stringify({result:'failed',stage,code:error.code || 'verification_failed', ...(stage === 'trainerhq_insights' && error.code === 'P0001' ? {assertion:error.message} : {})}));
  process.exitCode = 1;
} finally { await db.close(); }
