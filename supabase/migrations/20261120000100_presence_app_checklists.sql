-- Listas (checklists) criadas e ajustadas por conversa: "vou à praia, o que levar?", etc.
create table if not exists presence_app.checklists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default presence_app.owner_id(),
  title text not null,
  color text not null default 'cyan',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists presence_app.checklist_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default presence_app.owner_id(),
  list_id uuid not null references presence_app.checklists(id) on delete cascade,
  section text not null default '',
  label text not null,
  done boolean not null default false,
  position integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists checklist_items_list_idx on presence_app.checklist_items (list_id, position);
create index if not exists checklists_user_idx on presence_app.checklists (user_id, updated_at desc);

do $$ declare t text; begin
  foreach t in array array['checklists','checklist_items'] loop
    execute format('alter table presence_app.%I enable row level security', t);
    execute format('drop policy if exists "dono: linhas próprias" on presence_app.%I', t);
    execute format('create policy "dono: linhas próprias" on presence_app.%I for all to authenticated using (user_id = (select presence_app.owner_id())) with check (user_id = (select presence_app.owner_id()))', t);
    execute format('drop policy if exists "sem login: dono fixo" on presence_app.%I', t);
    execute format('create policy "sem login: dono fixo" on presence_app.%I for all to anon using (user_id = ''00000000-0000-0000-0000-000000000001''::uuid) with check (user_id = ''00000000-0000-0000-0000-000000000001''::uuid)', t);
    execute format('grant select, insert, update, delete on presence_app.%I to anon, authenticated', t);
  end loop;
end $$;
