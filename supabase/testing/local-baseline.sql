create role anon; create role authenticated; create role service_role bypassrls;
create schema auth; create schema storage; create schema realtime;
create table auth.users(id uuid primary key, aud text, role text, email text, email_confirmed_at timestamptz, is_anonymous boolean default false, banned_until timestamptz); create table auth.sessions(id uuid primary key,user_id uuid references auth.users(id),not_after timestamptz);
create function auth.uid() returns uuid language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claim.sub',true),''),nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid $$; create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$; grant usage on schema auth to anon,authenticated,service_role; grant execute on all functions in schema auth to anon,authenticated,service_role;
create table public.profiles("id" uuid not null,"name" text,"age" integer,"weight_lbs" numeric,"height_in" numeric,"activity_level" text default 'moderate'::text,"goal" text default 'maintain'::text,"cal_goal" integer default 2200,"protein_goal" integer default 140,"carbs_goal" integer default 180,"fat_goal" integer default 78,"theme" text default 'dark'::text,"created_at" timestamp with time zone default now(),"updated_at" timestamp with time zone default now(),"gender" text,"bmr" numeric,"tdee" numeric,"goal_rate" text);
alter table public.profiles enable row level security;
create table public.food_log("id" uuid default gen_random_uuid() not null,"user_id" uuid not null,"logged_date" date default CURRENT_DATE not null,"meal_slot" text not null,"food_name" text not null,"brand" text,"grams" numeric not null,"per100_cal" numeric default 0,"per100_protein" numeric default 0,"per100_carbs" numeric default 0,"per100_fat" numeric default 0,"per100_fiber" numeric default 0,"per100_sodium" numeric default 0,"color" text,"created_at" timestamp with time zone default now(),"per100_sugar" numeric);
alter table public.food_log enable row level security;
create table public.custom_foods("id" uuid default gen_random_uuid() not null,"user_id" uuid not null,"name" text not null,"brand" text,"serving_g" numeric,"per100_cal" numeric default 0,"per100_protein" numeric default 0,"per100_carbs" numeric default 0,"per100_fat" numeric default 0,"per100_fiber" numeric default 0,"per100_sugar" numeric default 0,"per100_sodium" numeric default 0,"created_at" timestamp with time zone default now(),"serving_qty" numeric,"serving_unit" text);
alter table public.custom_foods enable row level security;
create table public.workouts("id" uuid default gen_random_uuid() not null,"user_id" uuid not null,"name" text not null,"tag" text,"level" text,"est_min" integer,"exercises" jsonb default '[]'::jsonb,"created_at" timestamp with time zone default now(),"updated_at" timestamp with time zone default now());
alter table public.workouts enable row level security;
create table public.workout_sessions("id" uuid default gen_random_uuid() not null,"user_id" uuid not null,"workout_name" text not null,"completed_date" date default CURRENT_DATE not null,"duration_secs" integer default 0,"sets_completed" integer default 0,"total_sets" integer default 0,"exercises" jsonb default '[]'::jsonb,"created_at" timestamp with time zone default now(),"prs" jsonb default '[]'::jsonb not null);
alter table public.workout_sessions enable row level security;
create table public.supplement_stack("id" uuid default gen_random_uuid() not null,"user_id" uuid not null,"name" text not null,"sub" text,"dot_color" text default '#888888'::text,"reminder_time" text,"reminder_enabled" boolean default false,"sort_order" integer default 0,"created_at" timestamp with time zone default now(),"category" text,"note" text);
alter table public.supplement_stack enable row level security;
create table public.supplement_log("id" uuid default gen_random_uuid() not null,"user_id" uuid not null,"supplement_id" uuid not null,"log_date" date default CURRENT_DATE not null,"taken" boolean default false,"created_at" timestamp with time zone default now());
alter table public.supplement_log enable row level security;
create table public.body_weight_log("id" uuid default gen_random_uuid() not null,"user_id" uuid not null,"weight_lbs" numeric not null,"log_date" date default CURRENT_DATE not null,"note" text,"created_at" timestamp with time zone default now());
alter table public.body_weight_log enable row level security;
create table public.water_log("id" uuid default gen_random_uuid() not null,"user_id" uuid not null,"log_date" date default CURRENT_DATE not null,"cups" integer default 0,"created_at" timestamp with time zone default now(),"oz" integer default 0 not null);
alter table public.water_log enable row level security;
create table public.workout_plans("id" uuid default gen_random_uuid() not null,"user_id" uuid not null,"name" text not null,"tag" text,"level" text,"est_min" integer,"scheduled_day" text,"exercises" jsonb default '[]'::jsonb not null,"sort_order" integer default 0,"created_at" timestamp with time zone default now());
alter table public.workout_plans enable row level security;
create table public.coach_usage("id" uuid default gen_random_uuid() not null,"user_id" uuid not null,"created_at" timestamp with time zone default now() not null);
alter table public.coach_usage enable row level security;
alter table public."body_weight_log" add constraint "body_weight_log_pkey" PRIMARY KEY (id);
alter table public."body_weight_log" add constraint "body_weight_log_user_id_log_date_key" UNIQUE (user_id, log_date);
alter table public."coach_usage" add constraint "coach_usage_pkey" PRIMARY KEY (id);
alter table public."custom_foods" add constraint "custom_foods_pkey" PRIMARY KEY (id);
alter table public."food_log" add constraint "food_log_pkey" PRIMARY KEY (id);
alter table public."profiles" add constraint "profiles_pkey" PRIMARY KEY (id);
alter table public."supplement_log" add constraint "supplement_log_pkey" PRIMARY KEY (id);
alter table public."supplement_log" add constraint "supplement_log_supplement_id_log_date_key" UNIQUE (supplement_id, log_date);
alter table public."supplement_stack" add constraint "supplement_stack_pkey" PRIMARY KEY (id);
alter table public."water_log" add constraint "water_log_pkey" PRIMARY KEY (id);
alter table public."water_log" add constraint "water_log_user_id_log_date_key" UNIQUE (user_id, log_date);
alter table public."workout_plans" add constraint "workout_plans_pkey" PRIMARY KEY (id);
alter table public."workout_sessions" add constraint "workout_sessions_pkey" PRIMARY KEY (id);
alter table public."workouts" add constraint "workouts_pkey" PRIMARY KEY (id);
alter table public."body_weight_log" add constraint "body_weight_log_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public."coach_usage" add constraint "coach_usage_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public."custom_foods" add constraint "custom_foods_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public."food_log" add constraint "food_log_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public."profiles" add constraint "profiles_id_fkey" FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public."supplement_log" add constraint "supplement_log_supplement_id_fkey" FOREIGN KEY (supplement_id) REFERENCES supplement_stack(id) ON DELETE CASCADE;
alter table public."supplement_log" add constraint "supplement_log_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public."supplement_stack" add constraint "supplement_stack_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public."water_log" add constraint "water_log_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public."workout_plans" add constraint "workout_plans_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public."workout_sessions" add constraint "workout_sessions_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public."workouts" add constraint "workouts_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
create policy "Users can manage their own weight log" on public."body_weight_log" for ALL to public using((auth.uid() = user_id)) with check((auth.uid() = user_id));
create policy "coach_usage_insert_own" on public."coach_usage" for INSERT to authenticated with check((auth.uid() = user_id));
create policy "coach_usage_select_own" on public."coach_usage" for SELECT to authenticated using((auth.uid() = user_id));
create policy "Users can manage their own custom foods" on public."custom_foods" for ALL to public using((auth.uid() = user_id)) with check((auth.uid() = user_id));
create policy "Users can manage their own food log" on public."food_log" for ALL to public using((auth.uid() = user_id)) with check((auth.uid() = user_id));
create policy "Users can manage their own profile" on public."profiles" for ALL to public using((auth.uid() = id)) with check((auth.uid() = id));
create policy "Users can manage their own supplement log" on public."supplement_log" for ALL to public using((auth.uid() = user_id)) with check((auth.uid() = user_id));
create policy "Users can manage their own supplement stack" on public."supplement_stack" for ALL to public using((auth.uid() = user_id)) with check((auth.uid() = user_id));
create policy "Users can manage their own water log" on public."water_log" for ALL to public using((auth.uid() = user_id)) with check((auth.uid() = user_id));
create policy "users manage own plans" on public."workout_plans" for ALL to public using((auth.uid() = user_id)) with check((auth.uid() = user_id));
create policy "Users can manage their own workout sessions" on public."workout_sessions" for ALL to public using((auth.uid() = user_id)) with check((auth.uid() = user_id));
create policy "Users can manage their own workouts" on public."workouts" for ALL to public using((auth.uid() = user_id)) with check((auth.uid() = user_id));
grant all on all tables in schema public to anon,authenticated,service_role;
create view public."supplement_due_from" with(security_invoker=true) as  SELECT s.user_id,
    s.id AS supplement_id,
    s.name,
    LEAST(s.created_at::date, min(l.log_date)) AS due_from
   FROM supplement_stack s
     LEFT JOIN supplement_log l ON l.supplement_id = s.id
  GROUP BY s.user_id, s.id, s.name, s.created_at; grant select on public."supplement_due_from" to authenticated;
create view public."daily_summary" with(security_invoker=true) as  WITH food AS (
         SELECT food_log.user_id,
            food_log.logged_date AS day,
            sum(round(COALESCE(food_log.per100_cal, 0::numeric) * COALESCE(food_log.grams, 0::numeric) / 100::numeric)) AS kcal,
            sum(round(COALESCE(food_log.per100_protein, 0::numeric) * COALESCE(food_log.grams, 0::numeric) / 100::numeric)) AS protein_g,
            sum(round(COALESCE(food_log.per100_carbs, 0::numeric) * COALESCE(food_log.grams, 0::numeric) / 100::numeric)) AS carbs_g,
            sum(round(COALESCE(food_log.per100_fat, 0::numeric) * COALESCE(food_log.grams, 0::numeric) / 100::numeric)) AS fat_g,
            count(*) AS food_rows
           FROM food_log
          GROUP BY food_log.user_id, food_log.logged_date
        ), workouts AS (
         SELECT workout_sessions.user_id,
            workout_sessions.completed_date AS day,
            count(*) AS workout_count,
            string_agg(COALESCE(workout_sessions.workout_name, ''::text), ', '::text ORDER BY workout_sessions.created_at) AS workout_names
           FROM workout_sessions
          GROUP BY workout_sessions.user_id, workout_sessions.completed_date
        ), supps AS (
         SELECT supplement_log.user_id,
            supplement_log.log_date AS day,
            count(*) FILTER (WHERE supplement_log.taken) AS supps_taken
           FROM supplement_log
          GROUP BY supplement_log.user_id, supplement_log.log_date
        ), weight AS (
         SELECT body_weight_log.user_id,
            body_weight_log.log_date AS day,
            body_weight_log.weight_lbs
           FROM body_weight_log
        ), days AS (
         SELECT food.user_id,
            food.day
           FROM food
        UNION
         SELECT workouts.user_id,
            workouts.day
           FROM workouts
        UNION
         SELECT supps.user_id,
            supps.day
           FROM supps
        UNION
         SELECT weight.user_id,
            weight.day
           FROM weight
        )
 SELECT d.user_id,
    d.day,
    COALESCE(f.kcal, 0::numeric)::integer AS kcal,
    COALESCE(f.protein_g, 0::numeric)::integer AS protein_g,
    COALESCE(f.carbs_g, 0::numeric)::integer AS carbs_g,
    COALESCE(f.fat_g, 0::numeric)::integer AS fat_g,
    COALESCE(f.food_rows, 0::bigint)::integer AS food_rows,
    COALESCE(w.workout_count, 0::bigint)::integer AS workout_count,
    w.workout_names,
    COALESCE(s.supps_taken, 0::bigint)::integer AS supps_taken,
    (( SELECT count(*) AS count
           FROM supplement_due_from df
          WHERE df.user_id = d.user_id AND df.due_from <= d.day))::integer AS supps_due,
    wt.weight_lbs
   FROM days d
     LEFT JOIN food f ON f.user_id = d.user_id AND f.day = d.day
     LEFT JOIN workouts w ON w.user_id = d.user_id AND w.day = d.day
     LEFT JOIN supps s ON s.user_id = d.user_id AND s.day = d.day
     LEFT JOIN weight wt ON wt.user_id = d.user_id AND wt.day = d.day; grant select on public."daily_summary" to authenticated;
create view public."weight_monthly" with(security_invoker=true) as  SELECT user_id,
    to_char(log_date::timestamp with time zone, 'YYYY-MM'::text) AS month,
    (array_agg(weight_lbs ORDER BY log_date))[1] AS first_lbs,
    (array_agg(weight_lbs ORDER BY log_date DESC))[1] AS last_lbs,
    count(*)::integer AS entries
   FROM body_weight_log
  GROUP BY user_id, (to_char(log_date::timestamp with time zone, 'YYYY-MM'::text)); grant select on public."weight_monthly" to authenticated;
create view public."exercise_bests" with(security_invoker=true) as  SELECT w.user_id,
    e.value ->> 'name'::text AS name,
    max((s.value ->> 'weight'::text)::numeric) AS best_lbs
   FROM workout_sessions w,
    LATERAL jsonb_array_elements(w.exercises) e(value),
    LATERAL jsonb_array_elements(COALESCE(e.value -> 'setsData'::text, '[]'::jsonb)) s(value)
  WHERE ((s.value ->> 'weight'::text)::numeric) > 0::numeric
  GROUP BY w.user_id, (e.value ->> 'name'::text); grant select on public."exercise_bests" to authenticated;
create view public."exercise_pr_events" with(security_invoker=true) as  WITH lifts AS (
         SELECT w.user_id,
            w.id AS session_id,
            w.completed_date,
            w.created_at,
            e.value ->> 'name'::text AS name,
            max((s.value ->> 'weight'::text)::numeric) AS top_lbs
           FROM workout_sessions w,
            LATERAL jsonb_array_elements(w.exercises) e(value),
            LATERAL jsonb_array_elements(COALESCE(e.value -> 'setsData'::text, '[]'::jsonb)) s(value)
          WHERE jsonb_typeof(w.exercises) = 'array'::text AND ((s.value ->> 'weight'::text)::numeric) > 0::numeric
          GROUP BY w.user_id, w.id, w.completed_date, w.created_at, (e.value ->> 'name'::text)
        ), ranked AS (
         SELECT lifts.user_id,
            lifts.session_id,
            lifts.completed_date,
            lifts.created_at,
            lifts.name,
            lifts.top_lbs,
            max(lifts.top_lbs) OVER (PARTITION BY lifts.user_id, lifts.name ORDER BY lifts.completed_date, lifts.created_at, lifts.session_id ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING) AS prev_best
           FROM lifts
        )
 SELECT user_id,
    session_id,
    completed_date,
    name,
    top_lbs AS lbs,
    prev_best
   FROM ranked
  WHERE prev_best IS NOT NULL AND top_lbs > prev_best; grant select on public."exercise_pr_events" to authenticated;
