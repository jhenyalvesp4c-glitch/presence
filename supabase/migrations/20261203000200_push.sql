-- Avisos no celular com o app fechado (Web Push).
--  * push_subscriptions: um aparelho/navegador por linha (só a dona enxerga e mexe; sem política para `anon`).
--  * push_sent: o que já foi avisado (evita avisar duas vezes). Sem acesso direto: só as funções abaixo.
--  * push_config: segredo da rotina e as chaves VAPID, geradas pelo servidor na 1ª vez. Sem acesso direto.
--  * As funções `push_*` são SECURITY DEFINER e só entregam dados a quem apresenta o segredo da rotina (guardado só aqui, no banco).
--  * pg_cron chama a rotina do servidor (/api/push/cron) a cada minuto; o servidor chama push_due, envia e chama push_mark.

create table if not exists presence_app.push_subscriptions (
  user_id uuid not null default presence_app.owner_id(),
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  user_agent text not null default '',
  created_at timestamptz not null default now(),
  last_ok_at timestamptz,
  primary key (user_id, endpoint)
);
alter table presence_app.push_subscriptions enable row level security;
drop policy if exists "dono: linhas próprias" on presence_app.push_subscriptions;
create policy "dono: linhas próprias" on presence_app.push_subscriptions for all to authenticated
  using (user_id = (select presence_app.owner_id())) with check (user_id = (select presence_app.owner_id()));
revoke all on presence_app.push_subscriptions from anon;
grant select, insert, update, delete on presence_app.push_subscriptions to authenticated;

create table if not exists presence_app.push_sent (
  user_id uuid not null,
  key text not null,
  sent_at timestamptz not null default now(),
  primary key (user_id, key)
);
alter table presence_app.push_sent enable row level security;
revoke all on presence_app.push_sent from anon, authenticated;

create table if not exists presence_app.push_config (
  id int primary key default 1 check (id = 1),
  cron_secret text not null default encode(extensions.gen_random_bytes(32), 'hex'),
  vapid_public text,
  vapid_private text,
  created_at timestamptz not null default now()
);
alter table presence_app.push_config enable row level security;
revoke all on presence_app.push_config from anon, authenticated;
insert into presence_app.push_config (id) values (1) on conflict do nothing;

-- ── segredo e chaves ──
create or replace function presence_app.push_check(p_secret text) returns boolean
language sql stable security definer set search_path = ''
as $$ select exists (select 1 from presence_app.push_config c where c.id = 1 and c.cron_secret = p_secret) $$;

create or replace function presence_app.push_public_key() returns text
language sql stable security definer set search_path = ''
as $$ select c.vapid_public from presence_app.push_config c where c.id = 1 $$;

-- 1ª chamada grava as chaves; depois disso não troca mais (devolve a chave pública que ficou)
create or replace function presence_app.push_bootstrap(p_public text, p_private text) returns text
language plpgsql security definer set search_path = ''
as $$
begin
  update presence_app.push_config set vapid_public = p_public, vapid_private = p_private where id = 1 and vapid_public is null and length(p_public) > 40 and length(p_private) > 20;
  return (select c.vapid_public from presence_app.push_config c where c.id = 1);
end $$;

create or replace function presence_app.push_vapid(p_secret text) returns jsonb
language sql stable security definer set search_path = ''
as $$ select case when presence_app.push_check(p_secret) then (select jsonb_build_object('public', c.vapid_public, 'private', c.vapid_private) from presence_app.push_config c where c.id = 1) end $$;

-- chaves para o teste "enviar aviso para mim" (só quem está logado; o servidor não repassa a chave privada)
create or replace function presence_app.push_vapid_user() returns jsonb
language sql stable security definer set search_path = ''
as $$ select case when auth.uid() is not null then (select jsonb_build_object('public', c.vapid_public, 'private', c.vapid_private) from presence_app.push_config c where c.id = 1) end $$;

-- ── o que avisar agora ──
-- Horário de Brasília. Lembretes: na hora marcada (até 90 min depois). Faturas e assinaturas: de manhã (a partir das 9h), 1 dia antes e no dia.
create or replace function presence_app.push_due(p_secret text, p_now timestamptz default now())
returns table (user_id uuid, dedupe_key text, title text, body text, url text, endpoint text, p256dh text, auth text)
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_local timestamp := p_now at time zone 'America/Sao_Paulo';
  v_today date := (p_now at time zone 'America/Sao_Paulo')::date;
  v_tom date := (p_now at time zone 'America/Sao_Paulo')::date + 1;
  v_morning boolean := extract(hour from (p_now at time zone 'America/Sao_Paulo')) >= 9;
begin
  if not presence_app.push_check(p_secret) then return; end if;
  return query
  with items as (
    -- lembretes na hora
    select t.user_id as uid, ('lem:' || t.id || ':' || t.due_date || ' ' || t.due_time)::text as k, 'Lembrete'::text as ti, t.title::text as bo, '/tarefas'::text as ur
      from presence_app.tasks t
     where t.kind = 'lembrete' and not t.done and t.due_date is not null and t.due_time is not null
       and (t.due_date + t.due_time) <= v_local and (t.due_date + t.due_time) > v_local - interval '90 minutes'
    union all
    -- faturas: fecha / vence (amanhã e hoje)
    select c.user_id, 'fat:' || c.id || ':' || k.kind || ':' || dd.d, 'Fatura ' || c.name,
           'A fatura ' || case k.kind when 'fecha' then 'fecha ' else 'vence ' end || case when dd.d = v_tom then 'amanhã' else 'hoje' end || '.', '/financeiro'
      from presence_app.fin_cards c
      cross join lateral (values ('fecha', c.closing_day), ('vence', c.due_day)) as k(kind, dday)
      cross join (values (v_tom), (v_today)) as dd(d)
     where v_morning and k.dday is not null
       and least(k.dday::int, extract(day from (date_trunc('month', dd.d) + interval '1 month' - interval '1 day'))::int) = extract(day from dd.d)::int
    union all
    -- assinaturas renovando (amanhã e hoje)
    select r.user_id, 'ass:' || r.id || ':' || dd.d, 'Assinatura renova ' || case when dd.d = v_tom then 'amanhã' else 'hoje' end,
           r.description || ' · R$ ' || replace(to_char(r.amount, 'FM999999990.00'), '.', ','), '/financeiro?aba=assinaturas'
      from presence_app.fin_recurring r
      cross join lateral (values (v_tom), (v_today)) as dd(d)
     where v_morning and r.kind = 'despesa' and (r.subscription or r.category = 'assinaturas')
       and to_char(dd.d, 'YYYY-MM') >= r.start_ym
       and not exists (select 1 from jsonb_array_elements(coalesce(r.pauses, '[]'::jsonb)) p
                        where to_char(dd.d, 'YYYY-MM') >= coalesce(p->>'from', '9999-99')
                          and (coalesce(p->>'to', '') = '' or to_char(dd.d, 'YYYY-MM') <= p->>'to'))
       and least(r.day::int, extract(day from (date_trunc('month', dd.d) + interval '1 month' - interval '1 day'))::int) = extract(day from dd.d)::int
  )
  select i.uid, i.k, i.ti, i.bo, i.ur, s.endpoint, s.p256dh, s.auth
    from items i
    join presence_app.push_subscriptions s on s.user_id = i.uid
   where not exists (select 1 from presence_app.push_sent ps where ps.user_id = i.uid and ps.key = i.k);
end $$;

create or replace function presence_app.push_mark(p_secret text, p_items jsonb) returns integer
language plpgsql security definer set search_path = ''
as $$
declare n integer;
begin
  if not presence_app.push_check(p_secret) then return 0; end if;
  insert into presence_app.push_sent (user_id, key)
    select (x->>'user_id')::uuid, x->>'key' from jsonb_array_elements(p_items) x
    on conflict do nothing;
  get diagnostics n = row_count;
  delete from presence_app.push_sent where sent_at < now() - interval '60 days';
  return n;
end $$;

create or replace function presence_app.push_drop(p_secret text, p_endpoints text[]) returns integer
language plpgsql security definer set search_path = ''
as $$
declare n integer;
begin
  if not presence_app.push_check(p_secret) then return 0; end if;
  delete from presence_app.push_subscriptions where endpoint = any(p_endpoints);
  get diagnostics n = row_count;
  return n;
end $$;

create or replace function presence_app.push_touch(p_secret text, p_endpoints text[]) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not presence_app.push_check(p_secret) then return; end if;
  update presence_app.push_subscriptions set last_ok_at = now() where endpoint = any(p_endpoints);
end $$;

revoke all on function presence_app.push_check(text), presence_app.push_public_key(), presence_app.push_bootstrap(text, text), presence_app.push_vapid(text), presence_app.push_vapid_user(),
  presence_app.push_due(text, timestamptz), presence_app.push_mark(text, jsonb), presence_app.push_drop(text, text[]), presence_app.push_touch(text, text[]) from public;
grant execute on function presence_app.push_check(text), presence_app.push_public_key(), presence_app.push_bootstrap(text, text), presence_app.push_vapid(text),
  presence_app.push_due(text, timestamptz), presence_app.push_mark(text, jsonb), presence_app.push_drop(text, text[]), presence_app.push_touch(text, text[]) to anon, authenticated;
grant execute on function presence_app.push_vapid_user() to authenticated;
