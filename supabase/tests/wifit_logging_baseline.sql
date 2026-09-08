-- WiFit database baseline. Synthetic accounts and records only.
-- Every write is inside a subtransaction that is deliberately rolled back.
-- This tests PostgreSQL/RLS contracts, not Supabase Auth or the browser UI.
-- Run as the migration operator with permission to SET ROLE authenticated/anon.
DO $baseline$
DECLARE
  client_a uuid := gen_random_uuid();
  client_b uuid := gen_random_uuid();
  food_id uuid := gen_random_uuid();
  stack_id uuid := gen_random_uuid();
  session_id uuid := gen_random_uuid();
  row_count integer;
  checks integer := 0;
BEGIN
  BEGIN
    IF EXISTS (
      SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relkind IN ('r','p') AND NOT c.relrowsecurity
    ) THEN RAISE EXCEPTION 'An existing public table has RLS disabled'; END IF;
    checks := checks + 1;

    INSERT INTO auth.users (id, aud, role)
    VALUES (client_a, 'authenticated', 'authenticated'),
           (client_b, 'authenticated', 'authenticated');

    PERFORM set_config('request.jwt.claims', json_build_object('sub', client_a, 'role', 'authenticated')::text, true);
    PERFORM set_config('request.jwt.claim.sub', client_a::text, true);
    SET LOCAL ROLE authenticated;

    INSERT INTO public.food_log (id,user_id,logged_date,meal_slot,food_name,grams,per100_cal,per100_protein)
    VALUES (food_id,client_a,DATE '2099-01-02','Breakfast','Regression fixture',500,32.3,10);
    IF NOT EXISTS (SELECT 1 FROM public.food_log WHERE id=food_id AND user_id=client_a AND grams=500)
    THEN RAISE EXCEPTION 'Own food insert/read failed'; END IF;
    checks := checks + 1;

    INSERT INTO public.supplement_stack (id,user_id,name) VALUES (stack_id,client_a,'Regression fixture');
    INSERT INTO public.supplement_log (user_id,supplement_id,log_date,taken)
    VALUES (client_a,stack_id,DATE '2099-01-02',false)
    ON CONFLICT (supplement_id,log_date) DO UPDATE SET taken=excluded.taken;
    INSERT INTO public.supplement_log (user_id,supplement_id,log_date,taken)
    VALUES (client_a,stack_id,DATE '2099-01-02',true)
    ON CONFLICT (supplement_id,log_date) DO UPDATE SET taken=excluded.taken;
    IF (SELECT count(*) FROM public.supplement_log WHERE supplement_id=stack_id AND taken) <> 1
    THEN RAISE EXCEPTION 'Supplement upsert identity/read failed'; END IF;
    checks := checks + 1;

    INSERT INTO public.workout_sessions (id,user_id,workout_name,completed_date,duration_secs,sets_completed,total_sets,exercises)
    VALUES (session_id,client_a,'Regression fixture',DATE '2099-01-02',600,1,1,
      '[{"name":"Regression exercise","sets":["8×30lbs"],"setsData":[{"reps":8,"weight":30}]}]'::jsonb);
    IF NOT EXISTS (SELECT 1 FROM public.workout_sessions WHERE id=session_id AND sets_completed=1)
    THEN RAISE EXCEPTION 'Own workout insert/read failed'; END IF;
    checks := checks + 1;
    IF NOT EXISTS (SELECT 1 FROM public.exercise_bests WHERE user_id=client_a AND name='Regression exercise' AND best_lbs=30)
    THEN RAISE EXCEPTION 'Workout view regression'; END IF;
    checks := checks + 1;
    IF NOT EXISTS (SELECT 1 FROM public.daily_summary WHERE user_id=client_a AND day=DATE '2099-01-02'
      AND kcal=162 AND protein_g=50 AND food_rows=1 AND workout_count=1 AND supps_taken=1)
    THEN RAISE EXCEPTION 'Daily summary or numeric rounding regression'; END IF;
    checks := checks + 1;

    PERFORM set_config('request.jwt.claims', json_build_object('sub', client_b, 'role', 'authenticated')::text, true);
    PERFORM set_config('request.jwt.claim.sub', client_b::text, true);
    IF EXISTS (SELECT 1 FROM public.food_log WHERE user_id=client_a)
       OR EXISTS (SELECT 1 FROM public.supplement_stack WHERE user_id=client_a)
       OR EXISTS (SELECT 1 FROM public.supplement_log WHERE user_id=client_a)
       OR EXISTS (SELECT 1 FROM public.workout_sessions WHERE user_id=client_a)
    THEN RAISE EXCEPTION 'Cross-account base-table read allowed'; END IF;
    checks := checks + 1;
    IF EXISTS (SELECT 1 FROM public.daily_summary WHERE user_id=client_a)
       OR EXISTS (SELECT 1 FROM public.exercise_bests WHERE user_id=client_a)
       OR EXISTS (SELECT 1 FROM public.exercise_pr_events WHERE user_id=client_a)
       OR EXISTS (SELECT 1 FROM public.supplement_due_from WHERE user_id=client_a)
    THEN RAISE EXCEPTION 'Cross-account view read allowed'; END IF;
    checks := checks + 1;

    BEGIN
      INSERT INTO public.food_log (user_id,meal_slot,food_name,grams)
      VALUES (client_a,'Breakfast','Forbidden fixture',1);
      RAISE EXCEPTION 'Cross-account food insert allowed';
    EXCEPTION WHEN insufficient_privilege THEN checks := checks + 1; END;
    BEGIN
      INSERT INTO public.supplement_log (user_id,supplement_id,log_date,taken)
      VALUES (client_a,stack_id,DATE '2099-01-03',true);
      RAISE EXCEPTION 'Cross-account supplement insert allowed';
    EXCEPTION WHEN insufficient_privilege THEN checks := checks + 1; END;
    BEGIN
      INSERT INTO public.workout_sessions (user_id,workout_name)
      VALUES (client_a,'Forbidden fixture');
      RAISE EXCEPTION 'Cross-account workout insert allowed';
    EXCEPTION WHEN insufficient_privilege THEN checks := checks + 1; END;

    UPDATE public.food_log SET grams=1 WHERE id=food_id;
    GET DIAGNOSTICS row_count=ROW_COUNT;
    IF row_count<>0 THEN RAISE EXCEPTION 'Cross-account food update allowed'; END IF;
    checks := checks + 1;
    DELETE FROM public.supplement_log WHERE supplement_id=stack_id;
    GET DIAGNOSTICS row_count=ROW_COUNT;
    IF row_count<>0 THEN RAISE EXCEPTION 'Cross-account supplement delete allowed'; END IF;
    checks := checks + 1;
    UPDATE public.workout_sessions SET duration_secs=1 WHERE id=session_id;
    GET DIAGNOSTICS row_count=ROW_COUNT;
    IF row_count<>0 THEN RAISE EXCEPTION 'Cross-account workout update allowed'; END IF;
    checks := checks + 1;

    PERFORM set_config('request.jwt.claims', '{"role":"anon"}', true);
    PERFORM set_config('request.jwt.claim.sub', '', true);
    SET LOCAL ROLE anon;
    IF EXISTS (SELECT 1 FROM public.food_log WHERE id=food_id)
       OR EXISTS (SELECT 1 FROM public.supplement_log WHERE supplement_id=stack_id)
       OR EXISTS (SELECT 1 FROM public.workout_sessions WHERE id=session_id)
    THEN RAISE EXCEPTION 'Anonymous fixture access allowed'; END IF;
    checks := checks + 1;

    SET LOCAL ROLE authenticated;
    PERFORM set_config('request.jwt.claims', json_build_object('sub', client_a, 'role', 'authenticated')::text, true);
    PERFORM set_config('request.jwt.claim.sub', client_a::text, true);
    BEGIN
      UPDATE public.food_log SET user_id=client_b WHERE id=food_id;
      RAISE EXCEPTION 'Food ownership reassignment allowed';
    EXCEPTION WHEN insufficient_privilege THEN checks := checks + 1; END;
    UPDATE public.food_log SET grams=100 WHERE id=food_id;
    IF NOT EXISTS (SELECT 1 FROM public.food_log WHERE id=food_id AND grams=100)
    THEN RAISE EXCEPTION 'Own food update failed'; END IF;
    checks := checks + 1;
    UPDATE public.workout_sessions
    SET exercises='[{"name":"Regression exercise","sets":["8×45lbs"],"setsData":[{"reps":8,"weight":45}]}]'::jsonb
    WHERE id=session_id;
    IF NOT EXISTS (SELECT 1 FROM public.exercise_bests WHERE user_id=client_a AND best_lbs=45)
    THEN RAISE EXCEPTION 'Workout edit/readback failed'; END IF;
    checks := checks + 1;
    DELETE FROM public.workout_sessions WHERE id=session_id;
    GET DIAGNOSTICS row_count=ROW_COUNT;
    IF row_count<>1 OR EXISTS (SELECT 1 FROM public.exercise_bests WHERE user_id=client_a)
    THEN RAISE EXCEPTION 'Workout delete/readback failed'; END IF;
    checks := checks + 1;
    DELETE FROM public.food_log WHERE id=food_id;
    GET DIAGNOSTICS row_count=ROW_COUNT;
    IF row_count<>1 THEN RAISE EXCEPTION 'Own food delete failed'; END IF;
    checks := checks + 1;
    DELETE FROM public.supplement_log WHERE supplement_id=stack_id;
    GET DIAGNOSTICS row_count=ROW_COUNT;
    IF row_count<>1 THEN RAISE EXCEPTION 'Own supplement delete failed'; END IF;
    checks := checks + 1;

    -- Only this success marker is caught. It rolls back ALL fixture writes and
    -- SET LOCAL ROLE changes. Any actual assertion error aborts the statement.
    RAISE SQLSTATE 'ZX001' USING MESSAGE='rollback successful baseline fixtures';
  EXCEPTION WHEN SQLSTATE 'ZX001' THEN NULL;
  END;
  IF EXISTS (SELECT 1 FROM auth.users WHERE id IN (client_a,client_b))
  THEN RAISE EXCEPTION 'Fixture rollback failed'; END IF;
  checks := checks + 1;
  PERFORM set_config('trainerhq.baseline_checks',checks::text,true);
END
$baseline$;
SELECT 'passed' AS result, current_setting('trainerhq.baseline_checks')::integer AS assertions,
       'All synthetic accounts and logs rolled back; no existing rows modified' AS cleanup;

