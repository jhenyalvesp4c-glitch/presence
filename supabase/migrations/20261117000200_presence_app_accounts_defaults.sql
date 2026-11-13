-- Conta nova (que não é a principal) começa com as mesmas categorias de tarefa padrão.
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
  if created and existing <> legacy then
    if nm is not null then update presence_app.profiles set display_name = nm where id = existing; end if;
    insert into presence_app.task_categories (user_id, slug, name, icon, color, position)
      select existing, c.slug, c.name, c.icon, c.color, c.position from presence_app.task_categories c where c.user_id = legacy
      on conflict (user_id, slug) do nothing;
  end if;
  return jsonb_build_object('owner_id', existing, 'novo', created, 'principal', existing = legacy,
    'nome', (select display_name from presence_app.profiles where id = existing));
end
$$;
revoke all on function presence_app.claim_account(text) from public, anon;
grant execute on function presence_app.claim_account(text) to authenticated;
