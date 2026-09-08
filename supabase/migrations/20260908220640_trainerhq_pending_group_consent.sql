-- Additive replacement of the TrainerHQ function only. No WiFit table/policy changes.
-- Rollback: supabase/rollbacks/trainerhq_disable.sql.
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
   where m.user_id=actor and m.state='invited' and c.state='open'
    and trainerhq_private.approved(actor)
    and exists(select 1 from trainerhq_private.conversation_relationships cr
      join public.trainer_client_relationships r on r.id=cr.relationship_id
      where cr.conversation_id=c.id and r.trainer_id=actor and r.client_id=c.creator_id
       and trainerhq_private.allowed(actor,r.id,'messaging'));
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
