-- Additive trainer assignments, scheduling and durable private messaging.
-- Existing WiFit logs stay canonical. No existing policy is replaced.
create table public.trainer_workout_assignments (
 id uuid primary key default gen_random_uuid(), relationship_id uuid not null references public.trainer_client_relationships(id),
 client_id uuid not null references auth.users(id), trainer_id uuid not null references public.trainer_profiles(user_id),
 title text not null check(length(trim(title)) between 1 and 120),
 exercises jsonb not null check(jsonb_typeof(exercises)='array' and jsonb_array_length(exercises) between 1 and 100),
 notes text not null default '' check(length(notes)<=4000), due_date date not null,
 status text not null default 'assigned' check(status in ('assigned','accepted','cancelled')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), version bigint not null default 1,
 unique(id,client_id)
);
create index trainerhq_assignment_relationship_date on public.trainer_workout_assignments(relationship_id,due_date,id);
create index trainerhq_assignment_client_date on public.trainer_workout_assignments(client_id,due_date,id);
-- Optional origin links; existing WiFit inserts omit these and behave unchanged.
alter table public.workout_plans add column trainer_assignment_id uuid;
alter table public.workout_plans add constraint trainerhq_plan_assignment_owner foreign key(trainer_assignment_id,user_id)
 references public.trainer_workout_assignments(id,client_id);
create unique index trainerhq_plan_assignment_unique on public.workout_plans(trainer_assignment_id) where trainer_assignment_id is not null;
alter table public.workout_sessions add column trainer_assignment_id uuid;
alter table public.workout_sessions add constraint trainerhq_session_assignment_owner foreign key(trainer_assignment_id,user_id)
 references public.trainer_workout_assignments(id,client_id);
create index trainerhq_session_assignment on public.workout_sessions(trainer_assignment_id) where trainer_assignment_id is not null;

create table public.trainer_appointments (
 id uuid primary key default gen_random_uuid(), relationship_id uuid not null references public.trainer_client_relationships(id),
 trainer_id uuid not null references public.trainer_profiles(user_id), client_id uuid not null references auth.users(id),
 start_at timestamptz not null, end_at timestamptz not null,
 status text not null default 'scheduled' check(status in ('scheduled','confirmed','rescheduled','in_progress','completed','cancelled','missed')),
 assignment_id uuid references public.trainer_workout_assignments(id),
 location text not null default 'Studio' check(location in ('Studio','Outdoor','Online')),
 notes text not null default '' check(length(notes)<=4000), rescheduled_from timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), version bigint not null default 1,
 check(end_at-start_at between interval '15 minutes' and interval '180 minutes')
);
create index trainerhq_appointment_trainer_start on public.trainer_appointments(trainer_id,start_at);
create index trainerhq_appointment_client_start on public.trainer_appointments(client_id,start_at);
create index trainerhq_appointment_relationship on public.trainer_appointments(relationship_id,start_at);
create table public.trainer_appointment_changes (
 id uuid primary key default gen_random_uuid(), appointment_id uuid not null references public.trainer_appointments(id),
 client_id uuid not null references auth.users(id), reason text not null check(length(trim(reason)) between 1 and 2000),
 resolution text not null default 'pending' check(resolution in ('pending','rescheduled','declined','closed')),
 created_at timestamptz not null default now(), resolved_at timestamptz
);
create unique index trainerhq_pending_change on public.trainer_appointment_changes(appointment_id) where resolution='pending';
create table public.trainer_availability (
 trainer_id uuid not null references public.trainer_profiles(user_id), weekday integer not null check(weekday between 1 and 7),
 start_minute integer not null check(start_minute between 0 and 1439), end_minute integer not null check(end_minute between 1 and 1440),
 timezone text not null, updated_at timestamptz not null default now(), primary key(trainer_id,weekday), check(end_minute>start_minute)
);
create table public.trainer_conversations (
 id uuid primary key default gen_random_uuid(), kind text not null check(kind in ('direct','group')),
 relationship_id uuid references public.trainer_client_relationships(id), creator_id uuid not null references auth.users(id),
 title text check(length(title)<=120), state text not null default 'open' check(state in ('open','archived')),
 channel_epoch uuid not null default gen_random_uuid(), last_sequence bigint not null default 0,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check((kind='direct' and relationship_id is not null) or (kind='group' and relationship_id is null))
);
create unique index trainerhq_direct_conversation on public.trainer_conversations(relationship_id) where kind='direct' and state='open';
create table public.trainer_conversation_members (
 conversation_id uuid not null references public.trainer_conversations(id), user_id uuid not null references auth.users(id),
 member_role text not null check(member_role in ('trainer','client')),
 state text not null check(state in ('invited','active','paused','revoked','left')),
 last_read_sequence bigint not null default 0 check(last_read_sequence>=0),
 last_delivered_sequence bigint not null default 0 check(last_delivered_sequence>=last_read_sequence),
 read_at timestamptz, delivered_at timestamptz, needs_follow_up boolean not null default false,
 joined_at timestamptz not null default now(), primary key(conversation_id,user_id)
);
create index trainerhq_members_user on public.trainer_conversation_members(user_id,state,conversation_id);
create table trainerhq_private.conversation_relationships (
 conversation_id uuid not null references public.trainer_conversations(id),
 relationship_id uuid not null references public.trainer_client_relationships(id), primary key(conversation_id,relationship_id)
);
create index trainerhq_conversation_relationship on trainerhq_private.conversation_relationships(relationship_id,conversation_id);
create table public.trainer_messages (
 id uuid primary key default gen_random_uuid(), conversation_id uuid not null references public.trainer_conversations(id),
 sender_id uuid not null references auth.users(id), sender_role text not null check(sender_role in ('trainer','client')),
 sequence bigint not null, body text not null check(length(trim(body)) between 1 and 2000),
 sent_at timestamptz not null default now(), unique(conversation_id,sequence)
);
create table public.trainer_message_receipts (
 message_id uuid not null references public.trainer_messages(id), recipient_id uuid not null references auth.users(id),
 delivered_at timestamptz, read_at timestamptz, primary key(message_id,recipient_id),
 check(read_at is null or (delivered_at is not null and read_at>=delivered_at))
);
create index trainerhq_receipt_recipient on public.trainer_message_receipts(recipient_id,message_id);
create table public.trainer_message_attachments (
 id uuid primary key default gen_random_uuid(), message_id uuid not null references public.trainer_messages(id),
 owner_id uuid not null references auth.users(id), bucket text not null default 'trainerhq-message-attachments' check(bucket='trainerhq-message-attachments'),
 object_path text not null unique, mime_type text not null check(mime_type in ('image/jpeg','image/png','application/pdf')),
 byte_count bigint not null check(byte_count between 1 and 10485760), state text not null default 'uploading' check(state in ('uploading','ready')),
 created_at timestamptz not null default now()
);
create index trainerhq_attachment_message on public.trainer_message_attachments(message_id);
create table public.trainer_reminders (
 id uuid primary key, trainer_id uuid not null references public.trainer_profiles(user_id), text text not null check(length(trim(text)) between 1 and 2000),
 is_completed boolean not null default false, updated_at timestamptz not null default now()
);
create index trainerhq_reminder_trainer on public.trainer_reminders(trainer_id,updated_at);

create function trainerhq_private.message_access(actor uuid, conversation uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.trainer_conversation_members me where me.conversation_id=conversation
  and me.user_id=actor and me.state='active' and (me.member_role='client' or
   (trainerhq_private.approved(actor)
    and exists(select 1 from public.trainer_conversation_members cm where cm.conversation_id=conversation and cm.member_role='client' and cm.state='active')
    and not exists(select 1 from public.trainer_conversation_members cm
     where cm.conversation_id=conversation and cm.member_role='client' and cm.state='active'
     and not exists(select 1 from trainerhq_private.conversation_relationships cr
      join public.trainer_client_relationships r on r.id=cr.relationship_id
      where cr.conversation_id=conversation and r.client_id=cm.user_id and r.trainer_id=actor
       and trainerhq_private.allowed(actor,r.id,'messaging'))))))
$$;
create function trainerhq_private.attachment_access(actor uuid, path text, writing boolean default false) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.trainer_message_attachments a join public.trainer_messages m on m.id=a.message_id
 where a.object_path=path and trainerhq_private.message_access(actor,m.conversation_id)
 and (not writing or (a.owner_id=actor and a.state='uploading')))
$$;

create function trainerhq_private.request_allowed(relationship uuid, category text) returns boolean
 language sql stable security definer set search_path='' as $$ select trainerhq_private.allowed(trainerhq_private.request_actor(),relationship,category) $$;
create function trainerhq_private.request_message_access(conversation uuid) returns boolean
 language sql stable security definer set search_path='' as $$ select trainerhq_private.message_access(trainerhq_private.request_actor(),conversation) $$;
create function trainerhq_private.request_attachment_access(path text, writing boolean) returns boolean
 language sql stable security definer set search_path='' as $$ select trainerhq_private.attachment_access(trainerhq_private.request_actor(),path,writing) $$;
do $$ declare t text; begin
 foreach t in array array['trainer_workout_assignments','trainer_appointments','trainer_appointment_changes','trainer_availability',
 'trainer_conversations','trainer_conversation_members','trainer_messages','trainer_message_receipts','trainer_message_attachments','trainer_reminders'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated',t);
  execute format('grant select on public.%I to authenticated',t);
 end loop;
end $$;
alter table trainerhq_private.conversation_relationships enable row level security;
revoke all on trainerhq_private.conversation_relationships from public,anon,authenticated,service_role;
create policy trainerhq_assignment_read on public.trainer_workout_assignments for select to authenticated
 using(client_id=(select trainerhq_private.request_actor()) or trainerhq_private.request_allowed(relationship_id,'workouts'));
create policy trainerhq_appointment_read on public.trainer_appointments for select to authenticated
 using(client_id=(select trainerhq_private.request_actor()) or trainerhq_private.request_allowed(relationship_id,'sessions'));
create policy trainerhq_change_read on public.trainer_appointment_changes for select to authenticated
 using(exists(select 1 from public.trainer_appointments a where a.id=appointment_id));
create policy trainerhq_availability_read on public.trainer_availability for select to authenticated
 using(trainer_id=(select trainerhq_private.request_actor()));
create policy trainerhq_conversation_read on public.trainer_conversations for select to authenticated
 using(trainerhq_private.request_message_access(id));
create policy trainerhq_member_read on public.trainer_conversation_members for select to authenticated
 using(trainerhq_private.request_message_access(conversation_id));
create policy trainerhq_message_read on public.trainer_messages for select to authenticated
 using(trainerhq_private.request_message_access(conversation_id));
create policy trainerhq_receipt_read on public.trainer_message_receipts for select to authenticated
 using(exists(select 1 from public.trainer_messages m where m.id=message_id));
create policy trainerhq_attachment_read on public.trainer_message_attachments for select to authenticated
 using(trainerhq_private.request_attachment_access(object_path,false));
create policy trainerhq_reminder_read on public.trainer_reminders for select to authenticated
 using(trainer_id=(select trainerhq_private.request_actor()));

-- Check final permission state after a scope replacement's multiple row updates.
-- Other participants retain the group and historical messages.
create function trainerhq_private.consent_conversations_changed() returns trigger
language plpgsql security definer set search_path='' as $$
declare rid uuid; rel public.trainer_client_relationships; member_state text;
begin
 if tg_table_name='trainer_client_relationships' then rid:=new.id; else rid:=new.relationship_id; end if;
 select * into rel from public.trainer_client_relationships where id=rid;
 member_state:=case when rel.state='paused' then 'paused' when rel.state='active'
  and exists(select 1 from public.trainer_client_permissions p where p.relationship_id=rid and p.scope='messaging' and p.granted)
  then 'active' else 'revoked' end;
 update public.trainer_conversation_members cm set state=member_state
 where cm.user_id=rel.trainer_id and cm.conversation_id in(select cr.conversation_id from trainerhq_private.conversation_relationships cr where cr.relationship_id=rid)
 and cm.state in ('active','paused') and cm.state<>member_state;
 update public.trainer_conversations c set channel_epoch=gen_random_uuid(),updated_at=now(),
  state=case when c.kind='direct' and member_state='revoked' then 'archived' else c.state end
 where c.id in(select cr.conversation_id from trainerhq_private.conversation_relationships cr where cr.relationship_id=rid);
 return null;
end $$;
create constraint trigger trainerhq_relationship_conversation_consent after update on public.trainer_client_relationships
 deferrable initially deferred for each row execute function trainerhq_private.consent_conversations_changed();
create constraint trigger trainerhq_scope_conversation_consent after insert or update on public.trainer_client_permissions
 deferrable initially deferred for each row execute function trainerhq_private.consent_conversations_changed();

create function trainerhq_private.direct_conversation(actor uuid, rid uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare rel public.trainer_client_relationships; cid uuid;
begin
 if not trainerhq_private.allowed(actor,rid,'messaging') then raise insufficient_privilege; end if;
 select * into rel from public.trainer_client_relationships where id=rid for update;
 select id into cid from public.trainer_conversations where relationship_id=rid and kind='direct' and state='open';
 if cid is null then
  insert into public.trainer_conversations(kind,relationship_id,creator_id) values('direct',rid,actor) returning id into cid;
  insert into public.trainer_conversation_members(conversation_id,user_id,member_role,state)
   values(cid,rel.trainer_id,'trainer','active'),(cid,rel.client_id,'client','active');
  insert into trainerhq_private.conversation_relationships values(cid,rid);
 end if;
 return cid;
end $$;
create function trainerhq_private.send_message(actor uuid, cid uuid, text_body text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare seq bigint; result jsonb; role_name text; mid uuid;
begin
 if not trainerhq_private.message_access(actor,cid) then raise insufficient_privilege; end if;
 if length(trim(coalesce(text_body,''))) not between 1 and 2000 then raise invalid_parameter_value; end if;
 update public.trainer_conversations set last_sequence=last_sequence+1,updated_at=now()
  where id=cid and state='open' returning last_sequence into seq;
 if seq is null then raise insufficient_privilege; end if;
 select member_role into role_name from public.trainer_conversation_members where conversation_id=cid and user_id=actor;
 insert into public.trainer_messages(conversation_id,sender_id,sender_role,sequence,body)
 values(cid,actor,role_name,seq,trim(text_body)) returning to_jsonb(trainer_messages.*) into result;
 mid:=(result->>'id')::uuid;
 insert into public.trainer_message_receipts(message_id,recipient_id,delivered_at,read_at)
  select mid,cm.user_id,case when cm.user_id=actor then now() end,case when cm.user_id=actor then now() end
  from public.trainer_conversation_members cm where cm.conversation_id=cid and cm.state='active'
  and trainerhq_private.message_access(cm.user_id,cid);
 update public.trainer_conversation_members set last_read_sequence=seq,last_delivered_sequence=seq,read_at=now(),delivered_at=now()
  where conversation_id=cid and user_id=actor;
 return result;
end $$;

create function trainerhq_private.later_command(actor uuid, action text, payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$ begin raise exception 'Unknown operation' using errcode='22023';end $$;

create or replace function trainerhq_private.domain_command(actor uuid, action text, payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb; rel public.trainer_client_relationships; item public.trainer_workout_assignments;
 appt public.trainer_appointments; change public.trainer_appointment_changes; cid uuid; rid uuid; id_value uuid;
 member uuid; seq bigint; starts timestamptz; ends timestamptz; from_day date; until_day date; vals jsonb; minute integer;
begin
 case action
 when 'assignments.list' then
  rid:=(payload->>'relationship_id')::uuid;
  if not trainerhq_private.allowed(actor,rid,'workouts') then raise insufficient_privilege;end if;
  select coalesce(jsonb_agg(to_jsonb(q)),'[]') into result from (select a.* from public.trainer_workout_assignments a
   where a.relationship_id=rid and (not payload ? 'after' or a.id>(payload->>'after')::uuid) order by a.id limit 100)q;
 when 'assignment.create' then
  select * into rel from public.trainer_client_relationships where id=(payload->>'relationship_id')::uuid for update;
  if not found or actor<>rel.trainer_id or not trainerhq_private.allowed(actor,rel.id,'workouts') then raise insufficient_privilege;end if;
  -- Plan JSON must use WiFit's established name/sets shape; no trainer-written performance logs.
  if jsonb_typeof(payload->'exercises')<>'array' or exists(select 1 from jsonb_array_elements(payload->'exercises') e
   where length(trim(coalesce(e->>'name','')))=0 or coalesce(jsonb_typeof(e->'sets'),'')<>'array' or jsonb_array_length(e->'sets') not between 1 and 30)
  then raise invalid_parameter_value;end if;
  insert into public.trainer_workout_assignments(relationship_id,client_id,trainer_id,title,exercises,notes,due_date)
  values(rel.id,rel.client_id,actor,payload->>'title',payload->'exercises',coalesce(payload->>'notes',''),(payload->>'due_date')::date)
  returning to_jsonb(trainer_workout_assignments.*) into result;
 when 'assignment.accept' then
  select * into item from public.trainer_workout_assignments where id=(payload->>'assignment_id')::uuid for update;
  if not found or item.client_id<>actor or not trainerhq_private.allowed(actor,item.relationship_id,'workouts') then raise insufficient_privilege;end if;
  if item.status='cancelled' then raise invalid_parameter_value;end if;
  insert into public.workout_plans(user_id,name,tag,exercises,trainer_assignment_id,sort_order)
   values(actor,item.title,'Trainer assignment',item.exercises,item.id,
    coalesce((select max(sort_order)+1 from public.workout_plans where user_id=actor),0))
   on conflict(trainer_assignment_id) where trainer_assignment_id is not null do nothing;
  update public.trainer_workout_assignments set status='accepted',updated_at=now(),version=version+1 where id=item.id;
  result:=jsonb_build_object('assignment_id',item.id,'accepted',true);
 when 'schedule.list' then
  starts:=(payload->>'from')::timestamptz;ends:=(payload->>'until')::timestamptz;
  if starts is null or ends is null or ends<=starts or ends-starts>interval '93 days' then raise invalid_parameter_value;end if;
  select coalesce(jsonb_agg(to_jsonb(q)),'[]') into result from (select a.* from public.trainer_appointments a
   where a.start_at<ends and a.end_at>starts and (a.client_id=actor or trainerhq_private.allowed(actor,a.relationship_id,'sessions'))
   and (not payload ? 'after' or a.id>(payload->>'after')::uuid) order by a.id limit 200)q;
 when 'schedule.create','schedule.update' then
  select * into rel from public.trainer_client_relationships where id=(payload->>'relationship_id')::uuid for update;
  if not found or rel.trainer_id<>actor or not trainerhq_private.allowed(actor,rel.id,'sessions') then raise insufficient_privilege;end if;
  if action='schedule.update' then
   select * into appt from public.trainer_appointments where id=(payload->>'id')::uuid for update;
   if not found or appt.trainer_id<>actor or not trainerhq_private.allowed(actor,appt.relationship_id,'sessions') then raise insufficient_privilege;end if;
   if appt.version is distinct from (payload->>'version')::bigint or appt.status in ('completed','cancelled','missed')
   then raise exception 'Appointment changed' using errcode='23505';end if;
  end if;
  starts:=(payload->>'start_at')::timestamptz;ends:=(payload->>'end_at')::timestamptz;
  if starts is null or ends is null or ends-starts not between interval '15 minutes' and interval '180 minutes' then raise invalid_parameter_value;end if;
  perform pg_advisory_xact_lock(hashtextextended(least(actor::text,rel.client_id::text),1));
  perform pg_advisory_xact_lock(hashtextextended(greatest(actor::text,rel.client_id::text),1));
  if exists(select 1 from public.trainer_appointments a where (a.trainer_id=actor or a.client_id=rel.client_id)
    and a.status not in ('cancelled','missed') and a.start_at<ends and a.end_at>starts
    and a.id is distinct from appt.id) then raise exception 'Time unavailable' using errcode='23505';end if;
  if exists(select 1 from public.trainer_availability av where av.trainer_id=actor)
    and not exists(select 1 from public.trainer_availability av where av.trainer_id=actor
     and av.weekday=extract(dow from starts at time zone av.timezone)::int+1
     and (starts at time zone av.timezone)::date=(ends at time zone av.timezone)::date
     and extract(hour from starts at time zone av.timezone)*60+extract(minute from starts at time zone av.timezone)>=av.start_minute
     and extract(hour from ends at time zone av.timezone)*60+extract(minute from ends at time zone av.timezone)<=av.end_minute)
    then raise exception 'Outside trainer availability' using errcode='23505';end if;
  id_value:=nullif(payload->>'assignment_id','')::uuid;
  if id_value is not null and not exists(select 1 from public.trainer_workout_assignments a where a.id=id_value and a.relationship_id=rel.id and a.status<>'cancelled')
  then raise insufficient_privilege;end if;
  if action='schedule.create' then
   insert into public.trainer_appointments(relationship_id,trainer_id,client_id,start_at,end_at,assignment_id,location,notes)
    values(rel.id,actor,rel.client_id,starts,ends,id_value,coalesce(payload->>'location','Studio'),coalesce(payload->>'notes',''))
    returning to_jsonb(trainer_appointments.*) into result;
  else
   update public.trainer_appointments set relationship_id=rel.id,client_id=rel.client_id,start_at=starts,end_at=ends,
    assignment_id=id_value,location=coalesce(payload->>'location','Studio'),notes=coalesce(payload->>'notes',''),
    status=case when starts<>appt.start_at then 'rescheduled' else status end,
    rescheduled_from=case when starts<>appt.start_at then coalesce(rescheduled_from,appt.start_at) else rescheduled_from end,
    updated_at=now(),version=version+1 where id=appt.id returning to_jsonb(trainer_appointments.*) into result;
   update public.trainer_appointment_changes set resolution='rescheduled',resolved_at=now() where appointment_id=appt.id and resolution='pending';
  end if;
 when 'schedule.status' then
  select * into appt from public.trainer_appointments where id=(payload->>'id')::uuid for update;
  if not found or appt.trainer_id<>actor or not trainerhq_private.allowed(actor,appt.relationship_id,'sessions') then raise insufficient_privilege;end if;
  if appt.version is distinct from (payload->>'version')::bigint or appt.status in ('completed','cancelled','missed')
   then raise exception 'Appointment changed' using errcode='23505';end if;
  if payload->>'status' not in ('confirmed','in_progress','completed','cancelled','missed') then raise invalid_parameter_value;end if;
  if payload->>'status' in ('in_progress','completed','missed') and appt.start_at>now() then raise invalid_parameter_value;end if;
  update public.trainer_appointments set status=payload->>'status',updated_at=now(),version=version+1 where id=appt.id returning to_jsonb(trainer_appointments.*) into result;
  if payload->>'status' in ('completed','cancelled','missed') then
   update public.trainer_appointment_changes set resolution='closed',resolved_at=now() where appointment_id=appt.id and resolution='pending';end if;
 when 'schedule.request_change' then
  select * into appt from public.trainer_appointments where id=(payload->>'id')::uuid for update;
  if not found or appt.client_id<>actor or not trainerhq_private.allowed(actor,appt.relationship_id,'sessions') then raise insufficient_privilege;end if;
  if appt.status in ('completed','cancelled','missed') then raise invalid_parameter_value;end if;
  insert into public.trainer_appointment_changes(appointment_id,client_id,reason) values(appt.id,actor,payload->>'reason') returning to_jsonb(trainer_appointment_changes.*) into result;
 when 'schedule.changes' then
  select coalesce(jsonb_agg(to_jsonb(q)),'[]') into result from (select c.* from public.trainer_appointment_changes c
   join public.trainer_appointments a on a.id=c.appointment_id
   where (a.client_id=actor or trainerhq_private.allowed(actor,a.relationship_id,'sessions'))
   and c.resolution='pending' order by c.created_at limit 200)q;
 when 'schedule.decline_change' then
  select * into change from public.trainer_appointment_changes where id=(payload->>'id')::uuid for update;
  select * into appt from public.trainer_appointments where id=change.appointment_id;
  if appt.trainer_id is distinct from actor or not trainerhq_private.allowed(actor,appt.relationship_id,'sessions') then raise insufficient_privilege;end if;
  update public.trainer_appointment_changes set resolution='declined',resolved_at=now() where id=change.id and resolution='pending';
  result:='{"saved":true}';
 when 'availability.list' then
  rid:=(payload->>'relationship_id')::uuid;
  if rid is not null then
   select * into rel from public.trainer_client_relationships where id=rid;
   if not trainerhq_private.allowed(actor,rid,'sessions') then raise insufficient_privilege;end if;
  end if;
  select coalesce(jsonb_agg(to_jsonb(a) order by a.weekday),'[]') into result from public.trainer_availability a where a.trainer_id=coalesce(rel.trainer_id,actor);
 when 'availability.set' then
  if not trainerhq_private.approved(actor) then raise insufficient_privilege;end if;
  if not exists(select 1 from pg_timezone_names where name=payload->>'timezone')
   or jsonb_typeof(payload->'days')<>'array' or jsonb_array_length(payload->'days')>7 then raise invalid_parameter_value;end if;
  delete from public.trainer_availability where trainer_id=actor;
  insert into public.trainer_availability(trainer_id,weekday,start_minute,end_minute,timezone)
   select actor,(d->>'weekday')::int,(d->>'start_minute')::int,(d->>'end_minute')::int,payload->>'timezone' from jsonb_array_elements(payload->'days') d;
  result:='{"saved":true}';
 when 'messages.open' then
  cid:=trainerhq_private.direct_conversation(actor,(payload->>'relationship_id')::uuid);result:=jsonb_build_object('conversation_id',cid);
 when 'messages.create_group' then
  -- Initial groups are client-led with that client's independently consented trainers.
  if jsonb_array_length(payload->'relationship_ids') not between 2 and 8 then raise invalid_parameter_value;end if;
  insert into public.trainer_conversations(kind,creator_id,title) values('group',actor,payload->>'title') returning id into cid;
  insert into public.trainer_conversation_members values(cid,actor,'client','active',0,0,null,null,false,now());
  for vals in select * from jsonb_array_elements(payload->'relationship_ids') loop
   rid:=(vals#>>'{}')::uuid;
   select * into rel from public.trainer_client_relationships where id=rid;
   if rel.client_id is distinct from actor or not trainerhq_private.allowed(actor,rid,'messaging') then raise insufficient_privilege;end if;
   insert into trainerhq_private.conversation_relationships values(cid,rid);
   insert into public.trainer_conversation_members(conversation_id,user_id,member_role,state) values(cid,rel.trainer_id,'trainer','invited');
  end loop;result:=jsonb_build_object('conversation_id',cid);
 when 'messages.join' then
  cid:=(payload->>'conversation_id')::uuid;
  if not trainerhq_private.approved(actor) then raise insufficient_privilege;end if;
  update public.trainer_conversation_members set state='active',joined_at=now() where conversation_id=cid and user_id=actor and state='invited';
  if not found or not trainerhq_private.message_access(actor,cid) then raise insufficient_privilege;end if;
  update public.trainer_conversations set channel_epoch=gen_random_uuid() where id=cid;
  result:='{"joined":true}';
 when 'messages.threads' then
  select coalesce(jsonb_agg(to_jsonb(q)),'[]') into result from (select c.*,
   (select coalesce(jsonb_agg(jsonb_build_object('user_id',m.user_id,'member_role',m.member_role,'state',m.state,'read_at',m.read_at,'last_read_sequence',m.last_read_sequence)),'[]')
    from public.trainer_conversation_members m where m.conversation_id=c.id and m.state='active') as members,
   me.needs_follow_up,(select count(*) from public.trainer_messages m where m.conversation_id=c.id and m.sequence>me.last_read_sequence and m.sender_id<>actor) as unread_count,
   (select to_jsonb(m) from public.trainer_messages m where m.conversation_id=c.id order by m.sequence desc limit 1) as last_message
   from public.trainer_conversations c join public.trainer_conversation_members me on me.conversation_id=c.id and me.user_id=actor
   where trainerhq_private.message_access(actor,c.id) and (not payload ? 'after' or c.id>(payload->>'after')::uuid) order by c.id limit 100)q;
 when 'messages.invitations' then
  select coalesce(jsonb_agg(jsonb_build_object('conversation_id',c.id,'title',c.title,'creator_id',c.creator_id)),'[]') into result
   from public.trainer_conversations c join public.trainer_conversation_members m on m.conversation_id=c.id
   where m.user_id=actor and m.state='invited';
 when 'messages.list' then
  cid:=(payload->>'conversation_id')::uuid;
  if not trainerhq_private.message_access(actor,cid) then raise insufficient_privilege;end if;
  select coalesce(jsonb_agg(to_jsonb(q)),'[]') into result from (select m.*,
   coalesce((select jsonb_agg(jsonb_build_object('user_id',rc.recipient_id,'delivered_at',rc.delivered_at,'read_at',rc.read_at,
    'delivered',rc.delivered_at is not null,'read',rc.read_at is not null))
    from public.trainer_message_receipts rc where rc.message_id=m.id and rc.recipient_id<>m.sender_id),'[]') as receipts,
   coalesce((select jsonb_agg(to_jsonb(a)) from public.trainer_message_attachments a where a.message_id=m.id and a.state='ready'),'[]') as attachments
   from public.trainer_messages m where m.conversation_id=cid and m.sequence>coalesce((payload->>'after_sequence')::bigint,0) order by m.sequence limit 100)q;
 when 'messages.send' then
  result:=trainerhq_private.send_message(actor,(payload->>'conversation_id')::uuid,payload->>'text');
 when 'messages.batch' then
  if not trainerhq_private.approved(actor) or jsonb_array_length(payload->'relationship_ids') not between 1 and 100 then raise insufficient_privilege;end if;
  result:='[]';
  for vals in select distinct value from jsonb_array_elements(payload->'relationship_ids') order by value loop
   rid:=(vals#>>'{}')::uuid;
   if not exists(select 1 from public.trainer_client_relationships r where r.id=rid and r.trainer_id=actor) then raise insufficient_privilege;end if;
   cid:=trainerhq_private.direct_conversation(actor,rid);
   result:=result||jsonb_build_array(trainerhq_private.send_message(actor,cid,payload->>'text'));
  end loop;
 when 'messages.read','messages.delivered','messages.follow_up' then
  cid:=(payload->>'conversation_id')::uuid;
  if not trainerhq_private.message_access(actor,cid) then raise insufficient_privilege;end if;
  if action='messages.follow_up' then
   update public.trainer_conversation_members set needs_follow_up=(payload->>'needed')::boolean where conversation_id=cid and user_id=actor;
  else
   select last_sequence into seq from public.trainer_conversations where id=cid;
   seq:=least(seq,coalesce((payload->>'sequence')::bigint,seq));
   if seq<0 then raise invalid_parameter_value;end if;
   insert into public.trainer_message_receipts(message_id,recipient_id,delivered_at,read_at)
    select m.id,actor,now(),case when action='messages.read' then now() end from public.trainer_messages m
    where m.conversation_id=cid and m.sequence<=seq
    on conflict(message_id,recipient_id) do update set delivered_at=coalesce(trainer_message_receipts.delivered_at,excluded.delivered_at),
     read_at=coalesce(trainer_message_receipts.read_at,excluded.read_at);
   update public.trainer_conversation_members set last_delivered_sequence=greatest(last_delivered_sequence,seq),delivered_at=now(),
    last_read_sequence=case when action='messages.read' then greatest(last_read_sequence,seq) else last_read_sequence end,
    read_at=case when action='messages.read' then now() else read_at end where conversation_id=cid and user_id=actor;
  end if;result:='{"saved":true}';
 when 'media.reserve' then
  id_value:=(payload->>'message_id')::uuid;
  select conversation_id into cid from public.trainer_messages where id=id_value and sender_id=actor;
  if cid is null or not trainerhq_private.message_access(actor,cid) then raise insufficient_privilege;end if;
  if (select count(*) from public.trainer_message_attachments where message_id=id_value)>=5 then raise invalid_parameter_value;end if;
  insert into public.trainer_message_attachments(message_id,owner_id,object_path,mime_type,byte_count)
   values(id_value,actor,cid::text||'/'||gen_random_uuid()::text,payload->>'mime_type',(payload->>'byte_count')::bigint)
   returning to_jsonb(trainer_message_attachments.*) into result;
 when 'media.complete' then
  select m.conversation_id into cid from public.trainer_message_attachments a join public.trainer_messages m on m.id=a.message_id
   where a.id=(payload->>'id')::uuid and a.owner_id=actor;
  if cid is null or not trainerhq_private.message_access(actor,cid) then raise insufficient_privilege;end if;
  if not exists(select 1 from storage.objects o join public.trainer_message_attachments a on a.object_path=o.name and a.bucket=o.bucket_id
    where a.id=(payload->>'id')::uuid and (o.metadata->>'size')::bigint=a.byte_count and o.metadata->>'mimetype'=a.mime_type)
   then raise exception 'Upload is incomplete' using errcode='22023';end if;
  update public.trainer_message_attachments set state='ready' where id=(payload->>'id')::uuid;
  result:='{"saved":true}';
 when 'reminders.list' then
  select coalesce(jsonb_agg(to_jsonb(q)),'[]') into result from (select r.* from public.trainer_reminders r where r.trainer_id=actor order by r.updated_at desc limit 200)q;
 when 'reminders.save' then
  if not trainerhq_private.approved(actor) then raise insufficient_privilege;end if;
  insert into public.trainer_reminders(id,trainer_id,text,is_completed) values((payload->>'id')::uuid,actor,payload->>'text',coalesce((payload->>'is_completed')::boolean,false))
   on conflict(id) do update set text=excluded.text,is_completed=excluded.is_completed,updated_at=now() where trainer_reminders.trainer_id=actor;
  if not found then raise insufficient_privilege;end if;result:='{"saved":true}';
 when 'reminders.delete' then
  delete from public.trainer_reminders where id=(payload->>'id')::uuid and trainer_id=actor;result:='{"saved":true}';
 else result:=trainerhq_private.later_command(actor,action,payload);
 end case;
 return coalesce(result,'{}');
end $$;

create or replace function trainerhq_private.replay_allowed(actor uuid, action text, payload jsonb) returns boolean
language sql stable security definer set search_path='' as $$
 select case
 when action='trainer.apply' then true
 when action='trainer.review' then exists(select 1 from trainerhq_private.platform_administrators where user_id=actor)
 when action='invitation.create' then trainerhq_private.approved(actor)
 when action='invitation.respond' then exists(select 1 from trainerhq_private.invitations i join auth.users u
  on trainerhq_private.hash(lower(trim(u.email)))=i.recipient_email_hash where u.id=actor and i.token_hash=trainerhq_private.hash(payload->>'token'))
 when action='relationship.update' then exists(select 1 from public.trainer_client_relationships r where r.id=(payload->>'relationship_id')::uuid and r.client_id=actor)
 when action in ('assignment.create') then trainerhq_private.allowed(actor,(payload->>'relationship_id')::uuid,'workouts')
 when action='assignment.accept' then exists(select 1 from public.trainer_workout_assignments a where a.id=(payload->>'assignment_id')::uuid and a.client_id=actor)
 when action in ('schedule.create','schedule.update') then trainerhq_private.allowed(actor,(payload->>'relationship_id')::uuid,'sessions')
 when action in ('schedule.status','schedule.request_change') then exists(select 1 from public.trainer_appointments a where a.id=(payload->>'id')::uuid and trainerhq_private.allowed(actor,a.relationship_id,'sessions'))
 when action='schedule.decline_change' then exists(select 1 from public.trainer_appointment_changes c join public.trainer_appointments a on a.id=c.appointment_id where c.id=(payload->>'id')::uuid and trainerhq_private.allowed(actor,a.relationship_id,'sessions'))
 when action='messages.open' then trainerhq_private.allowed(actor,(payload->>'relationship_id')::uuid,'messaging')
 when action in ('messages.send','messages.read','messages.delivered','messages.follow_up','messages.join') then trainerhq_private.message_access(actor,(payload->>'conversation_id')::uuid)
 when action in ('messages.batch','messages.create_group') then not exists(select 1 from jsonb_array_elements_text(payload->'relationship_ids') x where not trainerhq_private.allowed(actor,x::uuid,'messaging'))
 when action like 'reminders.%' or action='availability.set' then trainerhq_private.approved(actor)
 when action='media.reserve' then exists(select 1 from public.trainer_messages m where m.id=(payload->>'message_id')::uuid and trainerhq_private.message_access(actor,m.conversation_id))
 when action='media.complete' then exists(select 1 from public.trainer_message_attachments a join public.trainer_messages m on m.id=a.message_id where a.id=(payload->>'id')::uuid and trainerhq_private.message_access(actor,m.conversation_id))
 else false end
$$;
revoke all on all functions in schema trainerhq_private from public,anon,authenticated,service_role;
grant execute on function trainerhq_private.request_actor(), trainerhq_private.relationship_party(uuid,uuid),
 trainerhq_private.request_allowed(uuid,text), trainerhq_private.request_message_access(uuid),trainerhq_private.request_attachment_access(text,boolean) to authenticated;
grant execute on function trainerhq_private.api(uuid,uuid,text,jsonb) to service_role;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('trainerhq-message-attachments','trainerhq-message-attachments',false,10485760,array['image/jpeg','image/png','application/pdf']);
create policy trainerhq_attachment_download on storage.objects for select to authenticated
 using(bucket_id='trainerhq-message-attachments' and trainerhq_private.request_attachment_access(name,false));
create policy trainerhq_attachment_upload on storage.objects for insert to authenticated
 with check(bucket_id='trainerhq-message-attachments' and trainerhq_private.request_attachment_access(name,true));

-- Keep read operations free of mutation idempotency records.
create or replace function trainerhq_private.api(actor uuid, session uuid, action text, payload jsonb) returns jsonb
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
    'messages.invitations','reminders.list','adherence.report','media.read','realtime.topics');
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

