-- BRIEFING E MEMÓRIA da Presence: o que ela sabe sobre cada pessoa (como chamar, jeito de conversar, trabalho, rotina)
-- e o que aprende ao longo do tempo. Uma linha de briefing por dono; aprendizados são várias linhas.

create table if not exists presence_app.user_briefing (
  user_id uuid primary key default presence_app.owner_id(),
  call_name text not null default '' check (char_length(call_name) <= 60),
  tone text not null default '' check (char_length(tone) <= 400),
  greeting text not null default 'esperar' check (greeting in ('esperar', 'saudacao', 'saudacao_hoje', 'saudacao_pergunta')),
  greeting_note text not null default '' check (char_length(greeting_note) <= 400),
  work text not null default '' check (char_length(work) <= 1500),
  biggest_demand text not null default '' check (char_length(biggest_demand) <= 1500),
  routine text not null default '' check (char_length(routine) <= 1500),
  goals text not null default '' check (char_length(goals) <= 1500),
  preferences text not null default '' check (char_length(preferences) <= 1500),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists presence_app.user_memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default presence_app.owner_id(),
  text text not null check (char_length(text) between 1 and 500),
  kind text not null default 'aprendizado' check (kind in ('aprendizado', 'preferencia', 'rotina', 'pessoa', 'regra')),
  source text not null default 'conversa' check (source in ('conversa', 'briefing', 'manual')),
  created_at timestamptz not null default now()
);
create index if not exists user_memories_owner_idx on presence_app.user_memories (user_id, created_at desc);

drop trigger if exists user_briefing_updated on presence_app.user_briefing;
create trigger user_briefing_updated before update on presence_app.user_briefing for each row execute function presence_app.set_updated_at();

do $$
declare t text;
begin
  foreach t in array array['user_briefing', 'user_memories'] loop
    execute format('alter table presence_app.%I enable row level security', t);
    execute format('drop policy if exists %I on presence_app.%I', 'dono: linhas próprias', t);
    execute format('create policy %I on presence_app.%I for all to authenticated using (user_id = (select presence_app.owner_id())) with check (user_id = (select presence_app.owner_id()))', 'dono: linhas próprias', t);
    execute format('drop policy if exists %I on presence_app.%I', 'sem login: dono fixo', t);
    execute format('create policy %I on presence_app.%I for all to anon using (user_id = %L::uuid) with check (user_id = %L::uuid)', 'sem login: dono fixo', t, '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001');
    execute format('grant select, insert, update, delete on presence_app.%I to anon, authenticated', t);
  end loop;
end $$;
