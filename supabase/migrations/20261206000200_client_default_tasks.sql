-- Tarefas padrão de cada cliente novo (editáveis). `kind = 'off'` (uma linha) desliga a criação automática. RLS por dono, sem acesso para anon.
create table if not exists presence_app.client_default_tasks (
  user_id uuid not null default presence_app.owner_id(),
  id uuid not null default gen_random_uuid(),
  kind text not null default 'task' check (kind in ('task','off')),
  title text not null default '' check (char_length(title) <= 200),
  position int not null default 0,
  created_at timestamptz not null default now(),
  primary key (user_id, id)
);
alter table presence_app.client_default_tasks enable row level security;
revoke all on presence_app.client_default_tasks from anon;
grant select, insert, update, delete on presence_app.client_default_tasks to authenticated, service_role;
drop policy if exists "dono: linhas próprias" on presence_app.client_default_tasks;
create policy "dono: linhas próprias" on presence_app.client_default_tasks for all to authenticated
  using (user_id = (select presence_app.owner_id())) with check (user_id = (select presence_app.owner_id()));
