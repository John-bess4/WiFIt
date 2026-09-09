-- Rollback-only fixtures. Verify target selection on both sides of the UTC date boundary.
do $test$
declare
 trainer uuid:=gen_random_uuid(); client uuid:=gen_random_uuid();
 tsession uuid:=gen_random_uuid(); csession uuid:=gen_random_uuid(); relationship uuid:=gen_random_uuid();
 zone text; client_day date; target_id uuid; result jsonb; n int:=0;
begin
 begin
  insert into auth.users(id,aud,role,email,email_confirmed_at) values
   (trainer,'authenticated','authenticated',trainer||'@example.invalid',now()),
   (client,'authenticated','authenticated',client||'@example.invalid',now());
  insert into auth.sessions(id,user_id) values(tsession,trainer),(csession,client);
  insert into public.profiles(id,name,cal_goal,protein_goal,carbs_goal,fat_goal) values(client,'Timezone fixture',2000,100,200,60);
  insert into public.trainer_profiles(user_id,display_name,approval_status) values(trainer,'Timezone fixture trainer','approved');
  insert into public.trainer_client_relationships(id,trainer_id,client_id,state,accepted_at,activated_at)
   values(relationship,trainer,client,'active',now(),now());
  insert into public.trainer_client_permissions(relationship_id,scope) values(relationship,'nutrition');
  set constraints all immediate;set constraints all deferred;
  foreach zone in array array['Pacific/Kiritimati','Pacific/Honolulu'] loop
   client_day:=(now() at time zone zone)::date;
   insert into public.client_tracking_preferences(user_id,timezone) values(client,zone)
    on conflict(user_id) do update set timezone=excluded.timezone;
   insert into public.client_nutrition_targets(user_id,effective_from,calories,protein,carbs,fat,weekdays)
    select client,client_day+offset_days,2000+offset_days*100,100,200,60,array[1,2,3,4,5,6,7]
    from unnest(array[-1,0,1]) offset_days
    on conflict(user_id,effective_from) do update set calories=excluded.calories;
   select id into target_id from public.client_nutrition_targets where user_id=client and effective_from=client_day;
   result:=trainerhq_private.api(client,csession,'tracking.get','{}');
   if (result#>>'{nutrition_target,id}')::uuid is distinct from target_id then raise exception 'Client target used database day instead of client day';end if;n:=n+1;
   result:=trainerhq_private.api(trainer,tsession,'client.targets',jsonb_build_object('relationship_id',relationship));
   if (result#>>'{nutrition_target,id}')::uuid is distinct from target_id then raise exception 'Trainer target used database day instead of client day';end if;n:=n+1;
  end loop;
  update public.trainer_client_permissions set granted=false where relationship_id=relationship and scope='nutrition';
  begin perform trainerhq_private.api(trainer,tsession,'client.targets',jsonb_build_object('relationship_id',relationship));raise exception 'Unshared target exposed';
   exception when insufficient_privilege then n:=n+1;end;
  result:=trainerhq_private.api(client,csession,'tracking.get','{}');
  if (result#>>'{nutrition_target,id}')::uuid is distinct from target_id then raise exception 'Client lost own target after trainer revocation';end if;n:=n+1;
  raise exception using errcode='ZX001',message=n::text;
 exception when sqlstate 'ZX001' then perform set_config('trainerhq.timezone_assertions',sqlerrm,true);end;
end $test$;
select 'passed' as result,current_setting('trainerhq.timezone_assertions')::int as assertions;
