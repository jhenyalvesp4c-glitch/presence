-- Login só com usuário e senha (sem e-mail, sem confirmação).
-- O usuário vira um e-mail interno "<usuario>@orion.local" (ninguém recebe nada nesse endereço) e a conta
-- já nasce confirmada. Assim a Supabase nunca manda e-mail de confirmação.
-- Contas antigas com e-mail de verdade continuam entrando com o e-mail.
create extension if not exists pgcrypto with schema extensions;

create or replace function presence_app.create_login(p_user text, p_password text, p_name text default null)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  u text := lower(btrim(coalesce(p_user, '')));
  mail text;
  uid uuid := gen_random_uuid();
  cap int; n int;
  nm text := nullif(btrim(coalesce(p_name, '')), '');
begin
  if u !~ '^[a-z0-9][a-z0-9._-]{2,29}$' then
    raise exception 'Usuário inválido: use de 3 a 30 letras, números, ponto, hífen ou _.' using errcode = 'P0001';
  end if;
  if length(coalesce(p_password, '')) < 6 then
    raise exception 'A senha precisa ter pelo menos 6 caracteres.' using errcode = 'P0001';
  end if;
  mail := u || '@orion.local';
  lock table presence_app.account_owner in share row exclusive mode;
  if exists (select 1 from auth.users where lower(email) = mail) then
    raise exception 'Esse usuário já existe. Escolha outro.' using errcode = 'P0001';
  end if;
  -- mesmo limite do claim_account (protege o custo da IA); conta também logins criados e ainda não abertos
  select value into cap from presence_app.app_settings where key = 'max_accounts';
  select (select count(*) from presence_app.account_owner)
       + (select count(*) from auth.users au where au.email like '%@orion.local'
            and not exists (select 1 from presence_app.account_owner ao where ao.auth_uid = au.id))
    into n;
  if n >= coalesce(cap, 10) then raise exception 'Limite de contas atingido.' using errcode = 'P0001'; end if;

  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change, email_change_token_current, reauthentication_token)
  values ('00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated', mail,
    extensions.crypt(p_password, extensions.gen_salt('bf')), now(),
    jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
    jsonb_build_object('name', coalesce(nm, u), 'username', u), now(), now(),
    '', '', '', '', '', '');
  insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), uid, uid::text, 'email',
    jsonb_build_object('sub', uid::text, 'email', mail, 'email_verified', true), now(), now(), now());
  return jsonb_build_object('ok', true, 'usuario', u);
end
$function$;

revoke all on function presence_app.create_login(text, text, text) from public;
grant execute on function presence_app.create_login(text, text, text) to anon, authenticated;

-- Contas que ficaram presas esperando confirmação de e-mail: libera.
update auth.users set email_confirmed_at = now() where email_confirmed_at is null;
