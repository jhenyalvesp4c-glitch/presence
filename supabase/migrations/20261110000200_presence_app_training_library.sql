-- Biblioteca de treinamentos de cada projeto: roteiros e banco de exemplos, editáveis pela tela
-- (Documentação → Treinamentos). Um documento por projeto, com os roteiros e os exemplos em JSON.
-- Substitui `training_scripts` (que guardava só os roteiros, um por linha): na primeira abertura de cada
-- projeto, o app converte o que estava lá para esta tabela. `training_scripts` fica sem uso.
create table presence_app.training_library (
  project_id text primary key references presence_app.projects (id) on delete cascade,
  user_id uuid not null default '00000000-0000-0000-0000-000000000001',
  scripts jsonb not null default '[]'::jsonb,
  examples jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table presence_app.training_library enable row level security;
grant select, insert, update, delete on presence_app.training_library to anon, authenticated, service_role;
create policy "sem login: dono fixo" on presence_app.training_library for all to anon
  using (user_id = '00000000-0000-0000-0000-000000000001')
  with check (user_id = '00000000-0000-0000-0000-000000000001');
create policy "dono: linhas próprias" on presence_app.training_library for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
