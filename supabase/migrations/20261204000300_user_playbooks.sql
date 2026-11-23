-- Playbooks da pessoa: editar, excluir e criar. O modelo que já vem com o Orion (onboarding-cliente) pode ser editado (vira uma linha aqui)
-- ou excluído (linha com deleted = true). RLS por dono (presence_app.owner_id()), sem acesso para anon.
create table presence_app.user_playbooks (
  user_id uuid not null default presence_app.owner_id(),
  id text not null check (char_length(id) between 1 and 60),
  name text not null check (char_length(name) between 1 and 120),
  tagline text not null default '' check (char_length(tagline) <= 500),
  tone text not null default 'cyan' check (tone in ('cyan','violet','emerald','amber')),
  docs jsonb not null default '[]'::jsonb,
  checklist jsonb not null default '[]'::jsonb,
  steps jsonb not null default '[]'::jsonb,
  deleted boolean not null default false,
  position int not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);
alter table presence_app.user_playbooks enable row level security;
revoke all on presence_app.user_playbooks from anon;
grant select, insert, update, delete on presence_app.user_playbooks to authenticated, service_role;
create policy "dono: linhas próprias" on presence_app.user_playbooks for all to authenticated
  using (user_id = (select presence_app.owner_id())) with check (user_id = (select presence_app.owner_id()));
