-- Tarefas fixas: aparecem nos dias da semana escolhidos (todos os dias por padrão); cada dia tem sua própria marcação de feito.
-- Dado pessoal: só o dono vê; sem acesso para `anon`.
create table if not exists presence_app.fixed_tasks (
  id uuid primary key default gen_random_uuid(), user_id uuid not null default presence_app.owner_id(),
  title text not null check (char_length(title) between 1 and 200),
  category_id uuid references presence_app.task_categories(id) on delete set null,
  priority text not null default 'media' check (priority in ('alta','media','baixa')),
  due_time time, weekdays smallint[] not null default '{0,1,2,3,4,5,6}',
  active boolean not null default true, position int not null default 0, created_at timestamptz not null default now()
);
create table if not exists presence_app.fixed_task_done (
  id uuid primary key default gen_random_uuid(), user_id uuid not null default presence_app.owner_id(),
  fixed_id uuid not null references presence_app.fixed_tasks(id) on delete cascade, done_date date not null, created_at timestamptz not null default now(),
  unique (fixed_id, done_date)
);
do $$ declare t text; begin
  foreach t in array array['fixed_tasks','fixed_task_done'] loop
    execute format('alter table presence_app.%I enable row level security', t);
    execute format('drop policy if exists "dono: linhas próprias" on presence_app.%I', t);
    execute format('create policy "dono: linhas próprias" on presence_app.%I for all to authenticated using (user_id = (select presence_app.owner_id())) with check (user_id = (select presence_app.owner_id()))', t);
    execute format('revoke all on presence_app.%I from anon', t);
    execute format('grant select, insert, update, delete on presence_app.%I to authenticated', t);
  end loop;
end $$;
