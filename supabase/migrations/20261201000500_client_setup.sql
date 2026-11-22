-- Roteiro de implantação por cliente (passo a passo guiado): fases e passos com status e anotação.
create table if not exists presence_app.client_setup (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default presence_app.owner_id(),
  client_id uuid not null references presence_app.clients(id) on delete cascade,
  key text not null,
  phase text not null,
  phase_position integer not null default 0,
  position integer not null default 0,
  title text not null check (char_length(title) between 1 and 200),
  hint text not null default '',
  status text not null default 'todo' check (status in ('todo','doing','done','blocked','na')),
  note text not null default '',
  done_at timestamptz,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create unique index if not exists client_setup_key_uq on presence_app.client_setup (client_id, key);
create index if not exists client_setup_idx on presence_app.client_setup (user_id, client_id, phase_position, position);
alter table presence_app.client_setup enable row level security;
drop policy if exists "dono: linhas próprias" on presence_app.client_setup;
create policy "dono: linhas próprias" on presence_app.client_setup for all to authenticated using (user_id = (select presence_app.owner_id())) with check (user_id = (select presence_app.owner_id()));
revoke all on presence_app.client_setup from anon;
grant select, insert, update, delete on presence_app.client_setup to authenticated;
