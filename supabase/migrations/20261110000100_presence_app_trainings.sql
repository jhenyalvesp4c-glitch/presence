-- Treinamentos (aba "Treinamentos" dentro da Documentação da página de Demandas).
--  * training_sessions: cada turma é um compromisso do calendário (tasks, categoria Compromissos)
--    mais esta linha com os dados da turma (nome, pessoas, roteiro, observações).
--  * training_scripts: roteiros de treinamento de cada projeto. O conteúdo (blocos, itens, exemplos,
--    imagens por chave) fica num JSON por roteiro, porque a tela edita o roteiro inteiro de uma vez.
--  * projects.training_seeded: os 3 roteiros de exemplo entram uma única vez por projeto.
alter table presence_app.projects add column if not exists training_seeded boolean not null default false;

create table presence_app.training_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default '00000000-0000-0000-0000-000000000001',
  task_id uuid not null unique references presence_app.tasks (id) on delete cascade,
  group_name text not null check (char_length(group_name) between 1 and 120),
  people integer not null default 0 check (people between 0 and 1000),
  script_key text not null default '' check (char_length(script_key) <= 60),
  script_title text not null default '' check (char_length(script_title) <= 200),
  notes text not null default '' check (char_length(notes) <= 1500),
  created_at timestamptz not null default now()
);
create index training_sessions_user_idx on presence_app.training_sessions (user_id);

create table presence_app.training_scripts (
  project_id text not null references presence_app.projects (id) on delete cascade,
  id text not null check (char_length(id) between 1 and 80),
  user_id uuid not null default '00000000-0000-0000-0000-000000000001',
  data jsonb not null,
  position int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (project_id, id)
);
create trigger training_scripts_set_updated_at before update on presence_app.training_scripts
  for each row execute function presence_app.set_updated_at();

do $$
declare
  t text;
begin
  foreach t in array array['training_sessions','training_scripts'] loop
    execute format('alter table presence_app.%I enable row level security', t);
    execute format('grant select, insert, update, delete on presence_app.%I to anon, authenticated, service_role', t);
    execute format($p$create policy "sem login: dono fixo" on presence_app.%I for all to anon
      using (user_id = '00000000-0000-0000-0000-000000000001')
      with check (user_id = '00000000-0000-0000-0000-000000000001')$p$, t);
    execute format($p$create policy "dono: linhas próprias" on presence_app.%I for all to authenticated
      using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)$p$, t);
  end loop;
end $$;
