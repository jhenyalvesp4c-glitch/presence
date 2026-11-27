-- Pessoas de cada cliente (nome + função) e a pessoa responsável por uma tarefa. RLS por dono, sem acesso para anon.
create table if not exists presence_app.client_people (
  user_id uuid not null default presence_app.owner_id(),
  id uuid not null default gen_random_uuid(),
  client_id uuid not null references presence_app.clients(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  role text not null default '' check (char_length(role) <= 120),
  created_at timestamptz not null default now(),
  primary key (id)
);
create index if not exists client_people_client_idx on presence_app.client_people (client_id);
alter table presence_app.client_people enable row level security;
revoke all on presence_app.client_people from anon;
grant select, insert, update, delete on presence_app.client_people to authenticated, service_role;
drop policy if exists "dono: linhas próprias" on presence_app.client_people;
create policy "dono: linhas próprias" on presence_app.client_people for all to authenticated
  using (user_id = (select presence_app.owner_id())) with check (user_id = (select presence_app.owner_id()));
alter table presence_app.tasks add column if not exists person_id uuid references presence_app.client_people(id) on delete set null;
create index if not exists tasks_person_idx on presence_app.tasks (person_id) where person_id is not null;
