-- Projetos, dossiês, notas e demandas (Kanban) da página de Demandas. Tudo em presence_app.
-- Modo sem login: dono fixo 00000000-0000-0000-0000-000000000001 (mesmo padrão das outras tabelas).
--
-- Escolhas de modelagem:
--  * `projects.id` é texto: o projeto padrão da página de Demandas é "p4c" e os outros ids vêm do app.
--  * Dossiês de uma demanda ficam guardados pelo NOME (a tela usa o nome como chave), então renomear
--    ou excluir um dossiê é refletido nas demandas pelo próprio app. Notas e compromissos usam o id.
--  * `demands` já existe (demandas que a assistente registra); o Kanban usa `project_demands`.
--  * Excluir um projeto apaga junto dossiês, notas e demandas (cascade). Compromissos do calendário
--    são `tasks` (project_id texto) e são apagados pelo app.

create table presence_app.projects (
  id text primary key check (char_length(id) between 1 and 80),
  user_id uuid not null default '00000000-0000-0000-0000-000000000001',
  name text not null check (char_length(name) between 1 and 120),
  description text not null default '' check (char_length(description) <= 500),
  color text not null default 'cyan' check (color in ('cyan','violet','emerald','amber','rose')),
  status text not null default 'Planejando' check (status in ('Ativo','Planejando','Pausado')),
  due date,
  label_singular text not null default 'Dossiê' check (char_length(label_singular) between 1 and 40),
  label_plural text not null default 'Dossiês' check (char_length(label_plural) between 1 and 40),
  -- Já levou para cá o que estava só no navegador (dossiês e notas antigos)? Só acontece uma vez.
  legacy_imported boolean not null default false,
  position int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table presence_app.dossiers (
  project_id text not null references presence_app.projects (id) on delete cascade,
  id text not null check (char_length(id) between 1 and 80),
  user_id uuid not null default '00000000-0000-0000-0000-000000000001',
  name text not null check (char_length(name) between 1 and 120),
  description text not null default '' check (char_length(description) <= 500),
  position int not null default 0,
  created_at timestamptz not null default now(),
  primary key (project_id, id)
);
create unique index dossiers_name_unique on presence_app.dossiers (project_id, lower(name));

create table presence_app.project_notes (
  id bigint primary key,
  user_id uuid not null default '00000000-0000-0000-0000-000000000001',
  project_id text not null references presence_app.projects (id) on delete cascade,
  text text not null default '' check (char_length(text) <= 5000),
  color text not null default 'violet' check (color in ('cyan','violet','emerald','amber','pink')),
  dossier_id text,
  date_label text not null default '',
  position int not null default 0,
  created_at timestamptz not null default now()
);
create index project_notes_project_idx on presence_app.project_notes (project_id, position);

create table presence_app.project_demands (
  project_id text not null references presence_app.projects (id) on delete cascade,
  code text not null check (char_length(code) between 2 and 20),
  user_id uuid not null default '00000000-0000-0000-0000-000000000001',
  type text not null check (type in ('geral','polo','multi')),
  title text not null check (char_length(title) between 1 and 300),
  description text not null default '' check (char_length(description) <= 5000),
  priority text not null default 'media' check (priority in ('alta','media','baixa')),
  status text not null default 'todo' check (status in ('todo','doing','done')),
  deadline text not null default '' check (char_length(deadline) <= 20),
  dossier_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (project_id, code)
);
create index project_demands_idx on presence_app.project_demands (project_id, created_at desc);

-- Andamento de cada dossiê dentro de uma demanda para vários.
create table presence_app.demand_executions (
  project_id text not null,
  code text not null,
  dossier_name text not null check (char_length(dossier_name) between 1 and 120),
  user_id uuid not null default '00000000-0000-0000-0000-000000000001',
  status text not null default 'todo' check (status in ('todo','doing','done')),
  done_on text,
  note text not null default '' check (char_length(note) <= 2000),
  position int not null default 0,
  primary key (project_id, code, dossier_name),
  foreign key (project_id, code) references presence_app.project_demands (project_id, code) on delete cascade
);

create table presence_app.demand_history (
  id bigint generated always as identity primary key,
  user_id uuid not null default '00000000-0000-0000-0000-000000000001',
  project_id text not null,
  code text not null,
  label text not null default '' check (char_length(label) <= 20),
  text text not null check (char_length(text) <= 500),
  status text not null default 'todo' check (status in ('todo','doing','done')),
  position int not null default 0,
  foreign key (project_id, code) references presence_app.project_demands (project_id, code) on delete cascade
);
create index demand_history_idx on presence_app.demand_history (project_id, code, position);

create table presence_app.demand_notes (
  id bigint generated always as identity primary key,
  user_id uuid not null default '00000000-0000-0000-0000-000000000001',
  project_id text not null,
  code text not null,
  text text not null check (char_length(text) <= 2000),
  position int not null default 0,
  foreign key (project_id, code) references presence_app.project_demands (project_id, code) on delete cascade
);
create index demand_notes_idx on presence_app.demand_notes (project_id, code, position);

create trigger projects_set_updated_at before update on presence_app.projects
  for each row execute function presence_app.set_updated_at();
create trigger project_demands_set_updated_at before update on presence_app.project_demands
  for each row execute function presence_app.set_updated_at();

do $$
declare
  t text;
begin
  foreach t in array array['projects','dossiers','project_notes','project_demands','demand_executions','demand_history','demand_notes'] loop
    execute format('alter table presence_app.%I enable row level security', t);
    execute format('grant select, insert, update, delete on presence_app.%I to anon, authenticated, service_role', t);
    execute format($p$create policy "sem login: dono fixo" on presence_app.%I for all to anon
      using (user_id = '00000000-0000-0000-0000-000000000001')
      with check (user_id = '00000000-0000-0000-0000-000000000001')$p$, t);
    execute format($p$create policy "dono: linhas próprias" on presence_app.%I for all to authenticated
      using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)$p$, t);
  end loop;
end $$;
