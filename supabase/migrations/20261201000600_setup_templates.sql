-- Roteiro de implantação padrão por projeto: novos clientes já nascem com ele (a usuária configura uma vez).
create table if not exists presence_app.setup_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default presence_app.owner_id(),
  project_id text not null,
  phases jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);
create unique index if not exists setup_templates_uq on presence_app.setup_templates (user_id, project_id);
alter table presence_app.setup_templates enable row level security;
drop policy if exists "dono: linhas próprias" on presence_app.setup_templates;
create policy "dono: linhas próprias" on presence_app.setup_templates for all to authenticated using (user_id = (select presence_app.owner_id())) with check (user_id = (select presence_app.owner_id()));
revoke all on presence_app.setup_templates from anon;
grant select, insert, update, delete on presence_app.setup_templates to authenticated;
