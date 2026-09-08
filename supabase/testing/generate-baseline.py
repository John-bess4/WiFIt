from pathlib import Path
import json
r=json.loads((Path(__file__).parent / '../preflight/2026-09-08-inventory.json').read_text())
q=lambda s:'"'+s.replace('"','""')+'"'
lines=['create role anon; create role authenticated; create role service_role bypassrls;', 'create schema auth; create schema storage; create schema realtime;', '''create table auth.users(id uuid primary key, aud text, role text, email text, email_confirmed_at timestamptz, is_anonymous boolean default false, banned_until timestamptz); create table auth.sessions(id uuid primary key,user_id uuid references auth.users(id),not_after timestamptz);''', '''create function auth.uid() returns uuid language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claim.sub',true),''),nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid $$; create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$; grant usage on schema auth to anon,authenticated,service_role; grant execute on all functions in schema auth to anon,authenticated,service_role;''']
for t in r['tables']:
 cols=[]
 for c in t['columns']:
  cols.append(q(c['name'])+' '+c['data_type']+(' default '+c['default_value'] if 'default_value' in c else '')+(' not null' if 'nullable' not in c['options'] else ''))
 lines.append('create table '+t['name']+'('+','.join(cols)+');')
 lines.append('alter table '+t['name']+' enable row level security;')
for c in r['constraints']:
 if 'FOREIGN KEY' not in c['definition']: lines.append('alter table public.'+q(c['table_name'])+' add constraint '+q(c['conname'])+' '+c['definition']+';')
for c in r['constraints']:
 if 'FOREIGN KEY' in c['definition']: lines.append('alter table public.'+q(c['table_name'])+' add constraint '+q(c['conname'])+' '+c['definition']+';')
for p in r['policies']:
 lines.append('create policy '+q(p['policyname'])+' on '+p['schemaname']+'.'+q(p['tablename'])+' for '+p['cmd']+' to '+p['roles'].strip('{}')+(' using('+p['qual']+')' if p['qual'] else '')+(' with check('+p['with_check']+')' if p['with_check'] else '')+';')
lines.append('grant all on all tables in schema public to anon,authenticated,service_role;')
for name in ['supplement_due_from','daily_summary','weight_monthly','exercise_bests','exercise_pr_events']:
 v=next(v for v in r['relations'] if v['name']==name)
 lines.append('create view public.'+q(name)+' with(security_invoker=true) as '+v['view_definition'].rstrip(';')+'; grant select on public.'+q(name)+' to authenticated;')
Path(__file__).with_name('local-baseline.sql').write_text('\n'.join(lines)+'\n')
