-- Saúde: fichas de treino, dieta e medidas (com fotos).
-- Tudo em presence_app. Modo sem login: dono fixo 00000000-0000-0000-0000-000000000001.
--
-- A ficha de treino é UNIFICADA com o /treino: cada "sessão" da ficha (Treino A, B...) é uma linha de
-- `workouts` (com `sheet_id` e `days`), seus exercícios são `workout_exercises`, e os dias da semana
-- alimentam `workout_split`. Assim /treino, /hoje e o assistente enxergam os mesmos dados.

-- ───────────── Ficha de treino ─────────────
create table presence_app.workout_sheets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default '00000000-0000-0000-0000-000000000001',
  name text not null check (char_length(name) between 1 and 120),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index workout_sheets_one_active on presence_app.workout_sheets (user_id) where active;

alter table presence_app.workouts
  add column sheet_id uuid references presence_app.workout_sheets (id) on delete set null,
  add column days text[] not null default '{}'
    check (days <@ array['dom','seg','ter','qua','qui','sex','sáb']::text[]);
create index workouts_sheet_idx on presence_app.workouts (sheet_id, position);

-- ───────────── Ficha de dieta ─────────────
create table presence_app.diet_sheets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default '00000000-0000-0000-0000-000000000001',
  name text not null default '' check (char_length(name) <= 120),
  goal text not null default '' check (char_length(goal) <= 80),
  calories numeric(7,1) check (calories between 0 and 20000),
  protein numeric(6,1) check (protein between 0 and 2000),
  carbs numeric(6,1) check (carbs between 0 and 2000),
  fat numeric(6,1) check (fat between 0 and 2000),
  notes text not null default '' check (char_length(notes) <= 5000),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index diet_sheets_one_active on presence_app.diet_sheets (user_id) where active;

create table presence_app.diet_meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default '00000000-0000-0000-0000-000000000001',
  sheet_id uuid not null references presence_app.diet_sheets (id) on delete cascade,
  position int not null default 0,
  name text not null default '' check (char_length(name) <= 120),
  meal_time text not null default '' check (char_length(meal_time) <= 5),
  foods text[] not null default '{}',
  created_at timestamptz not null default now()
);
create index diet_meals_sheet_idx on presence_app.diet_meals (sheet_id, position);

-- Refeição marcada como feita em um dia.
create table presence_app.diet_meal_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default '00000000-0000-0000-0000-000000000001',
  meal_id uuid not null references presence_app.diet_meals (id) on delete cascade,
  log_date date not null,
  created_at timestamptz not null default now(),
  unique (meal_id, log_date)
);

-- ───────────── Peso e medidas ─────────────
-- Um registro por data (salvar de novo no mesmo dia substitui). `photos` guarda o caminho de cada foto
-- no bucket privado presence-app-photos, por posição (Frente, Lado, Costas, Outras fotos).
create table presence_app.body_measurements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default '00000000-0000-0000-0000-000000000001',
  name text not null default '' check (char_length(name) <= 120),
  measured_on date not null,
  height_m numeric(4,2) check (height_m between 0.3 and 3),
  weight_kg numeric(5,2) check (weight_kg between 1 and 700),
  "values" jsonb not null default '{}',
  notes text not null default '' check (char_length(notes) <= 5000),
  photos jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, measured_on)
);
create index body_measurements_date_idx on presence_app.body_measurements (user_id, measured_on desc);

create trigger workout_sheets_set_updated_at before update on presence_app.workout_sheets
  for each row execute function presence_app.set_updated_at();
create trigger diet_sheets_set_updated_at before update on presence_app.diet_sheets
  for each row execute function presence_app.set_updated_at();
create trigger body_measurements_set_updated_at before update on presence_app.body_measurements
  for each row execute function presence_app.set_updated_at();

-- ───────────── RLS (mesmo padrão das outras tabelas) ─────────────
do $$
declare
  t text;
begin
  foreach t in array array['workout_sheets','diet_sheets','diet_meals','diet_meal_logs','body_measurements'] loop
    execute format('alter table presence_app.%I enable row level security', t);
    execute format('grant select, insert, update, delete on presence_app.%I to anon, authenticated, service_role', t);
    execute format($p$create policy "sem login: dono fixo" on presence_app.%I for all to anon
      using (user_id = '00000000-0000-0000-0000-000000000001')
      with check (user_id = '00000000-0000-0000-0000-000000000001')$p$, t);
    execute format($p$create policy "dono: linhas próprias" on presence_app.%I for all to authenticated
      using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)$p$, t);
  end loop;
end $$;

-- ───────────── Fotos: bucket privado no Storage ─────────────
-- O Storage é do projeto inteiro (o assistente virtual também usa). As policies abaixo valem SOMENTE para
-- o bucket presence-app-photos e, no modo sem login, SOMENTE para a pasta do dono fixo.
-- Para voltar ao modo com login: apagar as policies "presence-app-photos: sem login ..." e manter as
-- "... dono" (pasta = auth.uid()).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('presence-app-photos', 'presence-app-photos', false, 8388608,
        array['image/jpeg','image/png','image/webp','image/heic','image/heif'])
on conflict (id) do nothing;

create policy "presence-app-photos: sem login ler" on storage.objects for select to anon
  using (bucket_id = 'presence-app-photos' and (storage.foldername(name))[1] = '00000000-0000-0000-0000-000000000001');
create policy "presence-app-photos: sem login enviar" on storage.objects for insert to anon
  with check (bucket_id = 'presence-app-photos' and (storage.foldername(name))[1] = '00000000-0000-0000-0000-000000000001');
create policy "presence-app-photos: sem login trocar" on storage.objects for update to anon
  using (bucket_id = 'presence-app-photos' and (storage.foldername(name))[1] = '00000000-0000-0000-0000-000000000001')
  with check (bucket_id = 'presence-app-photos' and (storage.foldername(name))[1] = '00000000-0000-0000-0000-000000000001');
create policy "presence-app-photos: sem login apagar" on storage.objects for delete to anon
  using (bucket_id = 'presence-app-photos' and (storage.foldername(name))[1] = '00000000-0000-0000-0000-000000000001');

create policy "presence-app-photos: dono" on storage.objects for all to authenticated
  using (bucket_id = 'presence-app-photos' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'presence-app-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
