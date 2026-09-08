-- Versioned derived summaries, consent-filtered invalidations and APNs preparation.
-- No WiFit log or policy is replaced. Delivery stays disabled until configured.
create table trainerhq_private.adherence_rules (
 version integer primary key, effective_from date not null unique,
 calorie_weight numeric not null, protein_weight numeric not null, carb_weight numeric not null, fat_weight numeric not null,
 calorie_tolerance numeric not null, macro_tolerance numeric not null,
 created_at timestamptz not null default now(),
 check(calorie_weight>=0 and protein_weight>=0 and carb_weight>=0 and fat_weight>=0),
 check(calorie_weight+protein_weight+carb_weight+fat_weight=1),
 check(calorie_tolerance between 0 and 0.5 and macro_tolerance between 0 and 0.5)
);
insert into trainerhq_private.adherence_rules values(1,'1900-01-01',0.5,0.3,0.1,0.1,0.10,0.15,now());
create table public.client_tracking_preferences (
 user_id uuid primary key references auth.users(id), timezone text not null,
 cutoff_minute integer not null default 1440 check(cutoff_minute between 1 and 1440),
 updated_at timestamptz not null default now(), version bigint not null default 1
);
-- Client explicitly confirms tracking and targets. Changes create new dated versions.
create table public.client_nutrition_targets (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id),
 effective_from date not null, enabled boolean not null default true,
 calories numeric not null check(calories>0), protein numeric not null check(protein>0),
 carbs numeric not null check(carbs>0), fat numeric not null check(fat>0),
 weekdays integer[] not null check(cardinality(weekdays) between 1 and 7 and weekdays <@ array[1,2,3,4,5,6,7]),
 created_at timestamptz not null default now(), unique(user_id,effective_from)
);
create table trainerhq_private.adherence_summaries (
 id uuid primary key default gen_random_uuid(), relationship_id uuid not null references public.trainer_client_relationships(id),
 day date not null, category text not null check(category in ('workouts','diet','supplements','sessions')),
 calculation_version integer not null references trainerhq_private.adherence_rules(version),
 source_hash text not null, score numeric check(score between 0 and 1), state text not null,
 generated_at timestamptz not null default now(), unique(relationship_id,day,category,calculation_version,source_hash)
);
create index trainerhq_adherence_relationship_day on trainerhq_private.adherence_summaries(relationship_id,day);
create table public.trainer_notification_preferences (
 user_id uuid primary key references auth.users(id), messages boolean not null default true,
 schedule boolean not null default true, assignments boolean not null default true, updated_at timestamptz not null default now()
);
create table trainerhq_private.push_applications (
 app text primary key check(app in ('trainerhq','wifit')), bundle_id text not null unique,
 enabled boolean not null default false
);
-- No fabricated production bundle identifier or Apple credential is seeded.
create table trainerhq_private.device_installations (
 installation_id uuid not null, app text not null references trainerhq_private.push_applications(app),
 user_id uuid not null references auth.users(id), session_id uuid not null,
 environment text not null check(environment in ('sandbox','production')),
 token text not null check(token ~ '^[0-9a-f]{64,512}$'),
 updated_at timestamptz not null default now(), invalidated_at timestamptz,
 primary key(installation_id,app), unique(app,environment,token)
);
create index trainerhq_installations_user on trainerhq_private.device_installations(user_id);
create table trainerhq_private.notification_jobs (
 id uuid primary key default gen_random_uuid(), recipient_id uuid not null references auth.users(id),
 kind text not null check(kind in ('message','schedule','assignment')), resource_id uuid not null,
 relationship_id uuid references public.trainer_client_relationships(id), conversation_id uuid references public.trainer_conversations(id),
 resource_version bigint not null default 1,
 state text not null default 'awaiting_configuration' check(state in ('awaiting_configuration','pending','claimed','sent','failed','cancelled')),
 attempts integer not null default 0, created_at timestamptz not null default now(), sent_at timestamptz,
 unique(recipient_id,kind,resource_id,resource_version)
);
create index trainerhq_notifications_delivery on trainerhq_private.notification_jobs(state,created_at);
create table trainerhq_private.integration_diagnostics (
 id bigint generated always as identity primary key, component text not null, error_code text not null,
 occurred_at timestamptz not null default now()
);

do $$ declare t text;begin
 foreach t in array array['adherence_rules','adherence_summaries','push_applications','device_installations','notification_jobs','integration_diagnostics'] loop
 execute format('alter table trainerhq_private.%I enable row level security',t);
 execute format('revoke all on trainerhq_private.%I from public,anon,authenticated,service_role',t);
 end loop;
 foreach t in array array['client_tracking_preferences','client_nutrition_targets','trainer_notification_preferences'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from public,anon,authenticated',t);
 execute format('grant select on public.%I to authenticated',t);
 execute format('create policy trainerhq_owner_read on public.%I for select to authenticated using(user_id=(select trainerhq_private.request_actor()))',t);
 end loop;
end $$;
create function trainerhq_private.range_score(actual numeric, target numeric, tolerance numeric, minimum_only boolean default false)
returns numeric language sql immutable set search_path='' as $$
 select case when actual is null or target is null or target<=0 then null
 when minimum_only then least(1,greatest(0,actual/target))
 when actual between target*(1-tolerance) and target*(1+tolerance) then 1
 when actual<target*(1-tolerance) then greatest(0,actual/(target*(1-tolerance)))
 else greatest(0,1-(actual-target*(1+tolerance))/target) end
$$;
create function trainerhq_private.adherence_day(actor uuid,rid uuid,day_value date) returns jsonb
language plpgsql security definer set search_path='' as $$
declare rel public.trainer_client_relationships; prefs public.client_tracking_preferences; target public.client_nutrition_targets;
 rule trainerhq_private.adherence_rules; category text; scope text; state_value text; score_value numeric;
 expected numeric; completed numeric; food_rows int; kcal numeric; protein_g numeric; carbs_g numeric; fat_g numeric;
 result jsonb:='{}'; item jsonb; total numeric:=0; coverage int:=0; deadline timestamptz; has_config boolean; stamp text;
begin
 select * into rel from public.trainer_client_relationships where id=rid;
 if not found or rel.state<>'active' or not trainerhq_private.approved(rel.trainer_id) or actor not in(rel.client_id,rel.trainer_id)
 then raise insufficient_privilege;end if;
 select * into prefs from public.client_tracking_preferences where user_id=rel.client_id;
 select * into rule from trainerhq_private.adherence_rules where effective_from<=day_value order by effective_from desc limit 1;
 select * into target from public.client_nutrition_targets where user_id=rel.client_id and effective_from<=day_value order by effective_from desc limit 1;
 deadline:=(day_value::timestamp + make_interval(mins=>coalesce(prefs.cutoff_minute,1440))) at time zone coalesce(prefs.timezone,'UTC');
 foreach category in array array['workouts','diet','supplements','sessions'] loop
  scope:=case when category='diet' then 'nutrition_adherence' else category end;
  state_value:='available';score_value:=null;expected:=0;completed:=0;has_config:=false;
  if actor=rel.trainer_id and not trainerhq_private.allowed(actor,rid,scope) then state_value:='not_shared';
  elsif day_value>(now() at time zone coalesce(prefs.timezone,'UTC'))::date then state_value:='not_eligible';
  elsif prefs.user_id is null then state_value:='not_configured';
  else
   case category
   when 'diet' then
    if target.id is null or not target.enabled then state_value:='not_configured';
    elsif not (extract(dow from day_value)::int+1=any(target.weekdays)) then state_value:='not_eligible';
    else
     select count(*),coalesce(sum(round(coalesce(per100_cal,0)*coalesce(grams,0)/100)),0),
      coalesce(sum(round(coalesce(per100_protein,0)*coalesce(grams,0)/100)),0),
      coalesce(sum(round(coalesce(per100_carbs,0)*coalesce(grams,0)/100)),0),
      coalesce(sum(round(coalesce(per100_fat,0)*coalesce(grams,0)/100)),0)
      into food_rows,kcal,protein_g,carbs_g,fat_g from public.food_log where user_id=rel.client_id and logged_date=day_value;
     expected:=1;completed:=case when food_rows>0 then 1 else 0 end;
     if food_rows=0 and now()<deadline then state_value:='pending';
     else
      score_value:=rule.calorie_weight*trainerhq_private.range_score(kcal,target.calories,rule.calorie_tolerance)
       +rule.protein_weight*trainerhq_private.range_score(protein_g,target.protein,0,true)
       +rule.carb_weight*trainerhq_private.range_score(carbs_g,target.carbs,rule.macro_tolerance)
       +rule.fat_weight*trainerhq_private.range_score(fat_g,target.fat,rule.macro_tolerance);
      if food_rows=0 then state_value:='incomplete';end if;
     end if;
    end if;
   when 'workouts' then
    select exists(select 1 from public.trainer_workout_assignments a where a.relationship_id=rid and a.due_date<=day_value and a.status<>'cancelled') into has_config;
    select count(*),count(*) filter(where exists(select 1 from public.workout_sessions ws
      where ws.user_id=rel.client_id and ws.trainer_assignment_id=a.id and ws.completed_date=day_value))
     into expected,completed from public.trainer_workout_assignments a where a.relationship_id=rid and a.due_date=day_value and a.status<>'cancelled';
   when 'supplements' then
    select count(*),count(*) filter(where exists(select 1 from public.supplement_log sl where sl.user_id=rel.client_id and sl.supplement_id=s.id and sl.log_date=day_value and sl.taken))
     into expected,completed from public.supplement_stack s where s.user_id=rel.client_id
      and least((s.created_at at time zone prefs.timezone)::date,
       (select min(sl.log_date) from public.supplement_log sl where sl.supplement_id=s.id and sl.user_id=s.user_id))<=day_value;
    has_config:=expected>0;
   when 'sessions' then
    select exists(select 1 from public.trainer_appointments a where a.relationship_id=rid and (a.start_at at time zone prefs.timezone)::date<=day_value and a.status<>'cancelled') into has_config;
    select count(*),count(*) filter(where status='completed') into expected,completed from public.trainer_appointments
      where relationship_id=rid and (start_at at time zone prefs.timezone)::date=day_value and status<>'cancelled';
   end case;
   if category<>'diet' then
    if not has_config then state_value:='not_configured';
    elsif expected=0 then state_value:='not_eligible';
    elsif completed<expected and now()<deadline then state_value:='pending';
    else score_value:=completed/expected;state_value:=case when completed=0 then 'incomplete' else 'available' end;end if;
   end if;
  end if;
  item:=jsonb_build_object('state',state_value,'score',score_value,'calculation_version',rule.version);
  -- Only aggregate adherence is exposed under aggregate-only consent, never macro values.
  if state_value not in ('not_shared','not_configured') then item:=item||jsonb_build_object('completed',completed,'expected',expected);end if;
  result:=result||jsonb_build_object(category,item);
  if score_value is not null then total:=total+score_value;coverage:=coverage+1;end if;
  if state_value not in ('not_shared','pending','not_configured','not_eligible') then
   stamp:=trainerhq_private.hash((item||jsonb_build_object('target_id',case when category='diet' then target.id end))::text);
   insert into trainerhq_private.adherence_summaries(relationship_id,day,category,calculation_version,source_hash,score,state)
    values(rid,day_value,category,rule.version,stamp,score_value,state_value) on conflict do nothing;
  end if;
 end loop;
 return jsonb_build_object('date',day_value,'categories',result,'coverage',coverage,'total_categories',4,
  'overall_score',case when coverage>=2 then total/coverage end,
  'overall_state',case when coverage>=2 then 'available' else 'insufficient_shared_data' end,
  'calculation_version',rule.version);
end $$;

create function trainerhq_private.topic_allowed(actor uuid,topic_value text) returns boolean
language sql stable security definer set search_path='' as $$
 select actor is not null and (topic_value='thq:account:'||actor::text or
 exists(select 1 from public.trainer_client_relationships r where topic_value='thq:relationship:'||r.id::text||':'||r.channel_epoch::text
  and r.state='active' and trainerhq_private.approved(r.trainer_id) and actor in(r.client_id,r.trainer_id)
  and exists(select 1 from public.trainer_client_permissions p where p.relationship_id=r.id and p.granted)) or
 exists(select 1 from public.trainer_conversations c where topic_value='thq:conversation:'||c.id::text||':'||c.channel_epoch::text
  and trainerhq_private.message_access(actor,c.id)))
$$;
create function trainerhq_private.request_topic_allowed(topic_value text) returns boolean
language sql stable security definer set search_path='' as $$ select trainerhq_private.topic_allowed(trainerhq_private.request_actor(),topic_value) $$;
create policy trainerhq_private_broadcast_receive on realtime.messages for select to authenticated
 using(extension='broadcast' and trainerhq_private.request_topic_allowed(realtime.topic()));
-- No client Broadcast INSERT policy: messages must first persist through the authorized API.
create function trainerhq_private.invalidate(topic_value text) returns void
language plpgsql security definer set search_path='' as $$ begin
 if not exists(select 1 from trainerhq_private.integration_control where enabled) then return;end if;
 perform realtime.send('{"refresh":true}'::jsonb,'invalidate',topic_value,true);
 exception when others then
 -- A Realtime outage must never roll back a WiFit fitness log. Record only SQLSTATE.
 begin insert into trainerhq_private.integration_diagnostics(component,error_code) values('realtime',sqlstate);exception when others then null;end;
end $$;
create function trainerhq_private.log_changed() returns trigger
language plpgsql security definer set search_path='' as $$
declare owner_id uuid; category text; rel public.trainer_client_relationships;
begin
 if tg_op='DELETE' then owner_id:=old.user_id;else owner_id:=new.user_id;end if;
 category:=case tg_table_name when 'food_log' then 'nutrition' when 'workout_sessions' then 'workouts'
 when 'body_weight_log' then 'measurements' else 'supplements' end;
 for rel in select r.* from public.trainer_client_relationships r where r.client_id=owner_id and r.state='active' and trainerhq_private.approved(r.trainer_id)
  and exists(select 1 from public.trainer_client_permissions p where p.relationship_id=r.id and p.granted
   and (p.scope=category or (category='nutrition' and p.scope='nutrition_adherence'))) loop
  perform trainerhq_private.invalidate('thq:relationship:'||rel.id::text||':'||rel.channel_epoch::text);
 end loop;
 return null;
 exception when others then
 begin insert into trainerhq_private.integration_diagnostics(component,error_code) values('log_invalidation',sqlstate);exception when others then null;end;
 return null;
end $$;
do $$ declare t text;begin
 foreach t in array array['food_log','workout_sessions','supplement_log','supplement_stack','body_weight_log'] loop
 execute format('create trigger trainerhq_log_invalidation after insert or update or delete on public.%I for each row execute function trainerhq_private.log_changed()',t);
 end loop;
end $$;
create function trainerhq_private.domain_changed() returns trigger
language plpgsql security definer set search_path='' as $$
declare cid uuid; rid uuid; participant uuid; rel public.trainer_client_relationships; conversation public.trainer_conversations;
begin
 if tg_table_name in ('trainer_messages','trainer_message_attachments','trainer_conversation_members') then
  if tg_table_name='trainer_message_attachments' then select conversation_id into cid from public.trainer_messages where id=new.message_id;else cid:=new.conversation_id;end if;
  select * into conversation from public.trainer_conversations where id=cid;
  perform trainerhq_private.invalidate('thq:conversation:'||cid::text||':'||conversation.channel_epoch::text);
  for participant in select user_id from public.trainer_conversation_members where conversation_id=cid and state='active' and trainerhq_private.message_access(user_id,cid) loop
   perform trainerhq_private.invalidate('thq:account:'||participant::text);
   if tg_table_name='trainer_messages' then
    if participant<>new.sender_id then
    insert into trainerhq_private.notification_jobs(recipient_id,kind,resource_id,conversation_id) values(participant,'message',new.id,cid) on conflict do nothing;
    end if;
   end if;
  end loop;
 else
  if tg_table_name='trainer_client_permissions' then rid:=new.relationship_id;
  elsif tg_table_name='trainer_client_relationships' then rid:=new.id;
  else rid:=new.relationship_id;end if;
  select * into rel from public.trainer_client_relationships where id=rid;
  perform trainerhq_private.invalidate('thq:account:'||rel.trainer_id::text);
  if rel.client_id is not null then perform trainerhq_private.invalidate('thq:account:'||rel.client_id::text);end if;
  if rel.state='active' then perform trainerhq_private.invalidate('thq:relationship:'||rid::text||':'||rel.channel_epoch::text);end if;
  if tg_table_name in ('trainer_workout_assignments','trainer_appointments') then
   insert into trainerhq_private.notification_jobs(recipient_id,kind,resource_id,relationship_id,resource_version)
    values(rel.client_id,case when tg_table_name='trainer_appointments' then 'schedule' else 'assignment' end,new.id,rid,new.version) on conflict do nothing;
  end if;
 end if;
 return null;
 exception when others then
 begin insert into trainerhq_private.integration_diagnostics(component,error_code) values('domain_invalidation',sqlstate);exception when others then null;end;
 return null;
end $$;
do $$ declare t text;begin
 foreach t in array array['trainer_messages','trainer_message_attachments','trainer_conversation_members','trainer_client_relationships','trainer_client_permissions','trainer_workout_assignments','trainer_appointments'] loop
 execute format('create constraint trigger trainerhq_domain_invalidation after insert or update on public.%I deferrable initially deferred for each row execute function trainerhq_private.domain_changed()',t);
 end loop;
end $$;

create or replace function trainerhq_private.later_command(actor uuid,action text,payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb; rel public.trainer_client_relationships; target public.profiles; prefs public.client_tracking_preferences;
 starts date; ends date; d date; sid uuid;
begin
 case action
 when 'client.targets' then
  select * into rel from public.trainer_client_relationships where id=(payload->>'relationship_id')::uuid;
  if not trainerhq_private.allowed(actor,rel.id,'nutrition') then raise insufficient_privilege;end if;
  result:=jsonb_build_object('wifit_targets',(select jsonb_build_object('calories',p.cal_goal,'protein',p.protein_goal,'carbs',p.carbs_goal,'fat',p.fat_goal) from public.profiles p where p.id=rel.client_id),
   'nutrition_target',(select to_jsonb(t) from public.client_nutrition_targets t where user_id=rel.client_id and effective_from<=current_date order by effective_from desc limit 1));
 when 'tracking.get' then
  result:=jsonb_build_object('preferences',(select to_jsonb(p) from public.client_tracking_preferences p where user_id=actor),
   'nutrition_target',(select to_jsonb(t) from public.client_nutrition_targets t where user_id=actor and effective_from<=current_date order by effective_from desc limit 1),
   'wifit_targets',(select jsonb_build_object('calories',p.cal_goal,'protein',p.protein_goal,'carbs',p.carbs_goal,'fat',p.fat_goal) from public.profiles p where p.id=actor));
 when 'tracking.configure' then
  if not exists(select 1 from pg_timezone_names where name=payload->>'timezone') then raise invalid_parameter_value;end if;
  insert into public.client_tracking_preferences(user_id,timezone,cutoff_minute) values(actor,payload->>'timezone',coalesce((payload->>'cutoff_minute')::int,1440))
   on conflict(user_id) do update set timezone=excluded.timezone,cutoff_minute=excluded.cutoff_minute,updated_at=now(),version=client_tracking_preferences.version+1;
  if payload ? 'nutrition_enabled' then
   select * into target from public.profiles where id=actor;
   if not found then raise invalid_parameter_value;end if;
   d:=(now() at time zone (payload->>'timezone'))::date;
   -- Same-day corrections are explicit; prior dates/targets are immutable.
   insert into public.client_nutrition_targets(user_id,effective_from,enabled,calories,protein,carbs,fat,weekdays)
    values(actor,d,(payload->>'nutrition_enabled')::boolean,target.cal_goal,target.protein_goal,target.carbs_goal,target.fat_goal,
     case when payload ? 'weekdays' then array(select jsonb_array_elements_text(payload->'weekdays')::int) else array[1,2,3,4,5,6,7] end)
    on conflict(user_id,effective_from) do update set enabled=excluded.enabled,calories=excluded.calories,protein=excluded.protein,carbs=excluded.carbs,fat=excluded.fat,weekdays=excluded.weekdays;
  end if;
  result:='{"saved":true}';
 when 'adherence.report' then
  starts:=(payload->>'from')::date;ends:=(payload->>'until')::date;
  if starts is null or ends is null or ends<=starts or ends-starts>93 then raise invalid_parameter_value;end if;
  result:='[]';
  for d in select generate_series(starts,ends-1,interval '1 day')::date loop
   result:=result||jsonb_build_array(trainerhq_private.adherence_day(actor,(payload->>'relationship_id')::uuid,d));end loop;
 when 'realtime.topics' then
  select coalesce(jsonb_agg(topic),'[]') into result from (
   select 'thq:account:'||actor::text as topic
   union all select 'thq:relationship:'||r.id::text||':'||r.channel_epoch::text from public.trainer_client_relationships r
    where r.state='active' and actor in(r.client_id,r.trainer_id) and trainerhq_private.approved(r.trainer_id)
     and exists(select 1 from public.trainer_client_permissions p where p.relationship_id=r.id and p.granted)
   union all select 'thq:conversation:'||c.id::text||':'||c.channel_epoch::text from public.trainer_conversations c where trainerhq_private.message_access(actor,c.id))q;
 when 'notifications.preferences' then
  select coalesce((select to_jsonb(p) from public.trainer_notification_preferences p where user_id=actor),'{"messages":true,"schedule":true,"assignments":true}') into result;
 when 'notifications.configure' then
  insert into public.trainer_notification_preferences(user_id,messages,schedule,assignments)
   values(actor,(payload->>'messages')::boolean,(payload->>'schedule')::boolean,(payload->>'assignments')::boolean)
   on conflict(user_id) do update set messages=excluded.messages,schedule=excluded.schedule,assignments=excluded.assignments,updated_at=now();result:='{"saved":true}';
 when 'device.register' then
  if not exists(select 1 from trainerhq_private.push_applications where app=payload->>'app' and bundle_id=payload->>'bundle_id') then
   raise exception 'Push application is not configured' using errcode='22023';end if;
  -- Session ID is supplied exclusively by the secured gateway, never from the app.
  sid:=(payload->>'verified_session_id')::uuid;
  if not trainerhq_private.valid_session(actor,sid) then raise insufficient_privilege;end if;
  insert into trainerhq_private.device_installations(installation_id,app,user_id,session_id,environment,token)
   values((payload->>'installation_id')::uuid,payload->>'app',actor,sid,payload->>'environment',lower(payload->>'token'))
   on conflict(installation_id,app) do update set user_id=excluded.user_id,session_id=excluded.session_id,environment=excluded.environment,token=excluded.token,updated_at=now(),invalidated_at=null;
  result:='{"registered":true,"delivery_enabled":false}';
 when 'device.unregister' then
  update trainerhq_private.device_installations set invalidated_at=now() where installation_id=(payload->>'installation_id')::uuid and app=payload->>'app' and user_id=actor;
  result:='{"saved":true}';
 else raise exception 'Unknown operation' using errcode='22023';
 end case;
 return result;
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
 when action in ('tracking.configure','notifications.configure','device.register','device.unregister') then true
 else false end
$$;

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
    'client.targets','tracking.get','notifications.preferences','messages.invitations','reminders.list','adherence.report','media.read','realtime.topics');
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


revoke all on all functions in schema trainerhq_private from public,anon,authenticated,service_role;
grant execute on function trainerhq_private.request_actor(),trainerhq_private.relationship_party(uuid,uuid),trainerhq_private.request_allowed(uuid,text),
 trainerhq_private.request_message_access(uuid),trainerhq_private.request_attachment_access(text,boolean),trainerhq_private.request_topic_allowed(text) to authenticated;
grant execute on function trainerhq_private.api(uuid,uuid,text,jsonb) to service_role;
