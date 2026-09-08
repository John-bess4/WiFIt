do $test$
declare t uuid:=gen_random_uuid(); stranger uuid:=gen_random_uuid(); c uuid:=gen_random_uuid();
 st uuid:=gen_random_uuid(); sx uuid:=gen_random_uuid(); sc uuid:=gen_random_uuid();r uuid:=gen_random_uuid();supp uuid:=gen_random_uuid();
 day_value date:=current_date-2;result jsonb;item jsonb;n int:=0;old_topic text;cid uuid;mid uuid;
begin
 begin
 insert into auth.users(id,aud,role,email,email_confirmed_at) values(t,'authenticated','authenticated',t||'@example.invalid',now()),(stranger,'authenticated','authenticated',stranger||'@example.invalid',now()),(c,'authenticated','authenticated',c||'@example.invalid',now());
 insert into auth.sessions(id,user_id) values(st,t),(sx,stranger),(sc,c);
 insert into public.profiles(id,name,cal_goal,protein_goal,carbs_goal,fat_goal) values(c,'Synthetic',2000,100,200,60);
 insert into public.trainer_profiles(user_id,display_name,approval_status) values(t,'Approved test trainer','approved');
 insert into public.trainer_client_relationships(id,trainer_id,client_id,state,accepted_at,activated_at) values(r,t,c,'active',now(),now());
 insert into public.trainer_client_permissions(relationship_id,scope) select r,x from unnest(array['nutrition_adherence','supplements','workouts','sessions','messaging'])x;
 set constraints all immediate;set constraints all deferred;
 result:=trainerhq_private.adherence_day(t,r,day_value);
 if result->'categories'->'diet'->>'state' is distinct from 'not_configured' or result->>'overall_score' is not null then raise exception 'Unconfigured scored zero';end if;n:=n+1;
 perform trainerhq_private.api(c,sc,'tracking.configure','{"operation_id":"12121212-1212-4212-8212-121212121212","timezone":"UTC","nutrition_enabled":true}');
 if not exists(select 1 from public.client_nutrition_targets where user_id=c and weekdays=array[1,2,3,4,5,6,7]) then raise exception 'Default tracking days missing';end if;n:=n+1;
 -- Owner fixtures create an earlier legitimate target to exercise finalized days.
 insert into public.client_nutrition_targets(user_id,effective_from,calories,protein,carbs,fat,weekdays) values(c,day_value-2,2000,100,200,60,array[1,2,3,4,5,6,7]);
 result:=trainerhq_private.adherence_day(t,r,day_value);
 if result->'categories'->'diet'->>'state' is distinct from 'incomplete' or (result->'categories'->'diet'->>'score')::numeric is distinct from 0 then raise exception 'Missing eligible log is not incomplete';end if;n:=n+1;
 if result->>'overall_state' is distinct from 'insufficient_shared_data' or (result->>'coverage')::int is distinct from 1 then raise exception 'Insufficient coverage hidden';end if;n:=n+1;
 insert into public.food_log(user_id,logged_date,meal_slot,food_name,grams,per100_cal,per100_protein,per100_carbs,per100_fat)
 values(c,day_value,'Breakfast','Test',100,2000,100,200,60);
 result:=trainerhq_private.adherence_day(t,r,day_value);
 if (result->'categories'->'diet'->>'score')::numeric is distinct from 1 then raise exception 'Exact goals not full score';end if;n:=n+1;
 -- Raw nutrition remains unshared under aggregate-only consent.
 begin perform trainerhq_private.api(t,st,'client.logs',jsonb_build_object('relationship_id',r,'category','nutrition','from',day_value,'until',day_value+1));raise exception 'Aggregate consent leaked meals';exception when insufficient_privilege then n:=n+1;end;
 if result::text like '%2000%' or result::text like '%protein_g%' then raise exception 'Aggregate returned macro values';end if;n:=n+1;
 if trainerhq_private.range_score(1900,2000,0.1) is distinct from 1 or trainerhq_private.range_score(150,100,0,true) is distinct from 1 or trainerhq_private.range_score(50,100,0,true) is distinct from 0.5 then raise exception 'Range/minimum scoring wrong';end if;n:=n+1;
 update public.food_log set per100_cal=0,per100_protein=100,per100_carbs=0,per100_fat=0 where user_id=c;
 result:=trainerhq_private.adherence_day(t,r,day_value);
 if (result->'categories'->'diet'->>'score')::numeric is distinct from 0.3 then raise exception 'Diet weights wrong';end if;n:=n+1;
 insert into public.supplement_stack(id,user_id,name,created_at) values(supp,c,'Test supplement',(day_value-2)::timestamptz);
 insert into public.supplement_log(user_id,supplement_id,log_date,taken) values(c,supp,day_value,true);
 result:=trainerhq_private.adherence_day(t,r,day_value);
 if (result->>'coverage')::int is distinct from 2 or (result->>'overall_score')::numeric is distinct from 0.65 then raise exception 'Eligible categories not renormalized';end if;n:=n+1;
 if not exists(select 1 from trainerhq_private.adherence_summaries where relationship_id=r and calculation_version=1) then raise exception 'Calculation version not stored';end if;n:=n+1;
 result:=trainerhq_private.adherence_day(t,r,current_date);
 if result->'categories'->'diet'->>'state' is distinct from 'pending' or result->'categories'->'diet'->>'score' is not null then raise exception 'Before-cutoff missing score';end if;n:=n+1;
 update public.trainer_client_permissions set granted=false where relationship_id=r and scope='nutrition_adherence';
 result:=trainerhq_private.adherence_day(t,r,day_value);
 if result->'categories'->'diet'->>'state' is distinct from 'not_shared' or result->'categories'->'diet'->>'score' is not null or result->>'overall_score' is not null then raise exception 'Unshared contribution retained';end if;n:=n+1;
 begin perform trainerhq_private.adherence_day(stranger,r,day_value);raise exception 'Other trainer adherence leak';exception when insufficient_privilege then n:=n+1;end;
 result:=trainerhq_private.api(t,st,'realtime.topics','{}');
 select 'thq:relationship:'||id::text||':'||channel_epoch::text into old_topic from public.trainer_client_relationships where id=r;
 if not trainerhq_private.topic_allowed(t,old_topic) or trainerhq_private.topic_allowed(stranger,old_topic) then raise exception 'Topic isolation failed';end if;n:=n+1;
 perform set_config('request.jwt.claim.sub',stranger::text,true);perform set_config('request.jwt.claims',jsonb_build_object('sub',stranger,'session_id',sx,'role','authenticated')::text,true);
 set local role authenticated;
 if exists(select 1 from public.client_nutrition_targets where user_id=c) then raise exception 'RLS target leak';end if;n:=n+1;
 begin perform public.trainerhq_api(t,st,'account.get','{}');raise exception 'Direct privileged gateway callable';exception when insufficient_privilege then n:=n+1;end;
 reset role;
 result:=trainerhq_private.api(t,st,'messages.open',jsonb_build_object('operation_id',gen_random_uuid(),'relationship_id',r));cid:=(result->>'conversation_id')::uuid;
 result:=trainerhq_private.api(t,st,'messages.send',jsonb_build_object('operation_id',gen_random_uuid(),'conversation_id',cid,'text','Private synthetic text'));mid:=(result->>'id')::uuid;
 set constraints all immediate;set constraints all deferred;
 if not exists(select 1 from trainerhq_private.notification_jobs where recipient_id=c and resource_id=mid and state='awaiting_configuration') then raise exception 'Push preparation missing';end if;n:=n+1;
 if exists(select 1 from trainerhq_private.integration_diagnostics where occurred_at>=transaction_timestamp()) then raise exception 'Invalidation trigger failed';end if;n:=n+1;
 begin perform trainerhq_private.api(t,st,'device.register',jsonb_build_object('operation_id',gen_random_uuid(),'app','trainerhq','bundle_id','unconfigured','installation_id',gen_random_uuid(),'token',repeat('a',64),'environment','sandbox','verified_session_id',st));raise exception 'Unconfigured push accepted';exception when invalid_parameter_value then n:=n+1;end;
 update public.trainer_client_relationships set state='revoked',revoked_at=now(),channel_epoch=gen_random_uuid() where id=r;
 set constraints all immediate;set constraints all deferred;
 if trainerhq_private.topic_allowed(t,old_topic) then raise exception 'Revoked epoch still authorized';end if;n:=n+1;
 begin perform trainerhq_private.adherence_day(t,r,day_value);raise exception 'Revoked summary exposed';exception when insufficient_privilege then n:=n+1;end;
 raise exception using errcode='ZX001',message=n::text;
 exception when sqlstate 'ZX001' then perform set_config('trainerhq.test_assertions',sqlerrm,true);end;
end $test$;
select 'passed' as result,current_setting('trainerhq.test_assertions')::int as assertions;
