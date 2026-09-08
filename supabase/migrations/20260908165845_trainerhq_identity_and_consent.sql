-- TrainerHQ/WiFit shared backend. Additive; existing WiFit tables/policies unchanged.
-- Execute as one transaction. Rollback: supabase/rollbacks/trainerhq_disable.sql.
create schema trainerhq_private;
revoke all on schema trainerhq_private from public, anon, authenticated;
grant usage on schema trainerhq_private to authenticated, service_role;

create table trainerhq_private.integration_control (
  singleton boolean primary key default true check(singleton), enabled boolean not null default true
);
insert into trainerhq_private.integration_control values(true,true);
create table trainerhq_private.platform_administrators (
  user_id uuid primary key references auth.users(id), created_at timestamptz not null default now()
);
create table public.trainer_profiles (
  user_id uuid primary key references auth.users(id),
  display_name text not null check(length(trim(display_name)) between 1 and 100),
  credentials_summary text not null default '' check(length(credentials_summary)<=2000),
  approval_status text not null default 'pending' check(approval_status in ('pending','approved','rejected','suspended')),
  reviewed_at timestamptz, created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(), version bigint not null default 1
);
create table trainerhq_private.trainer_reviews (
  id uuid primary key default gen_random_uuid(), trainer_id uuid not null references public.trainer_profiles(user_id),
  operator_user_id uuid references auth.users(id), operator_database_role text,
  decision text not null check(decision in ('approved','rejected','suspended')),
  reason text not null check(length(trim(reason)) between 1 and 2000), created_at timestamptz not null default now(),
  check(operator_user_id is null or operator_user_id<>trainer_id),
  check(operator_user_id is not null or operator_database_role is not null)
);
create table public.trainer_client_relationships (
  id uuid primary key default gen_random_uuid(), trainer_id uuid not null references public.trainer_profiles(user_id),
  client_id uuid references auth.users(id),
  state text not null default 'invited' check(state in ('invited','accepted','active','paused','revoked','ended')),
  accepted_at timestamptz, activated_at timestamptz, revoked_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  version bigint not null default 1, channel_epoch uuid not null default gen_random_uuid(),
  check(client_id is null or client_id<>trainer_id),
  check(state in ('invited','ended') or client_id is not null)
);
create unique index trainerhq_relationship_pair on public.trainer_client_relationships(trainer_id,client_id)
  where state not in ('revoked','ended') and client_id is not null;
create index trainerhq_relationship_client on public.trainer_client_relationships(client_id,state);
create index trainerhq_relationship_trainer on public.trainer_client_relationships(trainer_id,state);
create table public.trainer_client_permissions (
  relationship_id uuid not null references public.trainer_client_relationships(id),
  scope text not null check(scope in ('workouts','nutrition','nutrition_adherence','supplements','sessions',
    'progress_measurements','progress_photos','health_summaries','messaging')),
  granted boolean not null default true, updated_at timestamptz not null default now(),
  primary key(relationship_id,scope)
);
create table trainerhq_private.invitations (
  id uuid primary key default gen_random_uuid(), relationship_id uuid not null unique references public.trainer_client_relationships(id),
  recipient_email_hash text not null, token_hash text not null unique,
  status text not null default 'pending' check(status in ('pending','accepted','declined','expired')),
  expires_at timestamptz not null default now()+interval '7 days', created_at timestamptz not null default now()
);
create index trainerhq_invitation_recipient on trainerhq_private.invitations(recipient_email_hash,status);
create table trainerhq_private.audit_events (
  id bigint generated always as identity primary key, actor_id uuid references auth.users(id),
  action text not null, resource_id uuid, created_at timestamptz not null default now()
);
create index trainerhq_audit_actor_date on trainerhq_private.audit_events(actor_id,created_at desc);
create table trainerhq_private.operations (
  actor_id uuid not null references auth.users(id), operation_id uuid not null,
  action text not null, request_hash text not null, response jsonb not null,
  created_at timestamptz not null default now(), primary key(actor_id,operation_id)
);
create index trainerhq_operation_date on trainerhq_private.operations(created_at);

alter table trainerhq_private.integration_control enable row level security;
alter table trainerhq_private.platform_administrators enable row level security;
alter table trainerhq_private.trainer_reviews enable row level security;
alter table trainerhq_private.invitations enable row level security;
alter table trainerhq_private.audit_events enable row level security;
alter table trainerhq_private.operations enable row level security;
alter table public.trainer_profiles enable row level security;
alter table public.trainer_client_relationships enable row level security;
alter table public.trainer_client_permissions enable row level security;
revoke all on public.trainer_profiles, public.trainer_client_relationships, public.trainer_client_permissions from public,anon,authenticated;
grant select on public.trainer_profiles, public.trainer_client_relationships, public.trainer_client_permissions to authenticated;
revoke all on all tables in schema trainerhq_private from public,anon,authenticated,service_role;

create function trainerhq_private.hash(value text) returns text language sql immutable strict
set search_path='' as $$ select encode(sha256(convert_to(value,'UTF8')),'hex') $$;

-- Session existence is checked live; user metadata never controls authorization.
create function trainerhq_private.valid_session(actor uuid, session uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select actor is not null and session is not null
    and exists(select 1 from trainerhq_private.integration_control where singleton and enabled)
    and exists(select 1 from auth.users u join auth.sessions s on s.user_id=u.id
      where u.id=actor and s.id=session and not coalesce(u.is_anonymous,false)
      and (s.not_after is null or s.not_after>now()))
$$;
create function trainerhq_private.request_actor() returns uuid
language plpgsql stable security definer set search_path='' as $$
declare actor uuid; sid uuid;
begin
  actor:=auth.uid(); sid:=nullif(auth.jwt()->>'session_id','')::uuid;
  if trainerhq_private.valid_session(actor,sid) then return actor; end if;
  return null;
exception when invalid_text_representation then return null;
end $$;
create function trainerhq_private.approved(actor uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.trainer_profiles where user_id=actor and approval_status='approved')
$$;
create function trainerhq_private.allowed(actor uuid, relationship uuid, category text default null) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.trainer_client_relationships r
    where r.id=relationship and r.state='active' and r.client_id is not null
    and trainerhq_private.approved(r.trainer_id)
    and (actor=r.trainer_id or actor=r.client_id)
    and (category is null or exists(select 1 from public.trainer_client_permissions p
      where p.relationship_id=r.id and p.scope=category and p.granted)))
$$;
create function trainerhq_private.relationship_party(actor uuid, relationship uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select actor=trainerhq_private.request_actor() and exists(select 1 from public.trainer_client_relationships r
    where r.id=relationship and (actor=r.trainer_id or actor=r.client_id))
$$;
create policy trainerhq_profile_read on public.trainer_profiles for select to authenticated
using(user_id=(select trainerhq_private.request_actor()) or
  (approval_status='approved' and exists(select 1 from public.trainer_client_relationships r
   where r.trainer_id=user_id and r.client_id=(select trainerhq_private.request_actor()))));
create policy trainerhq_relationship_read on public.trainer_client_relationships for select to authenticated
using(trainer_id=(select trainerhq_private.request_actor()) or client_id=(select trainerhq_private.request_actor()));
create policy trainerhq_permissions_read on public.trainer_client_permissions for select to authenticated
using(trainerhq_private.relationship_party((select trainerhq_private.request_actor()),relationship_id));

-- Protected owner review through Supabase's authenticated database administrator.
-- No client or service-role grant. Application-admin review uses the separate RPC.
create function trainerhq_private.owner_review_trainer(trainer uuid, decision text, reason text) returns void
language plpgsql security definer set search_path='' as $$
begin
  if session_user not in ('postgres','supabase_admin') then raise insufficient_privilege; end if;
  if decision not in ('approved','rejected','suspended') or length(trim(reason)) not between 1 and 2000
  then raise invalid_parameter_value; end if;
  update public.trainer_profiles set approval_status=decision,reviewed_at=now(),updated_at=now(),version=version+1
    where user_id=trainer;
  if not found then raise no_data_found; end if;
  insert into trainerhq_private.trainer_reviews(trainer_id,operator_database_role,decision,reason)
    values(trainer,session_user,decision,reason);
  insert into trainerhq_private.audit_events(action,resource_id) values('trainer.'||decision,trainer);
end $$;

-- Extension hook replaced only by later TrainerHQ migrations, never WiFit code.
create function trainerhq_private.domain_command(actor uuid, action text, payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
begin raise exception 'Unknown operation' using errcode='22023'; end $$;

create function trainerhq_private.replay_allowed(actor uuid, action text, payload jsonb) returns boolean
language sql stable security definer set search_path='' as $$
 select case
 when action='trainer.apply' then true
 when action='trainer.review' then exists(select 1 from trainerhq_private.platform_administrators where user_id=actor)
 when action='invitation.create' then trainerhq_private.approved(actor)
 when action='invitation.respond' then exists(select 1 from trainerhq_private.invitations i join auth.users u
   on trainerhq_private.hash(lower(trim(u.email)))=i.recipient_email_hash
   where u.id=actor and i.token_hash=trainerhq_private.hash(payload->>'token'))
 when action='relationship.update' then exists(select 1 from public.trainer_client_relationships r
   where r.id=(payload->>'relationship_id')::uuid and r.client_id=actor)
 else false end
$$;

create function trainerhq_private.api(actor uuid, session uuid, action text, payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  result jsonb; op uuid; digest text; prior trainerhq_private.operations;
  r public.trainer_client_relationships; inv trainerhq_private.invitations;
  scopes text[]; token text; v_email text; rid uuid; target uuid; category text;
  from_day date; until_day date; is_read boolean;
begin
  if not trainerhq_private.valid_session(actor,session) then raise exception 'Session unavailable' using errcode='42501'; end if;
  if jsonb_typeof(payload)<>'object' or octet_length(payload::text)>65536 then raise invalid_parameter_value; end if;
  is_read:=action in ('account.get','relationships.list','invitation.review','clients.list','client.logs',
    'assignments.list','schedule.list','schedule.changes','availability.list','messages.threads','messages.list',
    'reminders.list','adherence.report','media.read','realtime.topics');
  if not is_read then
    op:=(payload->>'operation_id')::uuid;
    if op is null then raise exception 'operation_id required' using errcode='22023'; end if;
    digest:=trainerhq_private.hash(payload::text);
    perform pg_advisory_xact_lock(hashtextextended(actor::text||op::text,0));
    select * into prior from trainerhq_private.operations where actor_id=actor and operation_id=op;
    if found then
      if prior.action<>action or prior.request_hash<>digest then raise exception 'Operation ID reused' using errcode='23505'; end if;
      -- Recheck access before returning previously saved sensitive responses.
      if not trainerhq_private.replay_allowed(actor,action,payload)
      then raise insufficient_privilege; end if;
      return prior.response;
    end if;
  end if;

  case action
  when 'account.get' then
    select jsonb_build_object('user_id',actor,'trainer',
      (select to_jsonb(t) from public.trainer_profiles t where t.user_id=actor),
      'is_platform_admin',exists(select 1 from trainerhq_private.platform_administrators where user_id=actor)) into result;
  when 'trainer.apply' then
    if length(trim(coalesce(payload->>'display_name',''))) not between 1 and 100
      or length(coalesce(payload->>'credentials_summary',''))>2000 then raise invalid_parameter_value; end if;
    insert into public.trainer_profiles(user_id,display_name,credentials_summary)
      values(actor,trim(payload->>'display_name'),coalesce(payload->>'credentials_summary',''))
      on conflict(user_id) do update set display_name=excluded.display_name,
        credentials_summary=excluded.credentials_summary,
        approval_status=case when trainer_profiles.display_name<>excluded.display_name or trainer_profiles.credentials_summary<>excluded.credentials_summary
          then 'pending' else trainer_profiles.approval_status end,
        reviewed_at=case when trainer_profiles.display_name<>excluded.display_name or trainer_profiles.credentials_summary<>excluded.credentials_summary
          then null else trainer_profiles.reviewed_at end,updated_at=now(),version=trainer_profiles.version+1;
    select to_jsonb(t) into result from public.trainer_profiles t where t.user_id=actor;
  when 'trainer.review' then
    target:=(payload->>'trainer_id')::uuid;
    if target=actor or not exists(select 1 from trainerhq_private.platform_administrators where user_id=actor)
    then raise insufficient_privilege; end if;
    if payload->>'decision' not in ('approved','rejected','suspended') then raise invalid_parameter_value; end if;
    insert into trainerhq_private.trainer_reviews(trainer_id,operator_user_id,decision,reason)
      values(target,actor,payload->>'decision',payload->>'reason');
    update public.trainer_profiles set approval_status=payload->>'decision',reviewed_at=now(),updated_at=now(),version=version+1 where user_id=target;
    if not found then raise no_data_found; end if;
    result:=jsonb_build_object('reviewed',true);
  when 'invitation.create' then
    if not trainerhq_private.approved(actor) then raise insufficient_privilege; end if;
    v_email:=lower(trim(payload->>'email'));
    if v_email is null or length(v_email)>254 or v_email !~ '^[^ @]+@[^ @]+\.[^ @]+$'
      or exists(select 1 from auth.users where id=actor and lower(auth.users.email)=v_email)
    then raise invalid_parameter_value; end if;
    if (select count(*) from public.trainer_client_relationships where trainer_id=actor and created_at>now()-interval '1 day')>=20
    then raise exception 'Invitation limit reached' using errcode='P0001'; end if;
    token:=gen_random_uuid()::text||gen_random_uuid()::text;
    insert into public.trainer_client_relationships(trainer_id) values(actor) returning * into r;
    insert into trainerhq_private.invitations(relationship_id,recipient_email_hash,token_hash)
      values(r.id,trainerhq_private.hash(v_email),trainerhq_private.hash(token)) returning * into inv;
    result:=jsonb_build_object('invitation_id',inv.id,'relationship_id',r.id,'token',token,'expires_at',inv.expires_at);
  when 'invitation.review' then
    select * into inv from trainerhq_private.invitations where token_hash=trainerhq_private.hash(payload->>'token');
    if not found or inv.expires_at<=now() or inv.status<>'pending' then raise exception 'Invitation unavailable' using errcode='42501'; end if;
    if not exists(select 1 from auth.users u where u.id=actor and u.email_confirmed_at is not null
      and trainerhq_private.hash(lower(trim(u.email)))=inv.recipient_email_hash) then raise insufficient_privilege; end if;
    select * into r from public.trainer_client_relationships where id=inv.relationship_id;
    if not trainerhq_private.approved(r.trainer_id) then raise insufficient_privilege; end if;
    select jsonb_build_object('invitation_id',inv.id,'relationship_id',r.id,'expires_at',inv.expires_at,
      'trainer',jsonb_build_object('user_id',t.user_id,'display_name',t.display_name,'credentials_summary',t.credentials_summary))
      into result from public.trainer_profiles t where t.user_id=r.trainer_id;
  when 'invitation.respond' then
    select * into inv from trainerhq_private.invitations where token_hash=trainerhq_private.hash(payload->>'token') for update;
    if not found or inv.status<>'pending' or inv.expires_at<=now() then raise exception 'Invitation unavailable' using errcode='42501'; end if;
    if not exists(select 1 from auth.users u where u.id=actor and u.email_confirmed_at is not null
      and trainerhq_private.hash(lower(trim(u.email)))=inv.recipient_email_hash) then raise insufficient_privilege; end if;
    select * into r from public.trainer_client_relationships where id=inv.relationship_id for update;
    if not trainerhq_private.approved(r.trainer_id) or r.trainer_id=actor or r.state<>'invited' then raise insufficient_privilege; end if;
    if payload->>'decision'='decline' then
      update trainerhq_private.invitations set status='declined' where id=inv.id;
      update public.trainer_client_relationships set state='ended',updated_at=now(),version=version+1 where id=r.id;
    elsif payload->>'decision'='accept' then
      select coalesce(array_agg(distinct value),'{}') into scopes from jsonb_array_elements_text(coalesce(payload->'scopes','[]'));
      if cardinality(scopes)>9 then raise invalid_parameter_value; end if;
      update trainerhq_private.invitations set status='accepted' where id=inv.id;
      update public.trainer_client_relationships set client_id=actor,accepted_at=now(),
        state=case when payload->'activate'='true'::jsonb then 'active' else 'accepted' end,
        activated_at=case when payload->'activate'='true'::jsonb then now() end,
        updated_at=now(),version=version+1 where id=r.id;
      insert into public.trainer_client_permissions(relationship_id,scope) select r.id,unnest(scopes);
    else raise invalid_parameter_value; end if;
    result:=jsonb_build_object('relationship_id',r.id,'decision',payload->>'decision');
  when 'relationships.list' then
    select coalesce(jsonb_agg(to_jsonb(q)),'[]') into result from (
      select roster.*,t.display_name as trainer_name,t.credentials_summary,
        coalesce((select jsonb_agg(p.scope order by p.scope) from public.trainer_client_permissions p where p.relationship_id=roster.id and p.granted),'[]') as scopes
      from public.trainer_client_relationships roster join public.trainer_profiles t on t.user_id=roster.trainer_id
      where roster.trainer_id=actor or roster.client_id=actor order by roster.created_at desc limit 200
    )q;
  when 'relationship.update' then
    select * into r from public.trainer_client_relationships where id=(payload->>'relationship_id')::uuid for update;
    if not found or r.client_id<>actor then raise insufficient_privilege; end if;
    if r.version<>(payload->>'version')::bigint or not payload ? 'version' then raise exception 'Relationship changed' using errcode='23505'; end if;
    if r.state in ('revoked','ended') or payload->>'state' not in ('active','paused','revoked') then raise invalid_parameter_value; end if;
    if payload->>'state'='active' and not trainerhq_private.approved(r.trainer_id) then raise insufficient_privilege; end if;
    update public.trainer_client_relationships set state=payload->>'state',
      revoked_at=case when payload->>'state'='revoked' then now() else revoked_at end,
      activated_at=case when payload->>'state'='active' then coalesce(activated_at,now()) else activated_at end,
      version=version+1,channel_epoch=gen_random_uuid(),updated_at=now() where id=r.id;
    if payload ? 'scopes' then
      select coalesce(array_agg(distinct value),'{}') into scopes from jsonb_array_elements_text(payload->'scopes');
      update public.trainer_client_permissions set granted=false,updated_at=now() where relationship_id=r.id;
      insert into public.trainer_client_permissions(relationship_id,scope,granted)
        select r.id,unnest(scopes),true on conflict(relationship_id,scope) do update set granted=true,updated_at=now();
    end if;
    select to_jsonb(x) into result from public.trainer_client_relationships x where x.id=r.id;
  when 'clients.list' then
    if not trainerhq_private.approved(actor) then raise insufficient_privilege; end if;
    select coalesce(jsonb_agg(to_jsonb(q)),'[]') into result from (
      select roster.id as relationship_id,r.client_id,r.activated_at,r.version,
        coalesce(nullif(trim(p.name),''),'WiFit client') as display_name,
        coalesce((select jsonb_agg(s.scope order by s.scope) from public.trainer_client_permissions s where s.relationship_id=roster.id and s.granted),'[]') as scopes
      from public.trainer_client_relationships roster left join public.profiles p on p.id=roster.client_id
      where roster.trainer_id=actor and roster.state='active' and roster.client_id is not null
        and (not payload ? 'after' or roster.id>(payload->>'after')::uuid)
      order by roster.id limit 100
    )q;
  when 'client.logs' then
    rid:=(payload->>'relationship_id')::uuid; category:=payload->>'category';
    if category not in ('workouts','nutrition','supplements','progress_measurements') then raise invalid_parameter_value; end if;
    if not trainerhq_private.allowed(actor,rid,category) then raise insufficient_privilege; end if;
    select * into r from public.trainer_client_relationships where id=rid;
    from_day:=(payload->>'from')::date; until_day:=(payload->>'until')::date;
    if from_day is null or until_day is null or until_day<=from_day or until_day-from_day>93 then raise invalid_parameter_value; end if;
    if category='nutrition' then
      select coalesce(jsonb_agg(to_jsonb(q)),'[]') into result from (select f.* from public.food_log f
        where f.user_id=r.client_id and f.logged_date>=from_day and f.logged_date<until_day
        and (not payload ? 'after' or f.id>(payload->>'after')::uuid) order by f.id limit 200)q;
    elsif category='workouts' then
      select coalesce(jsonb_agg(to_jsonb(q)),'[]') into result from (select w.* from public.workout_sessions w
        where w.user_id=r.client_id and w.completed_date>=from_day and w.completed_date<until_day
        and (not payload ? 'after' or w.id>(payload->>'after')::uuid) order by w.id limit 200)q;
    elsif category='supplements' then
      select coalesce(jsonb_agg(to_jsonb(q)),'[]') into result from (select l.*,s.name,s.sub from public.supplement_log l
        join public.supplement_stack s on s.id=l.supplement_id and s.user_id=l.user_id
        where l.user_id=r.client_id and l.log_date>=from_day and l.log_date<until_day
        and (not payload ? 'after' or l.id>(payload->>'after')::uuid) order by l.id limit 200)q;
    else
      select coalesce(jsonb_agg(to_jsonb(q)),'[]') into result from (select id,user_id,weight_lbs,log_date,created_at
        from public.body_weight_log w where w.user_id=r.client_id and w.log_date>=from_day and w.log_date<until_day
        and (not payload ? 'after' or w.id>(payload->>'after')::uuid) order by w.id limit 200)q;
    end if;
  else result:=trainerhq_private.domain_command(actor,action,payload);
  end case;
  if result is null then result:='{}'; end if;
  if not is_read then
    insert into trainerhq_private.operations values(actor,op,action,digest,result,now());
    insert into trainerhq_private.audit_events(actor_id,action,resource_id)
      values(actor,action,coalesce(r.id,(payload->>'relationship_id')::uuid));
  end if;
  return result;
end $$;

-- Only the secured Edge Function may supply the verified actor/session pair.
create function public.trainerhq_api(actor_id uuid, session_id uuid, action text, payload jsonb default '{}') returns jsonb
language sql security invoker set search_path='' as $$
 select trainerhq_private.api(actor_id,session_id,action,payload)
$$;
revoke all on all functions in schema trainerhq_private from public,anon,authenticated,service_role;
grant execute on function trainerhq_private.request_actor(), trainerhq_private.relationship_party(uuid,uuid) to authenticated;
grant execute on function trainerhq_private.api(uuid,uuid,text,jsonb) to service_role;
revoke all on function public.trainerhq_api(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.trainerhq_api(uuid,uuid,text,jsonb) to service_role;
comment on function public.trainerhq_api is 'Server-only gateway. Edge verifies Auth JWT; database validates current session and each resource permission.';
