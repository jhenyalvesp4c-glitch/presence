-- Planejamento inteligente v2: fontes reais ligáveis, rotina editável, duração dos blocos, aprendizado (eventos e sugestões).
alter table presence_app.routine_items add column if not exists duration_min integer not null default 30 check (duration_min between 5 and 720);
alter table presence_app.routine_items add column if not exists weekdays smallint[] not null default '{0,1,2,3,4,5,6}';
alter table presence_app.routine_items add column if not exists active boolean not null default true;
alter table presence_app.schedule_items add column if not exists duration_min integer not null default 30 check (duration_min between 5 and 720);
alter table presence_app.schedule_items add column if not exists source text not null default 'rotina';
alter table presence_app.schedule_items add column if not exists source_ref text;

create table if not exists presence_app.plan_settings (
  user_id uuid primary key default presence_app.owner_id(),
  sources jsonb not null default '{"calendario":true,"tarefas":true,"habitos":true,"saude":true,"financeiro":true,"demandas":true,"rotina":true}'::jsonb,
  day_start text not null default '07:00',
  day_end text not null default '22:00',
  travel_min integer not null default 30 check (travel_min between 0 and 240),
  learn boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists presence_app.plan_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default presence_app.owner_id(),
  plan_date date not null,
  action text not null check (action in ('feito','desfeito','adiado','removido','adicionado','movido','editado')),
  kind text not null default 'extra',
  title text not null,
  planned_time text,
  at_time text,
  extra jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists plan_events_user_idx on presence_app.plan_events (user_id, created_at desc);

create table if not exists presence_app.plan_suggestions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default presence_app.owner_id(),
  key text not null,
  kind text not null,
  title text not null,
  detail text not null default '',
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'nova' check (status in ('nova','aceita','ignorada')),
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  unique (user_id, key)
);

do $$ declare t text; begin
  foreach t in array array['plan_settings','plan_events','plan_suggestions'] loop
    execute format('alter table presence_app.%I enable row level security', t);
    execute format('drop policy if exists "dono: linhas próprias" on presence_app.%I', t);
    execute format('create policy "dono: linhas próprias" on presence_app.%I for all to authenticated using (user_id = (select presence_app.owner_id())) with check (user_id = (select presence_app.owner_id()))', t);
    execute format('revoke all on presence_app.%I from anon', t);
    execute format('grant select, insert, update, delete on presence_app.%I to authenticated', t);
  end loop;
end $$;
