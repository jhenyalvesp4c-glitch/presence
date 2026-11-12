-- Orion (segundo cérebro): anotações livres "documentadas" pela usuária, com data e etiquetas de dossiê.
-- A pesquisa do Orion também lê o que já existe nas demais tabelas (demandas, tarefas, notas, conversa da assistente).
create table presence_app.brain_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default '00000000-0000-0000-0000-000000000001',
  text text not null check (char_length(text) between 1 and 6000),
  entry_date date not null default current_date,
  project_id text null,
  dossier_names text[] not null default '{}',
  source text not null default 'orion' check (source in ('orion','assistente')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index brain_entries_user_date_idx on presence_app.brain_entries (user_id, entry_date desc, created_at desc);
create trigger brain_entries_set_updated_at before update on presence_app.brain_entries
  for each row execute function presence_app.set_updated_at();

alter table presence_app.brain_entries enable row level security;
grant select, insert, update, delete on presence_app.brain_entries to anon, authenticated, service_role;
create policy "sem login: dono fixo" on presence_app.brain_entries for all to anon
  using (user_id = '00000000-0000-0000-0000-000000000001')
  with check (user_id = '00000000-0000-0000-0000-000000000001');
create policy "dono: linhas próprias" on presence_app.brain_entries for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
