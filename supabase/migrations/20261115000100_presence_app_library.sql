-- Documentação (Biblioteca): documentos e pastas editáveis, com arquivos anexos (bucket presence-app-brain-files).
--  * library_docs: o que a usuária criou ou editou. Um documento de exemplo editado vira uma linha com o mesmo id;
--    "deleted" esconde um exemplo apagado. Logins NÃO ficam aqui (ficam só no navegador, por causa das senhas).
--  * library_folders: pastas criadas pela usuária.
create table presence_app.library_docs (
  id text not null check (char_length(id) between 1 and 80),
  user_id uuid not null default '00000000-0000-0000-0000-000000000001',
  folder_id text not null check (char_length(folder_id) <= 80),
  title text not null default '' check (char_length(title) <= 200),
  description text not null default '' check (char_length(description) <= 6000),
  kind text not null default 'Documento' check (char_length(kind) <= 40),
  color text not null default 'cyan' check (char_length(color) <= 20),
  fav boolean not null default false,
  rules jsonb not null default '[]'::jsonb,
  steps jsonb not null default '[]'::jsonb,
  attachments jsonb not null default '[]'::jsonb,
  ai_summary text not null default '' check (char_length(ai_summary) <= 20000),
  deleted boolean not null default false,
  updated_label text not null default '' check (char_length(updated_label) <= 20),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);
create trigger library_docs_set_updated_at before update on presence_app.library_docs
  for each row execute function presence_app.set_updated_at();

create table presence_app.library_folders (
  id text not null check (char_length(id) between 1 and 80),
  user_id uuid not null default '00000000-0000-0000-0000-000000000001',
  name text not null check (char_length(name) between 1 and 120),
  color text not null default 'cyan' check (char_length(color) <= 20),
  position int not null default 0,
  created_at timestamptz not null default now(),
  primary key (user_id, id)
);

do $$
declare t text;
begin
  foreach t in array array['library_docs','library_folders'] loop
    execute format('alter table presence_app.%I enable row level security', t);
    execute format('grant select, insert, update, delete on presence_app.%I to anon, authenticated, service_role', t);
    execute format($p$create policy "sem login: dono fixo" on presence_app.%I for all to anon
      using (user_id = '00000000-0000-0000-0000-000000000001')
      with check (user_id = '00000000-0000-0000-0000-000000000001')$p$, t);
    execute format($p$create policy "dono: linhas próprias" on presence_app.%I for all to authenticated
      using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)$p$, t);
  end loop;
end $$;
