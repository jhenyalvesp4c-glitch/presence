-- Backend da página principal (/assistente): perfil, conversa com a assistente e demandas.
-- Tudo no schema presence_app; nada em public (que pertence ao assistente virtual).

create or replace function presence_app.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Perfil (nome exibido na saudação "Olá, ...").
create table presence_app.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (char_length(display_name) <= 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Histórico da conversa com a assistente.
create table presence_app.assistant_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null check (char_length(content) between 1 and 20000),
  created_at timestamptz not null default now()
);
create index assistant_messages_user_created_idx
  on presence_app.assistant_messages (user_id, created_at desc);

-- Demandas registradas pela página principal (voz, texto ou pela própria assistente).
create table presence_app.demands (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 300),
  description text check (char_length(description) <= 5000),
  source text not null default 'texto' check (source in ('voz', 'texto', 'assistente')),
  status text not null default 'nova' check (status in ('nova', 'em_andamento', 'concluida')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index demands_user_created_idx on presence_app.demands (user_id, created_at desc);

create trigger profiles_set_updated_at before update on presence_app.profiles
  for each row execute function presence_app.set_updated_at();
create trigger demands_set_updated_at before update on presence_app.demands
  for each row execute function presence_app.set_updated_at();

-- RLS: cada usuária só enxerga e altera as próprias linhas.
alter table presence_app.profiles enable row level security;
alter table presence_app.assistant_messages enable row level security;
alter table presence_app.demands enable row level security;

create policy "profiles: ler o próprio" on presence_app.profiles
  for select to authenticated using ((select auth.uid()) = id);
create policy "profiles: criar o próprio" on presence_app.profiles
  for insert to authenticated with check ((select auth.uid()) = id);
create policy "profiles: editar o próprio" on presence_app.profiles
  for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create policy "messages: ler as próprias" on presence_app.assistant_messages
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "messages: criar as próprias" on presence_app.assistant_messages
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "messages: apagar as próprias" on presence_app.assistant_messages
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy "demands: ler as próprias" on presence_app.demands
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "demands: criar as próprias" on presence_app.demands
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "demands: editar as próprias" on presence_app.demands
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "demands: apagar as próprias" on presence_app.demands
  for delete to authenticated using ((select auth.uid()) = user_id);

grant select, insert, update, delete on all tables in schema presence_app to authenticated, service_role;
revoke execute on function presence_app.set_updated_at() from public, anon, authenticated;
