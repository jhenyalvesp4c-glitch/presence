-- Material de cada demanda do Kanban: corpo do texto, prints e arquivos (PDF, planilhas etc.).
--  * demand_materials: o texto (um por demanda).
--  * demand_files: um registro por arquivo (nome, tipo, tamanho, legenda e o caminho no Storage).
--  * Bucket privado presence-app-demand-files (até 25 MB por arquivo, qualquer tipo).
-- Sem chave estrangeira para project_demands de propósito: o app grava o material logo depois de criar
-- a demanda, em pedidos separados. Ao excluir uma demanda ou um projeto, o app apaga também as linhas
-- e os arquivos do Storage (lib/demand-materials.ts).
create table presence_app.demand_materials (
  project_id text not null,
  code text not null,
  user_id uuid not null default '00000000-0000-0000-0000-000000000001',
  body text not null default '' check (char_length(body) <= 50000),
  updated_at timestamptz not null default now(),
  primary key (project_id, code)
);

create table presence_app.demand_files (
  id text primary key check (char_length(id) between 1 and 80),
  user_id uuid not null default '00000000-0000-0000-0000-000000000001',
  project_id text not null,
  code text not null,
  name text not null check (char_length(name) between 1 and 300),
  mime_type text not null default 'application/octet-stream' check (char_length(mime_type) <= 200),
  size_bytes bigint not null default 0 check (size_bytes between 0 and 26214400),
  caption text not null default '' check (char_length(caption) <= 200),
  storage_path text not null check (char_length(storage_path) <= 600),
  added_at timestamptz not null default now()
);
create index demand_files_demand_idx on presence_app.demand_files (project_id, code, added_at);

create trigger demand_materials_set_updated_at before update on presence_app.demand_materials
  for each row execute function presence_app.set_updated_at();

do $$
declare
  t text;
begin
  foreach t in array array['demand_materials','demand_files'] loop
    execute format('alter table presence_app.%I enable row level security', t);
    execute format('grant select, insert, update, delete on presence_app.%I to anon, authenticated, service_role', t);
    execute format($p$create policy "sem login: dono fixo" on presence_app.%I for all to anon
      using (user_id = '00000000-0000-0000-0000-000000000001')
      with check (user_id = '00000000-0000-0000-0000-000000000001')$p$, t);
    execute format($p$create policy "dono: linhas próprias" on presence_app.%I for all to authenticated
      using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)$p$, t);
  end loop;
end $$;

-- Storage: bucket privado, só a pasta do dono fixo (modo sem login). Ao voltar ao modo com login, apagar as
-- policies "... sem login ..." e manter "... dono" (pasta = auth.uid()).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('presence-app-demand-files', 'presence-app-demand-files', false, 26214400, null)
on conflict (id) do nothing;

create policy "presence-app-demand-files: sem login ler" on storage.objects for select to anon
  using (bucket_id = 'presence-app-demand-files' and (storage.foldername(name))[1] = '00000000-0000-0000-0000-000000000001');
create policy "presence-app-demand-files: sem login enviar" on storage.objects for insert to anon
  with check (bucket_id = 'presence-app-demand-files' and (storage.foldername(name))[1] = '00000000-0000-0000-0000-000000000001');
create policy "presence-app-demand-files: sem login trocar" on storage.objects for update to anon
  using (bucket_id = 'presence-app-demand-files' and (storage.foldername(name))[1] = '00000000-0000-0000-0000-000000000001')
  with check (bucket_id = 'presence-app-demand-files' and (storage.foldername(name))[1] = '00000000-0000-0000-0000-000000000001');
create policy "presence-app-demand-files: sem login apagar" on storage.objects for delete to anon
  using (bucket_id = 'presence-app-demand-files' and (storage.foldername(name))[1] = '00000000-0000-0000-0000-000000000001');

create policy "presence-app-demand-files: dono" on storage.objects for all to authenticated
  using (bucket_id = 'presence-app-demand-files' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'presence-app-demand-files' and (storage.foldername(name))[1] = (select auth.uid())::text);
