-- Clientes: ficha ligada (opcionalmente) a um dossiê do projeto, com documentos, histórico e acessos (sem senha).
create table if not exists presence_app.clients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default presence_app.owner_id(),
  project_id text not null,
  dossier_id text,
  name text not null check (char_length(name) between 1 and 160),
  segment text not null default '',
  contact_name text not null default '',
  email text not null default '',
  phone text not null default '',
  doc_number text not null default '',
  status text not null default 'ativo' check (status in ('ativo','neg','pausa','encerrado')),
  plan text not null default '',
  monthly_value numeric(14,2) not null default 0 check (monthly_value >= 0),
  contract_end date,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists clients_idx on presence_app.clients (user_id, project_id, status);

create table if not exists presence_app.client_docs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default presence_app.owner_id(),
  client_id uuid not null references presence_app.clients(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  kind text not null default 'Documento',
  doc_date date,
  attachments jsonb not null default '[]'::jsonb,
  ai_summary text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists client_docs_idx on presence_app.client_docs (user_id, client_id, created_at desc);

create table if not exists presence_app.client_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default presence_app.owner_id(),
  client_id uuid not null references presence_app.clients(id) on delete cascade,
  log_date date not null default current_date,
  text text not null check (char_length(text) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index if not exists client_log_idx on presence_app.client_log (user_id, client_id, log_date desc);

create table if not exists presence_app.client_access (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default presence_app.owner_id(),
  client_id uuid not null references presence_app.clients(id) on delete cascade,
  label text not null check (char_length(label) between 1 and 160),
  username text not null default '',
  note text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists client_access_idx on presence_app.client_access (user_id, client_id);

alter table presence_app.meetings add column if not exists client_id uuid references presence_app.clients(id) on delete set null;

do $$ declare t text; begin
  foreach t in array array['clients','client_docs','client_log','client_access'] loop
    execute format('alter table presence_app.%I enable row level security', t);
    execute format('drop policy if exists "dono: linhas próprias" on presence_app.%I', t);
    execute format('create policy "dono: linhas próprias" on presence_app.%I for all to authenticated using (user_id = (select presence_app.owner_id())) with check (user_id = (select presence_app.owner_id()))', t);
    execute format('revoke all on presence_app.%I from anon', t);
    execute format('grant select, insert, update, delete on presence_app.%I to authenticated', t);
  end loop;
end $$;
