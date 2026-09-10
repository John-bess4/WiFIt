-- FitDataKit database contract. Extends wifit_logging_baseline.sql.
-- Run as the migration operator with permission to SET LOCAL ROLE.
-- READ THIS BEFORE RUNNING:
-- * Synthetic auth users and WiFit rows only, all inside rolled-back blocks.
-- * No TrainerHQ-owned table/schema/policy audit, writes or DDL.
-- * Scoped metadata assertions cover exactly 11 WiFit tables and five views.
-- * SET ROLE + request claims exercise PostgreSQL RLS, NOT actual Supabase
--   GoTrue sign-in, JWT validation, PostgREST, Swift transport or Keychain.
-- * Only the deliberately armed rollback marker is caught as normal completion.
--   Assertion errors, unexpected SQLSTATEs and an incomplete check count abort.
-- * Cross-owner supplement parent enforcement is reported separately as a
--   diagnostic; false is a finding, never a passed authorization assertion.
-- * There is no dynamic SQL or fixture data interpolated into SQL text.
DO $fitdatakit_contract$
DECLARE
  client_a uuid := gen_random_uuid();
  client_b uuid := gen_random_uuid();
  food_a uuid := gen_random_uuid();
  food_b uuid := gen_random_uuid();
  custom_a uuid := gen_random_uuid();
  custom_b uuid := gen_random_uuid();
  session_first uuid := gen_random_uuid();
  session_b uuid := gen_random_uuid();
  plan_a uuid := gen_random_uuid();
  plan_b uuid := gen_random_uuid();
  stack_a uuid := gen_random_uuid();
  stack_b uuid := gen_random_uuid();
  supp_a uuid := gen_random_uuid();
  supp_b uuid := gen_random_uuid();
  water_a uuid := gen_random_uuid();
  water_b uuid := gen_random_uuid();
  weight_a uuid := gen_random_uuid();
  weight_b uuid := gen_random_uuid();
  usage_a uuid := gen_random_uuid();
  usage_b uuid := gen_random_uuid();
  legacy_a uuid := gen_random_uuid();
  legacy_b uuid := gen_random_uuid();
  food_round_a uuid := gen_random_uuid();
  food_round_b uuid := gen_random_uuid();
  water_only uuid := gen_random_uuid();
  weight_last uuid := gen_random_uuid();
  session_tie uuid := gen_random_uuid();
  session_best uuid := gen_random_uuid();
  session_promote uuid := gen_random_uuid();
  session_b_best uuid := gen_random_uuid();
  parent_probe uuid := gen_random_uuid();
  first_id uuid;
  returned_id uuid;
  affected integer;
  checks integer := 0;
  expected_before_rollback constant integer := 153;
  expected_final constant integer := 156;
  denied boolean;
  rollback_requested boolean := false;
  parent_rollback_requested boolean := false;
  parent_owner_enforced boolean;
  caught_message text;
BEGIN
  BEGIN
    -- Check 1: All 11 WiFit base tables exist with RLS enabled
    IF ((SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p') AND c.relname IN ('profiles','food_log','custom_foods','workout_sessions','workout_plans','supplement_stack','supplement_log','water_log','body_weight_log','ai_coach_usage','workouts') AND c.relrowsecurity) = 11) IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'FitDataKit check 1: All 11 WiFit base tables exist with RLS enabled';
    END IF;
    checks := checks + 1;

    -- Check 2: All five WiFit views exist with security_invoker
    IF ((SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='v' AND c.relname IN ('exercise_bests','exercise_pr_events','daily_summary','supplement_due_from','weight_monthly') AND c.reloptions @> ARRAY['security_invoker=true']) = 5) IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'FitDataKit check 2: All five WiFit views exist with security_invoker';
    END IF;
    checks := checks + 1;

    -- Check 3: Five views grant authenticated SELECT and deny anon SELECT
    IF ((SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname IN ('exercise_bests','exercise_pr_events','daily_summary','supplement_due_from','weight_monthly') AND has_table_privilege('authenticated',c.oid,'SELECT') AND NOT has_table_privilege('anon',c.oid,'SELECT')) = 5) IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'FitDataKit check 3: Five views grant authenticated SELECT and deny anon SELECT';
    END IF;
    checks := checks + 1;

    INSERT INTO auth.users (id,aud,role)
    VALUES (client_a,'authenticated','authenticated'),
           (client_b,'authenticated','authenticated');

    SET LOCAL ROLE authenticated;
    PERFORM set_config('request.jwt.claims', json_build_object('sub', client_a, 'role', 'authenticated')::text, true);
    PERFORM set_config('request.jwt.claim.sub', client_a::text, true);

    -- Check 4: Fixture A requests run as authenticated owner
    IF (auth.uid() = client_a AND current_user = 'authenticated') IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'FitDataKit check 4: Fixture A requests run as authenticated owner';
    END IF;
    checks := checks + 1;

    INSERT INTO public.profiles (id,name) VALUES (client_a,'FitDataKit A')
    ON CONFLICT (id) DO UPDATE SET name=excluded.name;
    INSERT INTO public.profiles (id,name) VALUES (client_a,'FitDataKit A updated')
    ON CONFLICT (id) DO UPDATE SET name=excluded.name
    RETURNING id INTO returned_id;

    -- Check 5: Profile repeated upsert preserves authenticated UUID
    IF (returned_id = client_a AND (SELECT count(*) FROM public.profiles WHERE id=client_a AND name='FitDataKit A updated') = 1) IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'FitDataKit check 5: Profile repeated upsert preserves authenticated UUID';
    END IF;
    checks := checks + 1;

    UPDATE public.profiles SET name='FitDataKit A' WHERE id=client_a;
    INSERT INTO public.food_log
      (id,user_id,logged_date,meal_slot,food_name,grams,per100_cal,per100_protein,per100_carbs,per100_fat,per100_sugar)
    VALUES
      (food_a,client_a,DATE '2099-01-02','breakfast','FitDataKit decimal',500,32.3,1.3,2.1,0.5,NULL),
      (food_round_a,client_a,DATE '2099-01-03','lunch','FitDataKit half one',50,1,1,1,1,NULL),
      (food_round_b,client_a,DATE '2099-01-03','lunch','FitDataKit half two',50,1,1,1,1,NULL);
    INSERT INTO public.custom_foods (id,user_id,name,serving_g,per100_sugar)
    VALUES (custom_a,client_a,'FitDataKit custom',100,NULL);
    INSERT INTO public.workout_plans (id,user_id,name,exercises)
    VALUES (plan_a,client_a,'FitDataKit plan','[]'::jsonb);
    INSERT INTO public.workouts (id,user_id,name)
    VALUES (legacy_a,client_a,'FitDataKit legacy');
    INSERT INTO public.ai_coach_usage (id,user_id,created_at)
    VALUES (usage_a,client_a,TIMESTAMPTZ '2099-01-02 12:00:00+00');

    -- Check 6: Food read-back preserves Decimal source and unknown sugar
    IF (EXISTS (SELECT 1 FROM public.food_log WHERE id=food_a AND grams=500 AND per100_cal=32.3 AND per100_sugar IS NULL)) IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'FitDataKit check 6: Food read-back preserves Decimal source and unknown sugar';
    END IF;
    checks := checks + 1;

    -- Check 7: Custom-food explicit unknown sugar survives its default-zero column
    IF (EXISTS (SELECT 1 FROM public.custom_foods WHERE id=custom_a AND per100_sugar IS NULL AND serving_g=100)) IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'FitDataKit check 7: Custom-food explicit unknown sugar survives its default-zero column';
    END IF;
    checks := checks + 1;

    INSERT INTO public.water_log (id,user_id,log_date,oz)
    VALUES (water_a,client_a,DATE '2099-01-02',8)
    ON CONFLICT (user_id,log_date) DO UPDATE SET oz=excluded.oz
    RETURNING id INTO first_id;
    INSERT INTO public.water_log (user_id,log_date,oz)
    VALUES (client_a,DATE '2099-01-02',16)
    ON CONFLICT (user_id,log_date) DO UPDATE SET oz=excluded.oz
    RETURNING id INTO returned_id;

    -- Check 8: Repeated same-day water upsert preserves UUID and cumulative total
    IF (first_id=water_a AND returned_id=water_a AND (SELECT count(*) FROM public.water_log WHERE user_id=client_a AND log_date=DATE '2099-01-02' AND oz=16)=1) IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'FitDataKit check 8: Repeated same-day water upsert preserves UUID and cumulative total';
    END IF;
    checks := checks + 1;

    INSERT INTO public.water_log (id,user_id,log_date,oz)
    VALUES (water_only,client_a,DATE '2099-01-20',8);

    -- Check 9: Successful water-only day has no daily_summary row
    IF (EXISTS (SELECT 1 FROM public.water_log WHERE id=water_only) AND NOT EXISTS (SELECT 1 FROM public.daily_summary WHERE user_id=client_a AND day=DATE '2099-01-20')) IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'FitDataKit check 9: Successful water-only day has no daily_summary row';
    END IF;
    checks := checks + 1;

    INSERT INTO public.body_weight_log (id,user_id,log_date,weight_lbs)
    VALUES (weight_a,client_a,DATE '2099-01-02',200.25)
    ON CONFLICT (user_id,log_date) DO UPDATE SET weight_lbs=excluded.weight_lbs
    RETURNING id INTO first_id;
    INSERT INTO public.body_weight_log (user_id,log_date,weight_lbs)
    VALUES (client_a,DATE '2099-01-02',199.5)
    ON CONFLICT (user_id,log_date) DO UPDATE SET weight_lbs=excluded.weight_lbs
    RETURNING id INTO returned_id;

    -- Check 10: Repeated same-day weight upsert preserves UUID and fractional weight
    IF (first_id=weight_a AND returned_id=weight_a AND (SELECT count(*) FROM public.body_weight_log WHERE user_id=client_a AND log_date=DATE '2099-01-02' AND weight_lbs=199.5)=1) IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'FitDataKit check 10: Repeated same-day weight upsert preserves UUID and fractional weight';
    END IF;
    checks := checks + 1;

    INSERT INTO public.body_weight_log (id,user_id,log_date,weight_lbs)
    VALUES (weight_last,client_a,DATE '2099-01-05',198.25);

    -- Check 11: Monthly weights preserve first/last values and exact entry count
    IF (EXISTS (SELECT 1 FROM public.weight_monthly WHERE user_id=client_a AND month='2099-01' AND first_lbs=199.5 AND last_lbs=198.25 AND entries=2)) IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'FitDataKit check 11: Monthly weights preserve first/last values and exact entry count';
    END IF;
    checks := checks + 1;

    INSERT INTO public.supplement_stack (id,user_id,name,created_at)
    VALUES (stack_a,client_a,'FitDataKit supplement',TIMESTAMPTZ '2099-01-03 12:00:00+00');
    INSERT INTO public.supplement_log (id,user_id,supplement_id,log_date,taken)
    VALUES (supp_a,client_a,stack_a,DATE '2099-01-02',false)
    ON CONFLICT (supplement_id,log_date) DO UPDATE SET taken=excluded.taken
    RETURNING id INTO first_id;
    INSERT INTO public.supplement_log (user_id,supplement_id,log_date,taken)
    VALUES (client_a,stack_a,DATE '2099-01-02',true)
    ON CONFLICT (supplement_id,log_date) DO UPDATE SET taken=excluded.taken
    RETURNING id INTO returned_id;

    -- Check 12: Repeated supplement upsert uses supplement_id/date and preserves UUID
    IF (first_id=supp_a AND returned_id=supp_a AND (SELECT count(*) FROM public.supplement_log WHERE supplement_id=stack_a AND log_date=DATE '2099-01-02' AND taken)=1) IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'FitDataKit check 12: Repeated supplement upsert uses supplement_id/date and preserves UUID';
    END IF;
    checks := checks + 1;

    -- Check 13: Supplement due-from preserves earlier log date
    IF (EXISTS (SELECT 1 FROM public.supplement_due_from WHERE user_id=client_a AND supplement_id=stack_a AND due_from=DATE '2099-01-02')) IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'FitDataKit check 13: Supplement due-from preserves earlier log date';
    END IF;
    checks := checks + 1;

    -- Check 14: daily_summary uses Decimal ties and correct supplement/weight fields
    IF (EXISTS (SELECT 1 FROM public.daily_summary WHERE user_id=client_a AND day=DATE '2099-01-02' AND kcal=162 AND protein_g=7 AND carbs_g=11 AND fat_g=3 AND food_rows=1 AND supps_taken=1 AND supps_due=1 AND weight_lbs=199.5)) IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'FitDataKit check 14: daily_summary uses Decimal ties and correct supplement/weight fields';
    END IF;
    checks := checks + 1;

    -- Check 15: Four macros round each food row before summing, not the sum
    IF (EXISTS (SELECT 1 FROM public.daily_summary WHERE user_id=client_a AND day=DATE '2099-01-03' AND kcal=2 AND protein_g=2 AND carbs_g=2 AND fat_g=2 AND food_rows=2)) IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'FitDataKit check 15: Four macros round each food row before summing, not the sum';
    END IF;
    checks := checks + 1;

    -- Check 16: Postgres numeric rounding uses ties away from zero
    IF (round(32.3::numeric * 500::numeric / 100::numeric)=162 AND round(-161.5::numeric)=-162) IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'FitDataKit check 16: Postgres numeric rounding uses ties away from zero';
    END IF;
    checks := checks + 1;

    INSERT INTO public.workout_sessions
      (id,user_id,workout_name,completed_date,created_at,duration_secs,sets_completed,total_sets,exercises)
    VALUES
      (session_first,client_a,'FitDataKit first',DATE '2099-01-02',TIMESTAMPTZ '2099-01-02 12:00:00+00',600,2,2,
       '[{"name":"FitDataKit lift","sets":["8×100.25lbs"],"setsData":[{"reps":8,"weight":100.25}]},{"name":"FitDataKit bodyweight","sets":["8×0lbs"],"setsData":[{"reps":8,"weight":0}]}]'::jsonb);

    -- Check 17: First positive lift creates exact fractional baseline
    IF (EXISTS (SELECT 1 FROM public.exercise_bests WHERE user_id=client_a AND name='FitDataKit lift' AND best_lbs=100.25)) IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'FitDataKit check 17: First positive lift creates exact fractional baseline';
    END IF;
    checks := checks + 1;

    -- Check 18: First recorded lift is not a PR event
    IF (NOT EXISTS (SELECT 1 FROM public.exercise_pr_events WHERE user_id=client_a)) IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'FitDataKit check 18: First recorded lift is not a PR event';
    END IF;
    checks := checks + 1;

    -- Check 19: Zero-weight lift is not a PR baseline
    IF (NOT EXISTS (SELECT 1 FROM public.exercise_bests WHERE user_id=client_a AND name='FitDataKit bodyweight')) IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'FitDataKit check 19: Zero-weight lift is not a PR baseline';
    END IF;
    checks := checks + 1;

    INSERT INTO public.workout_sessions
      (id,user_id,workout_name,completed_date,created_at,duration_secs,sets_completed,total_sets,exercises)
    VALUES
      (session_tie,client_a,'FitDataKit tie',DATE '2099-01-03',TIMESTAMPTZ '2099-01-03 12:00:00+00',600,1,1,
       '[{"name":"FitDataKit lift","sets":["8×100.25lbs"],"setsData":[{"reps":8,"weight":100.25}]}]'::jsonb);

    -- Check 20: Equal-weight second session is not a PR
    IF (NOT EXISTS (SELECT 1 FROM public.exercise_pr_events WHERE user_id=client_a)) IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'FitDataKit check 20: Equal-weight second session is not a PR';
    END IF;
    checks := checks + 1;

    INSERT INTO public.workout_sessions
      (id,user_id,workout_name,completed_date,created_at,duration_secs,sets_completed,total_sets,exercises)
    VALUES
      (session_best,client_a,'FitDataKit earlier best',DATE '2099-01-04',TIMESTAMPTZ '2099-01-04 12:00:00+00',600,1,1,
       '[{"name":"FitDataKit lift","sets":["8×101.5lbs"],"setsData":[{"reps":8,"weight":101.5}]}]'::jsonb),
      (session_promote,client_a,'FitDataKit later lift',DATE '2099-01-05',TIMESTAMPTZ '2099-01-05 12:00:00+00',600,1,1,
       '[{"name":"FitDataKit lift","sets":["8×101.25lbs"],"setsData":[{"reps":8,"weight":101.25}]}]'::jsonb);

    -- Check 21: Strict fractional improvement records one event with exact previous best
    IF ((SELECT count(*) FROM public.exercise_pr_events WHERE user_id=client_a)=1 AND EXISTS (SELECT 1 FROM public.exercise_pr_events WHERE user_id=client_a AND session_id=session_best AND lbs=101.5 AND prev_best=100.25)) IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'FitDataKit check 21: Strict fractional improvement records one event with exact previous best';
    END IF;
    checks := checks + 1;

    -- Check 22: A later lift below an earlier best is not initially a PR
    IF (NOT EXISTS (SELECT 1 FROM public.exercise_pr_events WHERE session_id=session_promote)) IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'FitDataKit check 22: A later lift below an earlier best is not initially a PR';
    END IF;
    checks := checks + 1;

    -- Check 23: Workout counts/names are returned by daily_summary
    IF (EXISTS (SELECT 1 FROM public.daily_summary WHERE user_id=client_a AND day=DATE '2099-01-02' AND workout_count=1 AND workout_names='FitDataKit first')) IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'FitDataKit check 23: Workout counts/names are returned by daily_summary';
    END IF;
    checks := checks + 1;

    -- Check 24: Own fixture exists in profiles
    IF (EXISTS (SELECT 1 FROM public.profiles WHERE id=client_a AND id=client_a)) IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'FitDataKit check 24: Own fixture exists in profiles';
    END IF;
    checks := checks + 1;

    -- Check 25: Own fixture exists in food_log
    IF (EXISTS (SELECT 1 FROM public.food_log WHERE id=food_a AND user_id=client_a)) IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'FitDataKit check 25: Own fixture exists in food_log';
    END IF;
    checks := checks + 1;

    -- Check 26: Own fixture exists in custom_foods
    IF (EXISTS (SELECT 1 FROM public.custom_foods WHERE id=custom_a AND user_id=client_a)) IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'FitDataKit check 26: Own fixture exists in custom_foods';
    END IF;
    checks := checks + 1;

    -- Check 27: Own fixture exists in workout_sessions
    IF (EXISTS (SELECT 1 FROM public.workout_sessions WHERE id=session_first AND user_id=client_a)) IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'FitDataKit check 27: Own fixture exists in workout_sessions';
    END IF;
    checks := checks + 1;

    -- Check 28: Own fixture exists in workout_plans
    IF (EXISTS (SELECT 1 FROM public.workout_plans WHERE id=plan_a AND user_id=client_a)) IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'FitDataKit check 28: Own fixture exists in workout_plans';
    END IF;
    checks := checks + 1;

    -- Check 29: Own fixture exists in supplement_stack
    IF (EXISTS (SELECT 1 FROM public.supplement_stack WHERE id=stack_a AND user_id=client_a)) IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'FitDataKit check 29: Own fixture exists in supplement_stack';
    END IF;
    checks := checks + 1;

    -- Check 30: Own fixture exists in supplement_log
    IF (EXISTS (SELECT 1 FROM public.supplement_log WHERE id=supp_a AND user_id=client_a)) IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'FitDataKit check 30: Own fixture exists in supplement_log';
    END IF;
    checks := checks + 1;

    -- Check 31: Own fixture exists in water_log
    IF (EXISTS (SELECT 1 FROM public.water_log WHERE id=water_a AND user_id=client_a)) IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'FitDataKit check 31: Own fixture exists in water_log';
    END IF;
    checks := checks + 1;

    -- Check 32: Own fixture exists in body_weight_log
    IF (EXISTS (SELECT 1 FROM public.body_weight_log WHERE id=weight_a AND user_id=client_a)) IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'FitDataKit check 32: Own fixture exists in body_weight_log';
    END IF;
    checks := checks + 1;

    -- Check 33: Own fixture exists in ai_coach_usage
    IF (EXISTS (SELECT 1 FROM public.ai_coach_usage WHERE id=usage_a AND user_id=client_a)) IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'FitDataKit check 33: Own fixture exists in ai_coach_usage';
    END IF;
    checks := checks + 1;

    -- Check 34: Own fixture exists in workouts
    IF (EXISTS (SELECT 1 FROM public.workouts WHERE id=legacy_a AND user_id=client_a)) IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'FitDataKit check 34: Own fixture exists in workouts';
    END IF;
    checks := checks + 1;

    SET LOCAL ROLE authenticated;
    PERFORM set_config('request.jwt.claims', json_build_object('sub', client_b, 'role', 'authenticated')::text, true);
    PERFORM set_config('request.jwt.claim.sub', client_b::text, true);

    INSERT INTO public.profiles (id,name) VALUES (client_b,'FitDataKit B')
    ON CONFLICT (id) DO UPDATE SET name=excluded.name;
    INSERT INTO public.food_log (id,user_id,logged_date,meal_slot,food_name,grams,per100_cal)
    VALUES (food_b,client_b,DATE '2099-01-02','breakfast','FitDataKit B',100,100);
    INSERT INTO public.custom_foods (id,user_id,name) VALUES (custom_b,client_b,'FitDataKit B');
    INSERT INTO public.workout_plans (id,user_id,name) VALUES (plan_b,client_b,'FitDataKit B');
    INSERT INTO public.workouts (id,user_id,name) VALUES (legacy_b,client_b,'FitDataKit B');
    INSERT INTO public.water_log (id,user_id,log_date,oz) VALUES (water_b,client_b,DATE '2099-01-02',24);
    INSERT INTO public.body_weight_log (id,user_id,log_date,weight_lbs) VALUES (weight_b,client_b,DATE '2099-01-02',150.5);
    INSERT INTO public.ai_coach_usage (id,user_id,created_at) VALUES (usage_b,client_b,TIMESTAMPTZ '2099-01-02 12:00:00+00');
    INSERT INTO public.supplement_stack (id,user_id,name,created_at)
    VALUES (stack_b,client_b,'FitDataKit B',TIMESTAMPTZ '2099-01-02 12:00:00+00');
    INSERT INTO public.supplement_log (id,user_id,supplement_id,log_date,taken)
    VALUES (supp_b,client_b,stack_b,DATE '2099-01-02',true);
    INSERT INTO public.workout_sessions (id,user_id,workout_name,completed_date,created_at,exercises)
    VALUES
      (session_b,client_b,'FitDataKit B',DATE '2099-01-02',TIMESTAMPTZ '2099-01-02 12:00:00+00',
       '[{"name":"FitDataKit B lift","sets":["5×500lbs"],"setsData":[{"reps":5,"weight":500}]}]'::jsonb),
      (session_b_best,client_b,'FitDataKit B second',DATE '2099-01-03',TIMESTAMPTZ '2099-01-03 12:00:00+00',
       '[{"name":"FitDataKit B lift","sets":["5×600lbs"],"setsData":[{"reps":5,"weight":600}]}]'::jsonb);

    -- Check 35: B reads own existing profiles fixture and no foreign rows
    IF (EXISTS (SELECT 1 FROM public.profiles WHERE id=client_b AND id=client_b) AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE id IS DISTINCT FROM client_b)) IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'FitDataKit check 35: B reads own existing profiles fixture and no foreign rows';
    END IF;
    checks := checks + 1;

    -- Check 36: B reads own existing food_log fixture and no foreign rows
    IF (EXISTS (SELECT 1 FROM public.food_log WHERE id=food_b AND user_id=client_b) AND NOT EXISTS (SELECT 1 FROM public.food_log WHERE user_id IS DISTINCT FROM client_b)) IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'FitDataKit check 36: B reads own existing food_log fixture and no foreign rows';
    END IF;
    checks := checks + 1;

    -- Check 37: B reads own existing custom_foods fixture and no foreign rows
    IF (EXISTS (SELECT 1 FROM public.custom_foods WHERE id=custom_b AND user_id=client_b) AND NOT EXISTS (SELECT 1 FROM public.custom_foods WHERE user_id IS DISTINCT FROM client_b)) IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'FitDataKit check 37: B reads own existing custom_foods fixture and no foreign rows';
    END IF;
    checks := checks + 1;

    -- Check 38: B reads own existing workout_sessions fixture and no foreign rows
    IF (EXISTS (SELECT 1 FROM public.workout_sessions WHERE id=session_b AND user_id=client_b) AND NOT EXISTS (SELECT 1 FROM public.workout_sessions WHERE user_id IS DISTINCT FROM client_b)) IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'FitDataKit check 38: B reads own existing workout_sessions fixture and no foreign rows';
    END IF;
    checks := checks + 1;

    -- Check 39: B reads own existing workout_plans fixture and no foreign rows
    IF (EXISTS (SELECT 1 FROM public.workout_plans WHERE id=plan_b AND user_id=client_b) AND NOT EXISTS (SELECT 1 FROM public.workout_plans WHERE user_id IS DISTINCT FROM client_b)) IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'FitDataKit check 39: B reads own existing workout_plans fixture and no foreign rows';
    END IF;
    checks := checks + 1;

    -- Check 40: B reads own existing supplement_stack fixture and no foreign rows
    IF (EXISTS (SELECT 1 FROM public.supplement_stack WHERE id=stack_b AND user_id=client_b) AND NOT EXISTS (SELECT 1 FROM public.supplement_stack WHERE user_id IS DISTINCT FROM client_b)) IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'FitDataKit check 40: B reads own existing supplement_stack fixture and no foreign rows';
    END IF;
    checks := checks + 1;

    -- Check 41: B reads own existing supplement_log fixture and no foreign rows
    IF (EXISTS (SELECT 1 FROM public.supplement_log WHERE id=supp_b AND user_id=client_b) AND NOT EXISTS (SELECT 1 FROM public.supplement_log WHERE user_id IS DISTINCT FROM client_b)) IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'FitDataKit check 41: B reads own existing supplement_log fixture and no foreign rows';
    END IF;
    checks := checks + 1;

    -- Check 42: B reads own existing water_log fixture and no foreign rows
    IF (EXISTS (SELECT 1 FROM public.water_log WHERE id=water_b AND user_id=client_b) AND NOT EXISTS (SELECT 1 FROM public.water_log WHERE user_id IS DISTINCT FROM client_b)) IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'FitDataKit check 42: B reads own existing water_log fixture and no foreign rows';
    END IF;
    checks := checks + 1;

    -- Check 43: B reads own existing body_weight_log fixture and no foreign rows
    IF (EXISTS (SELECT 1 FROM public.body_weight_log WHERE id=weight_b AND user_id=client_b) AND NOT EXISTS (SELECT 1 FROM public.body_weight_log WHERE user_id IS DISTINCT FROM client_b)) IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'FitDataKit check 43: B reads own existing body_weight_log fixture and no foreign rows';
    END IF;
    checks := checks + 1;

    -- Check 44: B reads own existing ai_coach_usage fixture and no foreign rows
    IF (EXISTS (SELECT 1 FROM public.ai_coach_usage WHERE id=usage_b AND user_id=client_b) AND NOT EXISTS (SELECT 1 FROM public.ai_coach_usage WHERE user_id IS DISTINCT FROM client_b)) IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'FitDataKit check 44: B reads own existing ai_coach_usage fixture and no foreign rows';
    END IF;
    checks := checks + 1;

    -- Check 45: B reads own existing workouts fixture and no foreign rows
    IF (EXISTS (SELECT 1 FROM public.workouts WHERE id=legacy_b AND user_id=client_b) AND NOT EXISTS (SELECT 1 FROM public.workouts WHERE user_id IS DISTINCT FROM client_b)) IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'FitDataKit check 45: B reads own existing workouts fixture and no foreign rows';
    END IF;
    checks := checks + 1;

    -- Check 46: B reads own exercise_bests result and no foreign results
    IF (EXISTS (SELECT 1 FROM public.exercise_bests WHERE user_id=client_b) AND NOT EXISTS (SELECT 1 FROM public.exercise_bests WHERE user_id IS DISTINCT FROM client_b)) IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'FitDataKit check 46: B reads own exercise_bests result and no foreign results';
    END IF;
    checks := checks + 1;

    -- Check 47: B reads own exercise_pr_events result and no foreign results
    IF (EXISTS (SELECT 1 FROM public.exercise_pr_events WHERE user_id=client_b) AND NOT EXISTS (SELECT 1 FROM public.exercise_pr_events WHERE user_id IS DISTINCT FROM client_b)) IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'FitDataKit check 47: B reads own exercise_pr_events result and no foreign results';
    END IF;
    checks := checks + 1;

    -- Check 48: B reads own daily_summary result and no foreign results
    IF (EXISTS (SELECT 1 FROM public.daily_summary WHERE user_id=client_b) AND NOT EXISTS (SELECT 1 FROM public.daily_summary WHERE user_id IS DISTINCT FROM client_b)) IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'FitDataKit check 48: B reads own daily_summary result and no foreign results';
    END IF;
    checks := checks + 1;

    -- Check 49: B reads own supplement_due_from result and no foreign results
    IF (EXISTS (SELECT 1 FROM public.supplement_due_from WHERE user_id=client_b) AND NOT EXISTS (SELECT 1 FROM public.supplement_due_from WHERE user_id IS DISTINCT FROM client_b)) IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'FitDataKit check 49: B reads own supplement_due_from result and no foreign results';
    END IF;
    checks := checks + 1;

    -- Check 50: B reads own weight_monthly result and no foreign results
    IF (EXISTS (SELECT 1 FROM public.weight_monthly WHERE user_id=client_b) AND NOT EXISTS (SELECT 1 FROM public.weight_monthly WHERE user_id IS DISTINCT FROM client_b)) IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'FitDataKit check 50: B reads own weight_monthly result and no foreign results';
    END IF;
    checks := checks + 1;

    SET LOCAL ROLE authenticated;
    PERFORM set_config('request.jwt.claims', json_build_object('sub', client_a, 'role', 'authenticated')::text, true);
    PERFORM set_config('request.jwt.claim.sub', client_a::text, true);

    -- Check 51: A cannot read existing foreign rows in profiles
    IF (NOT EXISTS (SELECT 1 FROM public.profiles WHERE id IS DISTINCT FROM client_a)) IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'FitDataKit check 51: A cannot read existing foreign rows in profiles';
    END IF;
    checks := checks + 1;

    -- Check 52: A cannot read existing foreign rows in food_log
    IF (NOT EXISTS (SELECT 1 FROM public.food_log WHERE user_id IS DISTINCT FROM client_a)) IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'FitDataKit check 52: A cannot read existing foreign rows in food_log';
    END IF;
    checks := checks + 1;

    -- Check 53: A cannot read existing foreign rows in custom_foods
    IF (NOT EXISTS (SELECT 1 FROM public.custom_foods WHERE user_id IS DISTINCT FROM client_a)) IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'FitDataKit check 53: A cannot read existing foreign rows in custom_foods';
    END IF;
    checks := checks + 1;

    -- Check 54: A cannot read existing foreign rows in workout_sessions
    IF (NOT EXISTS (SELECT 1 FROM public.workout_sessions WHERE user_id IS DISTINCT FROM client_a)) IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'FitDataKit check 54: A cannot read existing foreign rows in workout_sessions';
    END IF;
    checks := checks + 1;

    -- Check 55: A cannot read existing foreign rows in workout_plans
    IF (NOT EXISTS (SELECT 1 FROM public.workout_plans WHERE user_id IS DISTINCT FROM client_a)) IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'FitDataKit check 55: A cannot read existing foreign rows in workout_plans';
    END IF;
    checks := checks + 1;

    -- Check 56: A cannot read existing foreign rows in supplement_stack
    IF (NOT EXISTS (SELECT 1 FROM public.supplement_stack WHERE user_id IS DISTINCT FROM client_a)) IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'FitDataKit check 56: A cannot read existing foreign rows in supplement_stack';
    END IF;
    checks := checks + 1;

    -- Check 57: A cannot read existing foreign rows in supplement_log
    IF (NOT EXISTS (SELECT 1 FROM public.supplement_log WHERE user_id IS DISTINCT FROM client_a)) IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'FitDataKit check 57: A cannot read existing foreign rows in supplement_log';
    END IF;
    checks := checks + 1;

    -- Check 58: A cannot read existing foreign rows in water_log
    IF (NOT EXISTS (SELECT 1 FROM public.water_log WHERE user_id IS DISTINCT FROM client_a)) IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'FitDataKit check 58: A cannot read existing foreign rows in water_log';
    END IF;
    checks := checks + 1;

    -- Check 59: A cannot read existing foreign rows in body_weight_log
    IF (NOT EXISTS (SELECT 1 FROM public.body_weight_log WHERE user_id IS DISTINCT FROM client_a)) IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'FitDataKit check 59: A cannot read existing foreign rows in body_weight_log';
    END IF;
    checks := checks + 1;

    -- Check 60: A cannot read existing foreign rows in ai_coach_usage
    IF (NOT EXISTS (SELECT 1 FROM public.ai_coach_usage WHERE user_id IS DISTINCT FROM client_a)) IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'FitDataKit check 60: A cannot read existing foreign rows in ai_coach_usage';
    END IF;
    checks := checks + 1;

    -- Check 61: A cannot read existing foreign rows in workouts
    IF (NOT EXISTS (SELECT 1 FROM public.workouts WHERE user_id IS DISTINCT FROM client_a)) IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'FitDataKit check 61: A cannot read existing foreign rows in workouts';
    END IF;
    checks := checks + 1;

    -- Check 62: A reads own exercise_bests result and no foreign results
    IF (EXISTS (SELECT 1 FROM public.exercise_bests WHERE user_id=client_a) AND NOT EXISTS (SELECT 1 FROM public.exercise_bests WHERE user_id IS DISTINCT FROM client_a)) IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'FitDataKit check 62: A reads own exercise_bests result and no foreign results';
    END IF;
    checks := checks + 1;

    -- Check 63: A reads own exercise_pr_events result and no foreign results
    IF (EXISTS (SELECT 1 FROM public.exercise_pr_events WHERE user_id=client_a) AND NOT EXISTS (SELECT 1 FROM public.exercise_pr_events WHERE user_id IS DISTINCT FROM client_a)) IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'FitDataKit check 63: A reads own exercise_pr_events result and no foreign results';
    END IF;
    checks := checks + 1;

    -- Check 64: A reads own daily_summary result and no foreign results
    IF (EXISTS (SELECT 1 FROM public.daily_summary WHERE user_id=client_a) AND NOT EXISTS (SELECT 1 FROM public.daily_summary WHERE user_id IS DISTINCT FROM client_a)) IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'FitDataKit check 64: A reads own daily_summary result and no foreign results';
    END IF;
    checks := checks + 1;

    -- Check 65: A reads own supplement_due_from result and no foreign results
    IF (EXISTS (SELECT 1 FROM public.supplement_due_from WHERE user_id=client_a) AND NOT EXISTS (SELECT 1 FROM public.supplement_due_from WHERE user_id IS DISTINCT FROM client_a)) IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'FitDataKit check 65: A reads own supplement_due_from result and no foreign results';
    END IF;
    checks := checks + 1;

    -- Check 66: A reads own weight_monthly result and no foreign results
    IF (EXISTS (SELECT 1 FROM public.weight_monthly WHERE user_id=client_a) AND NOT EXISTS (SELECT 1 FROM public.weight_monthly WHERE user_id IS DISTINCT FROM client_a)) IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'FitDataKit check 66: A reads own weight_monthly result and no foreign results';
    END IF;
    checks := checks + 1;

    -- Spoofed owners below refer to an existing auth user and real foreign
    -- rows. Only SQLSTATE 42501 counts as the intended RLS denial.

    denied := false;
    BEGIN
      INSERT INTO public.profiles (id,name) VALUES (client_b,'Forbidden profile');
    EXCEPTION WHEN insufficient_privilege THEN
      denied := true;
    END;

    -- Check 67: RLS rejects a real foreign owner insert in profiles
    IF (denied) IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'FitDataKit check 67: RLS rejects a real foreign owner insert in profiles';
    END IF;
    checks := checks + 1;

    denied := false;
    BEGIN
      INSERT INTO public.food_log (user_id,logged_date,meal_slot,food_name,grams) VALUES (client_b,DATE '2099-01-30','breakfast','Forbidden food',1);
    EXCEPTION WHEN insufficient_privilege THEN
      denied := true;
    END;

    -- Check 68: RLS rejects a real foreign owner insert in food_log
    IF (denied) IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'FitDataKit check 68: RLS rejects a real foreign owner insert in food_log';
    END IF;
    checks := checks + 1;

    denied := false;
    BEGIN
      INSERT INTO public.custom_foods (user_id,name) VALUES (client_b,'Forbidden custom');
    EXCEPTION WHEN insufficient_privilege THEN
      denied := true;
    END;

    -- Check 69: RLS rejects a real foreign owner insert in custom_foods
    IF (denied) IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'FitDataKit check 69: RLS rejects a real foreign owner insert in custom_foods';
    END IF;
    checks := checks + 1;

    denied := false;
    BEGIN
      INSERT INTO public.workout_sessions (user_id,workout_name,completed_date) VALUES (client_b,'Forbidden session',DATE '2099-01-30');
    EXCEPTION WHEN insufficient_privilege THEN
      denied := true;
    END;

    -- Check 70: RLS rejects a real foreign owner insert in workout_sessions
    IF (denied) IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'FitDataKit check 70: RLS rejects a real foreign owner insert in workout_sessions';
    END IF;
    checks := checks + 1;

    denied := false;
    BEGIN
      INSERT INTO public.workout_plans (user_id,name) VALUES (client_b,'Forbidden plan');
    EXCEPTION WHEN insufficient_privilege THEN
      denied := true;
    END;

    -- Check 71: RLS rejects a real foreign owner insert in workout_plans
    IF (denied) IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'FitDataKit check 71: RLS rejects a real foreign owner insert in workout_plans';
    END IF;
    checks := checks + 1;

    denied := false;
    BEGIN
      INSERT INTO public.supplement_stack (user_id,name) VALUES (client_b,'Forbidden stack');
    EXCEPTION WHEN insufficient_privilege THEN
      denied := true;
    END;

    -- Check 72: RLS rejects a real foreign owner insert in supplement_stack
    IF (denied) IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'FitDataKit check 72: RLS rejects a real foreign owner insert in supplement_stack';
    END IF;
    checks := checks + 1;

    denied := false;
    BEGIN
      INSERT INTO public.supplement_log (user_id,supplement_id,log_date,taken) VALUES (client_b,stack_b,DATE '2099-01-30',true);
    EXCEPTION WHEN insufficient_privilege THEN
      denied := true;
    END;

    -- Check 73: RLS rejects a real foreign owner insert in supplement_log
    IF (denied) IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'FitDataKit check 73: RLS rejects a real foreign owner insert in supplement_log';
    END IF;
    checks := checks + 1;

    denied := false;
    BEGIN
      INSERT INTO public.water_log (user_id,log_date,oz) VALUES (client_b,DATE '2099-01-30',8);
    EXCEPTION WHEN insufficient_privilege THEN
      denied := true;
    END;

    -- Check 74: RLS rejects a real foreign owner insert in water_log
    IF (denied) IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'FitDataKit check 74: RLS rejects a real foreign owner insert in water_log';
    END IF;
    checks := checks + 1;

    denied := false;
    BEGIN
      INSERT INTO public.body_weight_log (user_id,log_date,weight_lbs) VALUES (client_b,DATE '2099-01-30',150);
    EXCEPTION WHEN insufficient_privilege THEN
      denied := true;
    END;

    -- Check 75: RLS rejects a real foreign owner insert in body_weight_log
    IF (denied) IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'FitDataKit check 75: RLS rejects a real foreign owner insert in body_weight_log';
    END IF;
    checks := checks + 1;

    denied := false;
    BEGIN
      INSERT INTO public.ai_coach_usage (user_id) VALUES (client_b);
    EXCEPTION WHEN insufficient_privilege THEN
      denied := true;
    END;

    -- Check 76: RLS rejects a real foreign owner insert in ai_coach_usage
    IF (denied) IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'FitDataKit check 76: RLS rejects a real foreign owner insert in ai_coach_usage';
    END IF;
    checks := checks + 1;

    denied := false;
    BEGIN
      INSERT INTO public.workouts (user_id,name) VALUES (client_b,'Forbidden legacy');
    EXCEPTION WHEN insufficient_privilege THEN
      denied := true;
    END;

    -- Check 77: RLS rejects a real foreign owner insert in workouts
    IF (denied) IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'FitDataKit check 77: RLS rejects a real foreign owner insert in workouts';
    END IF;
    checks := checks + 1;

    UPDATE public.profiles SET name='Forbidden update' WHERE id=client_b;
    GET DIAGNOSTICS affected = ROW_COUNT;

    -- Check 78: Foreign profiles update affects zero rows
    IF (affected=0) IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'FitDataKit check 78: Foreign profiles update affects zero rows';
    END IF;
    checks := checks + 1;

    DELETE FROM public.profiles WHERE id=client_b;
    GET DIAGNOSTICS affected = ROW_COUNT;

    -- Check 79: Foreign profiles delete affects zero rows
    IF (affected=0) IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'FitDataKit check 79: Foreign profiles delete affects zero rows';
    END IF;
    checks := checks + 1;

    UPDATE public.food_log SET food_name='Forbidden update' WHERE id=food_b;
    GET DIAGNOSTICS affected = ROW_COUNT;

    -- Check 80: Foreign food_log update affects zero rows
    IF (affected=0) IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'FitDataKit check 80: Foreign food_log update affects zero rows';
    END IF;
    checks := checks + 1;

    DELETE FROM public.food_log WHERE id=food_b;
    GET DIAGNOSTICS affected = ROW_COUNT;

    -- Check 81: Foreign food_log delete affects zero rows
    IF (affected=0) IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'FitDataKit check 81: Foreign food_log delete affects zero rows';
    END IF;
    checks := checks + 1;

    UPDATE public.custom_foods SET name='Forbidden update' WHERE id=custom_b;
    GET DIAGNOSTICS affected = ROW_COUNT;

    -- Check 82: Foreign custom_foods update affects zero rows
    IF (affected=0) IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'FitDataKit check 82: Foreign custom_foods update affects zero rows';
    END IF;
    checks := checks + 1;

    DELETE FROM public.custom_foods WHERE id=custom_b;
    GET DIAGNOSTICS affected = ROW_COUNT;

    -- Check 83: Foreign custom_foods delete affects zero rows
    IF (affected=0) IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'FitDataKit check 83: Foreign custom_foods delete affects zero rows';
    END IF;
    checks := checks + 1;

    UPDATE public.workout_sessions SET workout_name='Forbidden update' WHERE id=session_b;
    GET DIAGNOSTICS affected = ROW_COUNT;

    -- Check 84: Foreign workout_sessions update affects zero rows
    IF (affected=0) IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'FitDataKit check 84: Foreign workout_sessions update affects zero rows';
    END IF;
    checks := checks + 1;

    DELETE FROM public.workout_sessions WHERE id=session_b;
    GET DIAGNOSTICS affected = ROW_COUNT;

    -- Check 85: Foreign workout_sessions delete affects zero rows
    IF (affected=0) IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'FitDataKit check 85: Foreign workout_sessions delete affects zero rows';
    END IF;
    checks := checks + 1;

    UPDATE public.workout_plans SET name='Forbidden update' WHERE id=plan_b;
    GET DIAGNOSTICS affected = ROW_COUNT;

    -- Check 86: Foreign workout_plans update affects zero rows
    IF (affected=0) IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'FitDataKit check 86: Foreign workout_plans update affects zero rows';
    END IF;
    checks := checks + 1;

    DELETE FROM public.workout_plans WHERE id=plan_b;
    GET DIAGNOSTICS affected = ROW_COUNT;

    -- Check 87: Foreign workout_plans delete affects zero rows
    IF (affected=0) IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'FitDataKit check 87: Foreign workout_plans delete affects zero rows';
    END IF;
    checks := checks + 1;

    UPDATE public.supplement_stack SET name='Forbidden update' WHERE id=stack_b;
    GET DIAGNOSTICS affected = ROW_COUNT;

    -- Check 88: Foreign supplement_stack update affects zero rows
    IF (affected=0) IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'FitDataKit check 88: Foreign supplement_stack update affects zero rows';
    END IF;
    checks := checks + 1;

    DELETE FROM public.supplement_stack WHERE id=stack_b;
    GET DIAGNOSTICS affected = ROW_COUNT;

    -- Check 89: Foreign supplement_stack delete affects zero rows
    IF (affected=0) IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'FitDataKit check 89: Foreign supplement_stack delete affects zero rows';
    END IF;
    checks := checks + 1;

    UPDATE public.supplement_log SET taken=false WHERE id=supp_b;
    GET DIAGNOSTICS affected = ROW_COUNT;

    -- Check 90: Foreign supplement_log update affects zero rows
    IF (affected=0) IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'FitDataKit check 90: Foreign supplement_log update affects zero rows';
    END IF;
    checks := checks + 1;

    DELETE FROM public.supplement_log WHERE id=supp_b;
    GET DIAGNOSTICS affected = ROW_COUNT;

    -- Check 91: Foreign supplement_log delete affects zero rows
    IF (affected=0) IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'FitDataKit check 91: Foreign supplement_log delete affects zero rows';
    END IF;
    checks := checks + 1;

    UPDATE public.water_log SET oz=1 WHERE id=water_b;
    GET DIAGNOSTICS affected = ROW_COUNT;

    -- Check 92: Foreign water_log update affects zero rows
    IF (affected=0) IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'FitDataKit check 92: Foreign water_log update affects zero rows';
    END IF;
    checks := checks + 1;

    DELETE FROM public.water_log WHERE id=water_b;
    GET DIAGNOSTICS affected = ROW_COUNT;

    -- Check 93: Foreign water_log delete affects zero rows
    IF (affected=0) IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'FitDataKit check 93: Foreign water_log delete affects zero rows';
    END IF;
    checks := checks + 1;

    UPDATE public.body_weight_log SET weight_lbs=1 WHERE id=weight_b;
    GET DIAGNOSTICS affected = ROW_COUNT;

    -- Check 94: Foreign body_weight_log update affects zero rows
    IF (affected=0) IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'FitDataKit check 94: Foreign body_weight_log update affects zero rows';
    END IF;
    checks := checks + 1;

    DELETE FROM public.body_weight_log WHERE id=weight_b;
    GET DIAGNOSTICS affected = ROW_COUNT;

    -- Check 95: Foreign body_weight_log delete affects zero rows
    IF (affected=0) IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'FitDataKit check 95: Foreign body_weight_log delete affects zero rows';
    END IF;
    checks := checks + 1;

    UPDATE public.ai_coach_usage SET created_at=TIMESTAMPTZ '2099-01-01 00:00:00+00' WHERE id=usage_b;
    GET DIAGNOSTICS affected = ROW_COUNT;

    -- Check 96: Foreign ai_coach_usage update affects zero rows
    IF (affected=0) IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'FitDataKit check 96: Foreign ai_coach_usage update affects zero rows';
    END IF;
    checks := checks + 1;

    DELETE FROM public.ai_coach_usage WHERE id=usage_b;
    GET DIAGNOSTICS affected = ROW_COUNT;

    -- Check 97: Foreign ai_coach_usage delete affects zero rows
    IF (affected=0) IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'FitDataKit check 97: Foreign ai_coach_usage delete affects zero rows';
    END IF;
    checks := checks + 1;

    UPDATE public.workouts SET name='Forbidden update' WHERE id=legacy_b;
    GET DIAGNOSTICS affected = ROW_COUNT;

    -- Check 98: Foreign workouts update affects zero rows
    IF (affected=0) IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'FitDataKit check 98: Foreign workouts update affects zero rows';
    END IF;
    checks := checks + 1;

    DELETE FROM public.workouts WHERE id=legacy_b;
    GET DIAGNOSTICS affected = ROW_COUNT;

    -- Check 99: Foreign workouts delete affects zero rows
    IF (affected=0) IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'FitDataKit check 99: Foreign workouts delete affects zero rows';
    END IF;
    checks := checks + 1;

    denied := false;
    BEGIN
      UPDATE public.profiles SET id=client_b WHERE id=client_a;
    EXCEPTION WHEN insufficient_privilege THEN
      denied := true;
    END;

    -- Check 100: RLS rejects ownership reassignment in profiles
    IF (denied) IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'FitDataKit check 100: RLS rejects ownership reassignment in profiles';
    END IF;
    checks := checks + 1;

    denied := false;
    BEGIN
      UPDATE public.food_log SET user_id=client_b WHERE id=food_a;
    EXCEPTION WHEN insufficient_privilege THEN
      denied := true;
    END;

    -- Check 101: RLS rejects ownership reassignment in food_log
    IF (denied) IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'FitDataKit check 101: RLS rejects ownership reassignment in food_log';
    END IF;
    checks := checks + 1;

    denied := false;
    BEGIN
      UPDATE public.custom_foods SET user_id=client_b WHERE id=custom_a;
    EXCEPTION WHEN insufficient_privilege THEN
      denied := true;
    END;

    -- Check 102: RLS rejects ownership reassignment in custom_foods
    IF (denied) IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'FitDataKit check 102: RLS rejects ownership reassignment in custom_foods';
    END IF;
    checks := checks + 1;

    denied := false;
    BEGIN
      UPDATE public.workout_sessions SET user_id=client_b WHERE id=session_first;
    EXCEPTION WHEN insufficient_privilege THEN
      denied := true;
    END;

    -- Check 103: RLS rejects ownership reassignment in workout_sessions
    IF (denied) IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'FitDataKit check 103: RLS rejects ownership reassignment in workout_sessions';
    END IF;
    checks := checks + 1;

    denied := false;
    BEGIN
      UPDATE public.workout_plans SET user_id=client_b WHERE id=plan_a;
    EXCEPTION WHEN insufficient_privilege THEN
      denied := true;
    END;

    -- Check 104: RLS rejects ownership reassignment in workout_plans
    IF (denied) IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'FitDataKit check 104: RLS rejects ownership reassignment in workout_plans';
    END IF;
    checks := checks + 1;

    denied := false;
    BEGIN
      UPDATE public.supplement_stack SET user_id=client_b WHERE id=stack_a;
    EXCEPTION WHEN insufficient_privilege THEN
      denied := true;
    END;

    -- Check 105: RLS rejects ownership reassignment in supplement_stack
    IF (denied) IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'FitDataKit check 105: RLS rejects ownership reassignment in supplement_stack';
    END IF;
    checks := checks + 1;

    denied := false;
    BEGIN
      UPDATE public.supplement_log SET user_id=client_b WHERE id=supp_a;
    EXCEPTION WHEN insufficient_privilege THEN
      denied := true;
    END;

    -- Check 106: RLS rejects ownership reassignment in supplement_log
    IF (denied) IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'FitDataKit check 106: RLS rejects ownership reassignment in supplement_log';
    END IF;
    checks := checks + 1;

    denied := false;
    BEGIN
      UPDATE public.water_log SET user_id=client_b WHERE id=water_a;
    EXCEPTION WHEN insufficient_privilege THEN
      denied := true;
    END;

    -- Check 107: RLS rejects ownership reassignment in water_log
    IF (denied) IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'FitDataKit check 107: RLS rejects ownership reassignment in water_log';
    END IF;
    checks := checks + 1;

    denied := false;
    BEGIN
      UPDATE public.body_weight_log SET user_id=client_b WHERE id=weight_a;
    EXCEPTION WHEN insufficient_privilege THEN
      denied := true;
    END;

    -- Check 108: RLS rejects ownership reassignment in body_weight_log
    IF (denied) IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'FitDataKit check 108: RLS rejects ownership reassignment in body_weight_log';
    END IF;
    checks := checks + 1;

    denied := false;
    BEGIN
      UPDATE public.workouts SET user_id=client_b WHERE id=legacy_a;
    EXCEPTION WHEN insufficient_privilege THEN
      denied := true;
    END;

    -- Check 109: RLS rejects ownership reassignment in workouts
    IF (denied) IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'FitDataKit check 109: RLS rejects ownership reassignment in workouts';
    END IF;
    checks := checks + 1;

    UPDATE public.ai_coach_usage SET created_at=TIMESTAMPTZ '2099-01-01 00:00:00+00' WHERE id=usage_a;
    GET DIAGNOSTICS affected = ROW_COUNT;

    -- Check 110: Own usage row cannot be backdated
    IF (affected=0 AND EXISTS (SELECT 1 FROM public.ai_coach_usage WHERE id=usage_a AND created_at=TIMESTAMPTZ '2099-01-02 12:00:00+00')) IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'FitDataKit check 110: Own usage row cannot be backdated';
    END IF;
    checks := checks + 1;

    DELETE FROM public.ai_coach_usage WHERE id=usage_a;
    GET DIAGNOSTICS affected = ROW_COUNT;

    -- Check 111: Own usage row cannot be deleted to reset quota
    IF (affected=0 AND EXISTS (SELECT 1 FROM public.ai_coach_usage WHERE id=usage_a)) IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'FitDataKit check 111: Own usage row cannot be deleted to reset quota';
    END IF;
    checks := checks + 1;

    -- DIAGNOSTIC ONLY: ownership of a supplement_log's parent. This is not
    -- counted as a passed isolation assertion if the parent check is absent.
    -- A successful insert is read back then deliberately rolled back locally.
    parent_rollback_requested := false;
    BEGIN
      INSERT INTO public.supplement_log (id,user_id,supplement_id,log_date,taken)
      VALUES (parent_probe,client_a,stack_b,DATE '2099-01-31',true)
      RETURNING id INTO returned_id;
      IF returned_id IS DISTINCT FROM parent_probe OR NOT EXISTS
        (SELECT 1 FROM public.supplement_log WHERE id=parent_probe AND user_id=client_a AND supplement_id=stack_b)
      THEN
        RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='Parent probe insert was not verified';
      END IF;
      parent_owner_enforced := false;
      parent_rollback_requested := true;
      RAISE SQLSTATE 'ZX002' USING MESSAGE='FitDataKit parent diagnostic rollback';
    EXCEPTION
      WHEN insufficient_privilege OR foreign_key_violation THEN
        parent_owner_enforced := true;
      WHEN SQLSTATE 'ZX002' THEN
        GET STACKED DIAGNOSTICS caught_message = MESSAGE_TEXT;
        IF NOT parent_rollback_requested OR caught_message <> 'FitDataKit parent diagnostic rollback' THEN
          RAISE;
        END IF;
    END;

    -- Check 112: Parent diagnostic completed and left no diagnostic row (not a parent-isolation pass)
    IF (parent_owner_enforced IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.supplement_log WHERE id=parent_probe)) IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'FitDataKit check 112: Parent diagnostic completed and left no diagnostic row (not a parent-isolation pass)';
    END IF;
    checks := checks + 1;

    SET LOCAL ROLE anon;
    PERFORM set_config('request.jwt.claims','{"role":"anon"}',true);
    PERFORM set_config('request.jwt.claim.sub','',true);

    -- Check 113: Anonymous fixture requests have no authenticated UID
    IF (auth.uid() IS NULL AND current_user='anon') IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'FitDataKit check 113: Anonymous fixture requests have no authenticated UID';
    END IF;
    checks := checks + 1;

    -- Check 114: Anonymous read sees no profiles rows
    IF (NOT EXISTS (SELECT 1 FROM public.profiles)) IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'FitDataKit check 114: Anonymous read sees no profiles rows';
    END IF;
    checks := checks + 1;

    -- Check 115: Anonymous read sees no food_log rows
    IF (NOT EXISTS (SELECT 1 FROM public.food_log)) IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'FitDataKit check 115: Anonymous read sees no food_log rows';
    END IF;
    checks := checks + 1;

    -- Check 116: Anonymous read sees no custom_foods rows
    IF (NOT EXISTS (SELECT 1 FROM public.custom_foods)) IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'FitDataKit check 116: Anonymous read sees no custom_foods rows';
    END IF;
    checks := checks + 1;

    -- Check 117: Anonymous read sees no workout_sessions rows
    IF (NOT EXISTS (SELECT 1 FROM public.workout_sessions)) IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'FitDataKit check 117: Anonymous read sees no workout_sessions rows';
    END IF;
    checks := checks + 1;

    -- Check 118: Anonymous read sees no workout_plans rows
    IF (NOT EXISTS (SELECT 1 FROM public.workout_plans)) IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'FitDataKit check 118: Anonymous read sees no workout_plans rows';
    END IF;
    checks := checks + 1;

    -- Check 119: Anonymous read sees no supplement_stack rows
    IF (NOT EXISTS (SELECT 1 FROM public.supplement_stack)) IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'FitDataKit check 119: Anonymous read sees no supplement_stack rows';
    END IF;
    checks := checks + 1;

    -- Check 120: Anonymous read sees no supplement_log rows
    IF (NOT EXISTS (SELECT 1 FROM public.supplement_log)) IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'FitDataKit check 120: Anonymous read sees no supplement_log rows';
    END IF;
    checks := checks + 1;

    -- Check 121: Anonymous read sees no water_log rows
    IF (NOT EXISTS (SELECT 1 FROM public.water_log)) IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'FitDataKit check 121: Anonymous read sees no water_log rows';
    END IF;
    checks := checks + 1;

    -- Check 122: Anonymous read sees no body_weight_log rows
    IF (NOT EXISTS (SELECT 1 FROM public.body_weight_log)) IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'FitDataKit check 122: Anonymous read sees no body_weight_log rows';
    END IF;
    checks := checks + 1;

    -- Check 123: Anonymous read sees no ai_coach_usage rows
    IF (NOT EXISTS (SELECT 1 FROM public.ai_coach_usage)) IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'FitDataKit check 123: Anonymous read sees no ai_coach_usage rows';
    END IF;
    checks := checks + 1;

    -- Check 124: Anonymous read sees no workouts rows
    IF (NOT EXISTS (SELECT 1 FROM public.workouts)) IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'FitDataKit check 124: Anonymous read sees no workouts rows';
    END IF;
    checks := checks + 1;

    denied := false;
    BEGIN
      PERFORM 1 FROM public.exercise_bests;
    EXCEPTION WHEN insufficient_privilege THEN
      denied := true;
    END;

    -- Check 125: Anonymous SELECT privilege denied for exercise_bests
    IF (denied) IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'FitDataKit check 125: Anonymous SELECT privilege denied for exercise_bests';
    END IF;
    checks := checks + 1;

    denied := false;
    BEGIN
      PERFORM 1 FROM public.exercise_pr_events;
    EXCEPTION WHEN insufficient_privilege THEN
      denied := true;
    END;

    -- Check 126: Anonymous SELECT privilege denied for exercise_pr_events
    IF (denied) IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'FitDataKit check 126: Anonymous SELECT privilege denied for exercise_pr_events';
    END IF;
    checks := checks + 1;

    denied := false;
    BEGIN
      PERFORM 1 FROM public.daily_summary;
    EXCEPTION WHEN insufficient_privilege THEN
      denied := true;
    END;

    -- Check 127: Anonymous SELECT privilege denied for daily_summary
    IF (denied) IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'FitDataKit check 127: Anonymous SELECT privilege denied for daily_summary';
    END IF;
    checks := checks + 1;

    denied := false;
    BEGIN
      PERFORM 1 FROM public.supplement_due_from;
    EXCEPTION WHEN insufficient_privilege THEN
      denied := true;
    END;

    -- Check 128: Anonymous SELECT privilege denied for supplement_due_from
    IF (denied) IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'FitDataKit check 128: Anonymous SELECT privilege denied for supplement_due_from';
    END IF;
    checks := checks + 1;

    denied := false;
    BEGIN
      PERFORM 1 FROM public.weight_monthly;
    EXCEPTION WHEN insufficient_privilege THEN
      denied := true;
    END;

    -- Check 129: Anonymous SELECT privilege denied for weight_monthly
    IF (denied) IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'FitDataKit check 129: Anonymous SELECT privilege denied for weight_monthly';
    END IF;
    checks := checks + 1;

    denied := false;
    BEGIN
      INSERT INTO public.food_log (user_id,meal_slot,food_name,grams) VALUES (client_a,'breakfast','Forbidden anon',1);
    EXCEPTION WHEN insufficient_privilege THEN
      denied := true;
    END;

    -- Check 130: Anonymous insert cannot spoof a valid fixture user
    IF (denied) IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'FitDataKit check 130: Anonymous insert cannot spoof a valid fixture user';
    END IF;
    checks := checks + 1;

    UPDATE public.food_log SET grams=1 WHERE id=food_a;
    GET DIAGNOSTICS affected = ROW_COUNT;

    -- Check 131: Anonymous update affects zero existing food rows
    IF (affected=0) IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'FitDataKit check 131: Anonymous update affects zero existing food rows';
    END IF;
    checks := checks + 1;

    DELETE FROM public.food_log WHERE id=food_a;
    GET DIAGNOSTICS affected = ROW_COUNT;

    -- Check 132: Anonymous delete affects zero existing food rows
    IF (affected=0) IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'FitDataKit check 132: Anonymous delete affects zero existing food rows';
    END IF;
    checks := checks + 1;

    SET LOCAL ROLE authenticated;
    PERFORM set_config('request.jwt.claims', json_build_object('sub', client_b, 'role', 'authenticated')::text, true);
    PERFORM set_config('request.jwt.claim.sub', client_b::text, true);

    -- Check 133: Foreign mutation probes left B profiles unchanged
    IF (EXISTS (SELECT 1 FROM public.profiles WHERE id=client_b AND name='FitDataKit B')) IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'FitDataKit check 133: Foreign mutation probes left B profiles unchanged';
    END IF;
    checks := checks + 1;

    -- Check 134: Foreign mutation probes left B food_log unchanged
    IF (EXISTS (SELECT 1 FROM public.food_log WHERE id=food_b AND food_name='FitDataKit B')) IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'FitDataKit check 134: Foreign mutation probes left B food_log unchanged';
    END IF;
    checks := checks + 1;

    -- Check 135: Foreign mutation probes left B custom_foods unchanged
    IF (EXISTS (SELECT 1 FROM public.custom_foods WHERE id=custom_b AND name='FitDataKit B')) IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'FitDataKit check 135: Foreign mutation probes left B custom_foods unchanged';
    END IF;
    checks := checks + 1;

    -- Check 136: Foreign mutation probes left B workout_sessions unchanged
    IF (EXISTS (SELECT 1 FROM public.workout_sessions WHERE id=session_b AND workout_name='FitDataKit B')) IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'FitDataKit check 136: Foreign mutation probes left B workout_sessions unchanged';
    END IF;
    checks := checks + 1;

    -- Check 137: Foreign mutation probes left B workout_plans unchanged
    IF (EXISTS (SELECT 1 FROM public.workout_plans WHERE id=plan_b AND name='FitDataKit B')) IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'FitDataKit check 137: Foreign mutation probes left B workout_plans unchanged';
    END IF;
    checks := checks + 1;

    -- Check 138: Foreign mutation probes left B supplement_stack unchanged
    IF (EXISTS (SELECT 1 FROM public.supplement_stack WHERE id=stack_b AND name='FitDataKit B')) IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'FitDataKit check 138: Foreign mutation probes left B supplement_stack unchanged';
    END IF;
    checks := checks + 1;

    -- Check 139: Foreign mutation probes left B supplement_log unchanged
    IF (EXISTS (SELECT 1 FROM public.supplement_log WHERE id=supp_b AND taken=true)) IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'FitDataKit check 139: Foreign mutation probes left B supplement_log unchanged';
    END IF;
    checks := checks + 1;

    -- Check 140: Foreign mutation probes left B water_log unchanged
    IF (EXISTS (SELECT 1 FROM public.water_log WHERE id=water_b AND oz=24)) IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'FitDataKit check 140: Foreign mutation probes left B water_log unchanged';
    END IF;
    checks := checks + 1;

    -- Check 141: Foreign mutation probes left B body_weight_log unchanged
    IF (EXISTS (SELECT 1 FROM public.body_weight_log WHERE id=weight_b AND weight_lbs=150.5)) IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'FitDataKit check 141: Foreign mutation probes left B body_weight_log unchanged';
    END IF;
    checks := checks + 1;

    -- Check 142: Foreign mutation probes left B ai_coach_usage unchanged
    IF (EXISTS (SELECT 1 FROM public.ai_coach_usage WHERE id=usage_b AND created_at=TIMESTAMPTZ '2099-01-02 12:00:00+00')) IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'FitDataKit check 142: Foreign mutation probes left B ai_coach_usage unchanged';
    END IF;
    checks := checks + 1;

    -- Check 143: Foreign mutation probes left B workouts unchanged
    IF (EXISTS (SELECT 1 FROM public.workouts WHERE id=legacy_b AND name='FitDataKit B')) IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'FitDataKit check 143: Foreign mutation probes left B workouts unchanged';
    END IF;
    checks := checks + 1;

    SET LOCAL ROLE authenticated;
    PERFORM set_config('request.jwt.claims', json_build_object('sub', client_a, 'role', 'authenticated')::text, true);
    PERFORM set_config('request.jwt.claim.sub', client_a::text, true);

    UPDATE public.food_log SET grams=100 WHERE id=food_a RETURNING id INTO returned_id;
    GET DIAGNOSTICS affected = ROW_COUNT;

    -- Check 144: Own food edit returns matching UUID and persists actual row
    IF (affected=1 AND returned_id=food_a AND EXISTS (SELECT 1 FROM public.food_log WHERE id=food_a AND grams=100 AND per100_sugar IS NULL)) IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'FitDataKit check 144: Own food edit returns matching UUID and persists actual row';
    END IF;
    checks := checks + 1;

    -- Check 145: Food edit recomputes daily_summary
    IF (EXISTS (SELECT 1 FROM public.daily_summary WHERE user_id=client_a AND day=DATE '2099-01-02' AND kcal=32 AND protein_g=1 AND carbs_g=2 AND fat_g=1)) IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'FitDataKit check 145: Food edit recomputes daily_summary';
    END IF;
    checks := checks + 1;

    DELETE FROM public.workout_sessions WHERE id=session_best RETURNING id INTO returned_id;
    GET DIAGNOSTICS affected = ROW_COUNT;

    -- Check 146: Own workout delete returns matching UUID and removes row
    IF (affected=1 AND returned_id=session_best AND NOT EXISTS (SELECT 1 FROM public.workout_sessions WHERE id=session_best)) IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'FitDataKit check 146: Own workout delete returns matching UUID and removes row';
    END IF;
    checks := checks + 1;

    -- Check 147: Deleting earlier best promotes the later fractional lift to a PR
    IF ((SELECT count(*) FROM public.exercise_pr_events WHERE user_id=client_a)=1 AND EXISTS (SELECT 1 FROM public.exercise_pr_events WHERE user_id=client_a AND session_id=session_promote AND lbs=101.25 AND prev_best=100.25)) IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'FitDataKit check 147: Deleting earlier best promotes the later fractional lift to a PR';
    END IF;
    checks := checks + 1;

    -- Check 148: Deleting earlier best recomputes baseline from remaining sessions
    IF (EXISTS (SELECT 1 FROM public.exercise_bests WHERE user_id=client_a AND name='FitDataKit lift' AND best_lbs=101.25)) IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'FitDataKit check 148: Deleting earlier best recomputes baseline from remaining sessions';
    END IF;
    checks := checks + 1;

    UPDATE public.workout_sessions
    SET exercises='[{"name":"FitDataKit lift","sets":["8×102.125lbs"],"setsData":[{"reps":8,"weight":102.125}]}]'::jsonb
    WHERE id=session_promote RETURNING id INTO returned_id;
    GET DIAGNOSTICS affected = ROW_COUNT;

    -- Check 149: Session set edit updates fractional baseline without truncation
    IF (affected=1 AND returned_id=session_promote AND EXISTS (SELECT 1 FROM public.exercise_bests WHERE user_id=client_a AND name='FitDataKit lift' AND best_lbs=102.125)) IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'FitDataKit check 149: Session set edit updates fractional baseline without truncation';
    END IF;
    checks := checks + 1;

    -- Check 150: Session set edit recomputes PR event from numeric setsData
    IF (EXISTS (SELECT 1 FROM public.exercise_pr_events WHERE user_id=client_a AND session_id=session_promote AND lbs=102.125 AND prev_best=100.25)) IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'FitDataKit check 150: Session set edit recomputes PR event from numeric setsData';
    END IF;
    checks := checks + 1;

    DELETE FROM public.workout_sessions WHERE id=session_promote;
    GET DIAGNOSTICS affected = ROW_COUNT;

    -- Check 151: Removing remaining PR leaves first/tied lifts and no event
    IF (affected=1 AND NOT EXISTS (SELECT 1 FROM public.exercise_pr_events WHERE user_id=client_a) AND EXISTS (SELECT 1 FROM public.exercise_bests WHERE user_id=client_a AND name='FitDataKit lift' AND best_lbs=100.25)) IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'FitDataKit check 151: Removing remaining PR leaves first/tied lifts and no event';
    END IF;
    checks := checks + 1;

    DELETE FROM public.food_log WHERE id=food_a RETURNING id INTO returned_id;
    GET DIAGNOSTICS affected = ROW_COUNT;

    -- Check 152: Own food delete returns UUID and removes actual row
    IF (affected=1 AND returned_id=food_a AND NOT EXISTS (SELECT 1 FROM public.food_log WHERE id=food_a)) IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'FitDataKit check 152: Own food delete returns UUID and removes actual row';
    END IF;
    checks := checks + 1;

    DELETE FROM public.supplement_stack WHERE id=stack_a RETURNING id INTO returned_id;
    GET DIAGNOSTICS affected = ROW_COUNT;

    -- Check 153: Deleting own supplement cascades its log rows
    IF (affected=1 AND returned_id=stack_a AND NOT EXISTS (SELECT 1 FROM public.supplement_log WHERE supplement_id=stack_a)) IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'FitDataKit check 153: Deleting own supplement cascades its log rows';
    END IF;
    checks := checks + 1;

    IF checks <> expected_before_rollback THEN
      RAISE EXCEPTION 'Incomplete FitDataKit check count: got %, expected %', checks, expected_before_rollback;
    END IF;
    rollback_requested := true;
    RAISE SQLSTATE 'ZX001' USING MESSAGE='FitDataKit successful fixture rollback';
  EXCEPTION WHEN SQLSTATE 'ZX001' THEN
    GET STACKED DIAGNOSTICS caught_message = MESSAGE_TEXT;
    IF NOT rollback_requested OR checks <> expected_before_rollback
       OR caught_message <> 'FitDataKit successful fixture rollback' THEN
      RAISE;
    END IF;
  END;

  -- The exception subtransaction reverted fixture users/rows, role and claims.
  -- Local PL/pgSQL counters/diagnostic values intentionally survive it.
  IF EXISTS (SELECT 1 FROM auth.users WHERE id IN (client_a,client_b)) THEN
    RAISE EXCEPTION 'FitDataKit rollback left a synthetic auth user';
  END IF;
  checks := checks + 1;

  IF EXISTS (SELECT 1 FROM public.profiles WHERE id IN (client_a,client_b))
     OR EXISTS (SELECT 1 FROM public.food_log WHERE user_id IN (client_a,client_b))
     OR EXISTS (SELECT 1 FROM public.custom_foods WHERE user_id IN (client_a,client_b))
     OR EXISTS (SELECT 1 FROM public.workout_sessions WHERE user_id IN (client_a,client_b))
     OR EXISTS (SELECT 1 FROM public.workout_plans WHERE user_id IN (client_a,client_b))
     OR EXISTS (SELECT 1 FROM public.supplement_stack WHERE user_id IN (client_a,client_b))
     OR EXISTS (SELECT 1 FROM public.supplement_log WHERE user_id IN (client_a,client_b))
     OR EXISTS (SELECT 1 FROM public.water_log WHERE user_id IN (client_a,client_b))
     OR EXISTS (SELECT 1 FROM public.body_weight_log WHERE user_id IN (client_a,client_b))
     OR EXISTS (SELECT 1 FROM public.ai_coach_usage WHERE user_id IN (client_a,client_b))
     OR EXISTS (SELECT 1 FROM public.workouts WHERE user_id IN (client_a,client_b)) THEN
    RAISE EXCEPTION 'FitDataKit rollback left a synthetic base-table row';
  END IF;
  checks := checks + 1;

  IF EXISTS (SELECT 1 FROM public.exercise_bests WHERE user_id IN (client_a,client_b))
     OR EXISTS (SELECT 1 FROM public.exercise_pr_events WHERE user_id IN (client_a,client_b))
     OR EXISTS (SELECT 1 FROM public.daily_summary WHERE user_id IN (client_a,client_b))
     OR EXISTS (SELECT 1 FROM public.supplement_due_from WHERE user_id IN (client_a,client_b))
     OR EXISTS (SELECT 1 FROM public.weight_monthly WHERE user_id IN (client_a,client_b)) THEN
    RAISE EXCEPTION 'FitDataKit rollback left a synthetic view result';
  END IF;
  checks := checks + 1;

  IF checks <> expected_final OR parent_owner_enforced IS NULL THEN
    RAISE EXCEPTION 'FitDataKit final evidence incomplete: checks %, expected %', checks, expected_final;
  END IF;
  PERFORM set_config('fitdatakit.contract_checks',checks::text,true);
  PERFORM set_config('fitdatakit.expected_contract_checks',expected_final::text,true);
  PERFORM set_config('fitdatakit.parent_owner_enforced',parent_owner_enforced::text,true);
END
$fitdatakit_contract$;

SELECT
  'passed' AS asserted_contract_result,
  current_setting('fitdatakit.contract_checks')::integer AS assertions,
  current_setting('fitdatakit.expected_contract_checks')::integer AS expected_assertions,
  current_setting('fitdatakit.parent_owner_enforced')::boolean AS supplement_parent_owner_enforced,
  'Supplement parent ownership is diagnostic only; false is an unresolved finding, not an isolation pass' AS diagnostic_scope,
  'All synthetic auth users and WiFit rows rolled back; no existing data intentionally modified' AS cleanup,
  'PostgreSQL role/claim simulation only; not JWT/PostgREST/Swift end-to-end verification' AS verification_scope;
