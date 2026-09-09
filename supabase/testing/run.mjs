import { PGlite } from '@electric-sql/pglite';
import { readFile, readdir } from 'node:fs/promises';
const db = new PGlite();
try {
  // Match Supabase's UTC database timezone; client tracking uses its own explicit timezone.
  await db.exec("set time zone 'UTC'");
  for (const name of ['local-baseline.sql','local-storage.sql','local-realtime.sql']) await db.exec(await readFile(new URL(name, import.meta.url),'utf8'));
  const directory = new URL('../migrations/',import.meta.url);
  for (const name of (await readdir(directory)).filter(n => n.includes('_trainerhq_')).sort()) {
    await db.exec(await readFile(new URL(name,directory),'utf8')); console.log('Migration replay passed:', name);
  }
  for (const name of ['wifit_logging_baseline','trainerhq_identity','trainerhq_domain','trainerhq_insights','trainerhq_timezone_targets']) {
    const result=await db.exec(await readFile(new URL('../tests/'+name+'.sql',import.meta.url),'utf8'));
    console.log(name, result.at(-1).rows);
  }
} catch (error) {
  console.error('Isolated validation failed:', error.code, error.message); process.exitCode=1;
} finally { await db.close(); }
