-- Plano alimentar (ex.: ficha de recomposição): o plano inteiro como documento, o registro diário (refeições, água, como foi o dia) e o acompanhamento semanal.
-- Dado pessoal: só o dono vê; sem acesso para `anon`.
create table if not exists presence_app.diet_plans (
  id uuid primary key default gen_random_uuid(), user_id uuid not null default presence_app.owner_id(),
  name text not null check (char_length(name) between 1 and 200), start_date date not null, active boolean not null default true,
  data jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists diet_plans_user_idx on presence_app.diet_plans (user_id, active, created_at desc);
create table if not exists presence_app.diet_day_logs (
  id uuid primary key default gen_random_uuid(), user_id uuid not null default presence_app.owner_id(),
  plan_id uuid not null references presence_app.diet_plans(id) on delete cascade, log_date date not null, option_id text,
  meals_done text[] not null default '{}', extra_protein_g numeric(6,1) check (extra_protein_g is null or extra_protein_g between 0 and 500),
  water_ml integer check (water_ml is null or water_ml between 0 and 20000),
  energy smallint check (energy is null or energy between 1 and 5), fullness smallint check (fullness is null or fullness between 1 and 5),
  difficulty smallint check (difficulty is null or difficulty between 1 and 5), training smallint check (training is null or training between 1 and 5),
  discomfort smallint check (discomfort is null or discomfort between 1 and 5), bowel boolean,
  notes text not null default '' check (char_length(notes) <= 2000), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (user_id, plan_id, log_date)
);
create table if not exists presence_app.diet_weekly (
  id uuid primary key default gen_random_uuid(), user_id uuid not null default presence_app.owner_id(),
  plan_id uuid not null references presence_app.diet_plans(id) on delete cascade, week_no smallint not null check (week_no between 1 and 104),
  logged_on date not null default (now() at time zone 'America/Sao_Paulo')::date,
  weight_kg numeric(5,1) check (weight_kg is null or weight_kg between 20 and 400), waist_cm numeric(5,1) check (waist_cm is null or waist_cm between 20 and 300),
  abdomen_cm numeric(5,1) check (abdomen_cm is null or abdomen_cm between 20 and 300), hip_cm numeric(5,1) check (hip_cm is null or hip_cm between 20 and 300),
  bowel_count smallint check (bowel_count is null or bowel_count between 0 and 60), water_l numeric(4,1) check (water_l is null or water_l between 0 and 20),
  energy smallint check (energy is null or energy between 1 and 5), training smallint check (training is null or training between 1 and 5),
  difficulty smallint check (difficulty is null or difficulty between 1 and 5), digestive smallint check (digestive is null or digestive between 1 and 5),
  satiety smallint check (satiety is null or satiety between 1 and 5), notes text not null default '' check (char_length(notes) <= 4000),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique (user_id, plan_id, week_no)
);
do $$ declare t text; begin
  foreach t in array array['diet_plans','diet_day_logs','diet_weekly'] loop
    execute format('alter table presence_app.%I enable row level security', t);
    execute format('drop policy if exists "dono: linhas próprias" on presence_app.%I', t);
    execute format('create policy "dono: linhas próprias" on presence_app.%I for all to authenticated using (user_id = (select presence_app.owner_id())) with check (user_id = (select presence_app.owner_id()))', t);
    execute format('revoke all on presence_app.%I from anon', t);
    execute format('grant select, insert, update, delete on presence_app.%I to authenticated', t);
  end loop;
end $$;

-- Trocas feitas no dia (por refeição/item) e alimentos extras com macros.
alter table presence_app.diet_day_logs add column if not exists swaps jsonb not null default '{}'::jsonb, add column if not exists extras jsonb not null default '[]'::jsonb;
