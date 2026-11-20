-- Programa de treino (ex.: recomposição de 12 semanas): o programa inteiro como documento, o registro série a série e a avaliação semanal.
-- Dado pessoal: só o dono vê; sem acesso para `anon`.
create table if not exists presence_app.training_programs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default presence_app.owner_id(),
  name text not null check (char_length(name) between 1 and 200),
  start_date date not null,
  active boolean not null default true,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists training_programs_user_idx on presence_app.training_programs (user_id, active, created_at desc);

create table if not exists presence_app.program_set_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default presence_app.owner_id(),
  program_id uuid not null references presence_app.training_programs(id) on delete cascade,
  exercise_id text not null,
  exercise_name text not null,
  session_date date not null,
  week_no smallint not null check (week_no between 1 and 60),
  set_no smallint not null check (set_no between 1 and 30),
  load_kg numeric(7,2) check (load_kg is null or load_kg between 0 and 1000),
  reps smallint check (reps is null or reps between 0 and 500),
  rir smallint check (rir is null or rir between 0 and 10),
  warmup boolean not null default false,
  flags text[] not null default '{}',
  created_at timestamptz not null default now(),
  unique (user_id, program_id, exercise_id, session_date, set_no, warmup)
);
create index if not exists program_set_logs_idx on presence_app.program_set_logs (user_id, program_id, session_date desc);

create table if not exists presence_app.program_weekly (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default presence_app.owner_id(),
  program_id uuid not null references presence_app.training_programs(id) on delete cascade,
  week_no smallint not null check (week_no between 1 and 60),
  logged_on date not null default (now() at time zone 'America/Sao_Paulo')::date,
  weight_kg numeric(5,1) check (weight_kg is null or weight_kg between 20 and 400),
  days_trained smallint check (days_trained is null or days_trained between 0 and 7),
  energy smallint check (energy is null or energy between 1 and 5),
  recovery smallint check (recovery is null or recovery between 1 and 5),
  notes text not null default '' check (char_length(notes) <= 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, program_id, week_no)
);

do $$ declare t text; begin
  foreach t in array array['training_programs','program_set_logs','program_weekly'] loop
    execute format('alter table presence_app.%I enable row level security', t);
    execute format('drop policy if exists "dono: linhas próprias" on presence_app.%I', t);
    execute format('create policy "dono: linhas próprias" on presence_app.%I for all to authenticated using (user_id = (select presence_app.owner_id())) with check (user_id = (select presence_app.owner_id()))', t);
    execute format('revoke all on presence_app.%I from anon', t);
    execute format('grant select, insert, update, delete on presence_app.%I to authenticated', t);
  end loop;
end $$;
