-- Assistente de reuniões: cada reunião (ou resumo de grupo do WhatsApp) com o texto original e a análise do Orion (ata, decisões, quem faz o quê).
-- Dado pessoal: só o dono vê; sem acesso para `anon`.
create table if not exists presence_app.meetings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default presence_app.owner_id(),
  title text not null check (char_length(title) between 1 and 200),
  source text not null default 'texto' check (source in ('texto','voz','whatsapp')),
  mode text not null default 'reuniao' check (mode in ('reuniao','grupo')),
  raw text not null default '' check (char_length(raw) <= 80000),
  analysis jsonb not null default '{}'::jsonb,
  created jsonb not null default '[]'::jsonb,
  happened_on date not null default (now() at time zone 'America/Sao_Paulo')::date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists meetings_user_idx on presence_app.meetings (user_id, created_at desc);

alter table presence_app.meetings enable row level security;
drop policy if exists "dono: linhas próprias" on presence_app.meetings;
create policy "dono: linhas próprias" on presence_app.meetings for all to authenticated using (user_id = (select presence_app.owner_id())) with check (user_id = (select presence_app.owner_id()));
revoke all on presence_app.meetings from anon;
grant select, insert, update, delete on presence_app.meetings to authenticated;
