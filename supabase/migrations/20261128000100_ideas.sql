-- Projetos e ideias: caixa de ideias (e mural de referências), com o plano que o Orion monta e o histórico do que virou projeto/tarefa/lembrete/documentação.
-- Dado pessoal: só quem está logado, só as próprias linhas; sem acesso para `anon`.
create table if not exists presence_app.ideas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default presence_app.owner_id(),
  title text not null check (char_length(title) between 1 and 200),
  body text not null default '' check (char_length(body) <= 8000),
  kind text not null default 'ideia' check (kind in ('ideia','referencia')),
  area text not null default 'pessoal' check (area in ('pessoal','negocios')),
  status text not null default 'solta' check (status in ('solta','explorando','validando','fazendo','arquivada')),
  tags text[] not null default '{}',
  links text[] not null default '{}',
  attachments jsonb not null default '[]'::jsonb,
  plan jsonb,
  converted jsonb not null default '[]'::jsonb,
  source text not null default 'texto' check (source in ('texto','voz','print','orion')),
  touched_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ideas_user_idx on presence_app.ideas (user_id, kind, status, touched_at desc);

alter table presence_app.ideas enable row level security;
drop policy if exists "dono: linhas próprias" on presence_app.ideas;
create policy "dono: linhas próprias" on presence_app.ideas for all to authenticated using (user_id = (select presence_app.owner_id())) with check (user_id = (select presence_app.owner_id()));
revoke all on presence_app.ideas from anon;
grant select, insert, update, delete on presence_app.ideas to authenticated;
