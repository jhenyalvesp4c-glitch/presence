-- CONTAS (e-mail + senha, Supabase Auth). Cada pessoa vê só os próprios dados.
-- Compatível com o app sem login: o papel `anon` continua enxergando o dono fixo (legado) até o fim da transição.
--
-- Como funciona:
--  * presence_app.account_owner liga um usuário do Auth a um "dono" (owner_id). A 1ª conta que se registra assume o dono
--    legado (00000000-0000-0000-0000-000000000001), então todos os dados atuais continuam dela. A 2ª conta recebe o próprio uid.
--  * Máximo de 2 contas (claim_account). Quem não está em account_owner não enxerga nada.
--  * Todas as tabelas com user_id passam a usar presence_app.owner_id() (padrão e regra de acesso).

create table if not exists presence_app.account_owner (
  auth_uid uuid primary key references auth.users (id) on delete cascade,
  owner_id uuid not null unique,
  created_at timestamptz not null default now()
);
alter table presence_app.account_owner enable row level security;
drop policy if exists "conta: ler a própria" on presence_app.account_owner;
create policy "conta: ler a própria" on presence_app.account_owner for select to authenticated using (auth_uid = (select auth.uid()));
revoke all on presence_app.account_owner from anon;
grant select on presence_app.account_owner to authenticated;

-- Dono dos dados de quem faz a chamada: sem login = dono legado (modo atual); logado = o dono ligado à conta (ou nulo).
create or replace function presence_app.owner_id() returns uuid
language sql stable security definer set search_path = ''
as $$
  select case
    when auth.uid() is null then '00000000-0000-0000-0000-000000000001'::uuid
    else (select a.owner_id from presence_app.account_owner a where a.auth_uid = auth.uid())
  end
$$;
revoke all on function presence_app.owner_id() from public;
grant execute on function presence_app.owner_id() to anon, authenticated;

-- Cria a vinculação da conta logada (idempotente). Limite de 2 contas.
create or replace function presence_app.claim_account(p_name text default null) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  legacy constant uuid := '00000000-0000-0000-0000-000000000001';
  existing uuid; oid uuid; n int; created boolean := false; nm text;
begin
  if uid is null then raise exception 'Faça login primeiro.' using errcode = '28000'; end if;
  select owner_id into existing from presence_app.account_owner where auth_uid = uid;
  if existing is null then
    lock table presence_app.account_owner in share row exclusive mode;
    select owner_id into existing from presence_app.account_owner where auth_uid = uid;
  end if;
  if existing is null then
    select count(*) into n from presence_app.account_owner;
    if n >= 2 then raise exception 'Limite de contas atingido.' using errcode = 'P0001'; end if;
    oid := case when exists (select 1 from presence_app.account_owner where owner_id = legacy) then uid else legacy end;
    insert into presence_app.account_owner (auth_uid, owner_id) values (uid, oid);
    existing := oid; created := true;
  end if;
  nm := nullif(btrim(coalesce(p_name, '')), '');
  insert into presence_app.profiles (id, display_name) values (existing, coalesce(nm, 'Você')) on conflict (id) do nothing;
  if created and nm is not null then update presence_app.profiles set display_name = nm where id = existing and existing <> legacy; end if;
  return jsonb_build_object('owner_id', existing, 'novo', created, 'principal', existing = legacy,
    'nome', (select display_name from presence_app.profiles where id = existing));
end
$$;
revoke all on function presence_app.claim_account(text) from public, anon;
grant execute on function presence_app.claim_account(text) to authenticated;

-- Regras e padrões de todas as tabelas com user_id.
do $$
declare t record; pol record;
begin
  for t in
    select c.table_name from information_schema.columns c
    join information_schema.tables tb on tb.table_schema = c.table_schema and tb.table_name = c.table_name and tb.table_type = 'BASE TABLE'
    where c.table_schema = 'presence_app' and c.column_name = 'user_id' and c.table_name not in ('zz_bak_training_library', 'account_owner')
  loop
    for pol in select policyname from pg_policies where schemaname = 'presence_app' and tablename = t.table_name and roles = '{authenticated}'
    loop execute format('drop policy %I on presence_app.%I', pol.policyname, t.table_name); end loop;
    execute format('create policy %I on presence_app.%I for all to authenticated using (user_id = (select presence_app.owner_id())) with check (user_id = (select presence_app.owner_id()))', 'dono: linhas próprias', t.table_name);
    execute format('alter table presence_app.%I alter column user_id set default presence_app.owner_id()', t.table_name);
  end loop;
end $$;

-- Perfil: o id é o dono.
do $$
declare pol record;
begin
  for pol in select policyname from pg_policies where schemaname = 'presence_app' and tablename = 'profiles' and roles = '{authenticated}'
  loop execute format('drop policy %I on presence_app.profiles', pol.policyname); end loop;
end $$;
create policy "dono: perfil" on presence_app.profiles for all to authenticated
  using (id = (select presence_app.owner_id())) with check (id = (select presence_app.owner_id()));

-- Arquivos: a pasta de cada dono é o owner_id.
do $$
declare b text;
begin
  foreach b in array array['presence-app-brain-files', 'presence-app-demand-files', 'presence-app-photos'] loop
    execute format('drop policy if exists %I on storage.objects', b || ': dono');
    execute format('create policy %I on storage.objects for all to authenticated using (bucket_id = %L and (storage.foldername(name))[1] = (select presence_app.owner_id())::text) with check (bucket_id = %L and (storage.foldername(name))[1] = (select presence_app.owner_id())::text)', b || ': dono', b, b);
  end loop;
end $$;
