-- New authorization tests. Every fixture and operation is rolled back.
do $test$
declare
 t1 uuid:=gen_random_uuid(); t2 uuid:=gen_random_uuid(); c1 uuid:=gen_random_uuid(); c2 uuid:=gen_random_uuid();
 s1 uuid:=gen_random_uuid(); s2 uuid:=gen_random_uuid(); sc1 uuid:=gen_random_uuid(); sc2 uuid:=gen_random_uuid();
 r1 uuid; r2 uuid; x jsonb; invite jsonb; invite2 jsonb; p jsonb; n integer:=0; v bigint;
begin
 begin
  insert into auth.users(id,aud,role,email,email_confirmed_at) values
   (t1,'authenticated','authenticated',t1||'@example.invalid',now()),(t2,'authenticated','authenticated',t2||'@example.invalid',now()),
   (c1,'authenticated','authenticated',c1||'@example.invalid',now()),(c2,'authenticated','authenticated',c2||'@example.invalid',now());
  insert into auth.sessions(id,user_id) values(s1,t1),(s2,t2),(sc1,c1),(sc2,c2);
  insert into public.profiles(id,name) values(c1,'Test Client'),(c2,'Other Test Client');
  insert into public.food_log(user_id,meal_slot,food_name,grams,logged_date) values(c1,'Breakfast','Fixture',100,'2099-01-01');
  p:=jsonb_build_object('operation_id',gen_random_uuid(),'display_name','Trainer 1');
  x:=trainerhq_private.api(t1,s1,'trainer.apply',p);
  if x->>'approval_status' is distinct from 'pending' then raise exception 'Self signup elevated privilege';end if;n:=n+1;
  begin
   perform trainerhq_private.api(t1,s1,'trainer.review',jsonb_build_object('operation_id',gen_random_uuid(),'trainer_id',t1,'decision','approved','reason','Self'));
   raise exception 'Self approval allowed'; exception when insufficient_privilege then n:=n+1;end;
  begin
   perform trainerhq_private.api(t1,s1,'invitation.create',jsonb_build_object('operation_id',gen_random_uuid(),'email',c1||'@example.invalid'));
   raise exception 'Unapproved trainer invited';exception when insufficient_privilege then n:=n+1;end;
  perform trainerhq_private.owner_review_trainer(t1,'approved','Disposable integration test');
  perform trainerhq_private.api(t2,s2,'trainer.apply',jsonb_build_object('operation_id',gen_random_uuid(),'display_name','Trainer 2'));
  perform trainerhq_private.owner_review_trainer(t2,'approved','Disposable integration test');
  p:=jsonb_build_object('operation_id',gen_random_uuid(),'email',c1||'@example.invalid');
  invite:=trainerhq_private.api(t1,s1,'invitation.create',p);r1:=(invite->>'relationship_id')::uuid;
  x:=trainerhq_private.api(t1,s1,'invitation.create',p);
  if x is distinct from invite then raise exception 'Invite retry duplicated';end if;n:=n+1;
  begin
   perform trainerhq_private.api(t1,s1,'invitation.create',p||jsonb_build_object('email',c2||'@example.invalid'));
   raise exception 'Operation ID reused with different data';exception when unique_violation then n:=n+1;end;
  begin
   perform trainerhq_private.api(c2,sc2,'invitation.review',jsonb_build_object('token',invite->>'token'));
   raise exception 'Wrong recipient reviewed invite';exception when insufficient_privilege then n:=n+1;end;
  x:=trainerhq_private.api(c1,sc1,'invitation.review',jsonb_build_object('token',invite->>'token'));
  if x->'trainer'->>'display_name' is distinct from 'Trainer 1' then raise exception 'Trainer identity missing';end if;n:=n+1;
  perform trainerhq_private.api(c1,sc1,'invitation.respond',jsonb_build_object('operation_id',gen_random_uuid(),'token',invite->>'token','decision','accept','activate',true,'scopes',jsonb_build_array('nutrition','messaging')));
  x:=trainerhq_private.api(t1,s1,'clients.list','{}');
  if jsonb_array_length(x) is distinct from 1 or x->0->>'client_id' is distinct from c1::text then raise exception 'Authorized roster wrong';end if;n:=n+1;
  x:=trainerhq_private.api(t2,s2,'clients.list','{}');
  if jsonb_array_length(x) is distinct from 0 then raise exception 'Other trainer roster leak';end if;n:=n+1;
  p:=jsonb_build_object('relationship_id',r1,'category','nutrition','from','2099-01-01','until','2099-01-02');
  x:=trainerhq_private.api(t1,s1,'client.logs',p);
  if jsonb_array_length(x) is distinct from 1 then raise exception 'Consented nutrition unavailable';end if;n:=n+1;
  begin perform trainerhq_private.api(t2,s2,'client.logs',p);raise exception 'Cross trainer access';exception when insufficient_privilege then n:=n+1;end;
  begin perform trainerhq_private.api(t1,s1,'client.logs',p||'{"category":"supplements"}');raise exception 'Unshared category leak';exception when insufficient_privilege then n:=n+1;end;
  invite2:=trainerhq_private.api(t2,s2,'invitation.create',jsonb_build_object('operation_id',gen_random_uuid(),'email',c1||'@example.invalid'));
  r2:=(invite2->>'relationship_id')::uuid;
  perform trainerhq_private.api(c1,sc1,'invitation.respond',jsonb_build_object('operation_id',gen_random_uuid(),'token',invite2->>'token','decision','accept','activate',true,'scopes',jsonb_build_array('nutrition')));
  if not trainerhq_private.allowed(t2,r2,'nutrition') then raise exception 'Independent grant missing';end if;n:=n+1;
  select version into v from public.trainer_client_relationships where id=r1;
  begin perform trainerhq_private.api(t1,s1,'relationship.update',jsonb_build_object('operation_id',gen_random_uuid(),'relationship_id',r1,'version',v,'state','paused'));
   raise exception 'Trainer controls client consent';exception when insufficient_privilege then n:=n+1;end;
  perform trainerhq_private.api(c1,sc1,'relationship.update',jsonb_build_object('operation_id',gen_random_uuid(),'relationship_id',r1,'version',v,'state','paused'));
  begin perform trainerhq_private.api(t1,s1,'client.logs',p);raise exception 'Paused access';exception when insufficient_privilege then n:=n+1;end;
  if not trainerhq_private.allowed(t2,r2,'nutrition') then raise exception 'Pause damaged independent grant';end if;n:=n+1;
  begin perform trainerhq_private.api(c1,sc1,'relationship.update',jsonb_build_object('operation_id',gen_random_uuid(),'relationship_id',r1,'version',v,'state','active'));
   raise exception 'Stale edit accepted';exception when unique_violation then n:=n+1;end;
  perform trainerhq_private.api(c1,sc1,'relationship.update',jsonb_build_object('operation_id',gen_random_uuid(),'relationship_id',r1,'version',v+1,'state','revoked'));
  begin perform trainerhq_private.api(t1,s1,'client.logs',p);raise exception 'Revoked access';exception when insufficient_privilege then n:=n+1;end;
  if not trainerhq_private.allowed(t2,r2,'nutrition') then raise exception 'Revocation damaged other grant';end if;n:=n+1;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',t1,'role','authenticated','session_id',s1,'user_metadata',jsonb_build_object('role','admin'))::text,true);
  perform set_config('request.jwt.claim.sub',t1::text,true);
  set local role authenticated;
  begin perform public.trainerhq_api(t1,s1,'account.get','{}');raise exception 'Client can spoof gateway actor';exception when insufficient_privilege then n:=n+1;end;
  begin insert into public.trainer_profiles(user_id,display_name,approval_status) values(c2,'Fake','approved');raise exception 'Client elevated role';exception when insufficient_privilege then n:=n+1;end;
  if exists(select 1 from public.trainer_client_relationships where id=r2) then raise exception 'RLS relationship leak';end if;n:=n+1;
  if exists(select 1 from public.food_log where user_id=c1) then raise exception 'Original WiFit RLS broadened';end if;n:=n+1;
  reset role;
  delete from auth.sessions where id=s1;
  begin perform trainerhq_private.api(t1,s1,'account.get','{}');raise exception 'Deleted session accepted';exception when insufficient_privilege then n:=n+1;end;
  raise sqlstate 'ZX002';
 exception when sqlstate 'ZX002' then null;end;
 if exists(select 1 from auth.users where id in(t1,t2,c1,c2)) then raise exception 'Test cleanup failed';end if;n:=n+1;
 perform set_config('trainerhq.identity_test_count',n::text,true);
end $test$;
select 'passed' as result,current_setting('trainerhq.identity_test_count')::int as assertions;
