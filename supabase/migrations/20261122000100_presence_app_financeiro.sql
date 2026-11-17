-- Financeiro: contas, cartões, movimentações, parcelas, fixas e metas.
-- Dado sensível: SÓ quem está logado enxerga e mexe, e só nas próprias linhas. Sem política para `anon`.
-- Os ids vêm do app (texto, ex.: "card-nubank"), então a chave é (user_id, id).

create table if not exists presence_app.fin_settings (
  user_id uuid primary key default presence_app.owner_id(),
  onboarded boolean not null default false,
  mock boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists presence_app.fin_accounts (
  user_id uuid not null default presence_app.owner_id(),
  id text not null,
  name text not null,
  kind text not null check (kind in ('banco','carteira','dinheiro','investimento')),
  tone text not null default 'grafite',
  balance_base numeric(14,2) not null default 0,
  base_date date not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists presence_app.fin_cards (
  user_id uuid not null default presence_app.owner_id(),
  id text not null,
  name text not null,
  brand text not null default 'outro' check (brand in ('visa','mastercard','elo','amex','outro')),
  last4 text not null default '',
  tone text not null default 'grafite',
  limit_amount numeric(14,2) not null default 0,
  available_base numeric(14,2) not null default 0,
  base_date date not null,
  closing_day smallint not null check (closing_day between 1 and 31),
  due_day smallint not null check (due_day between 1 and 31),
  adjustments jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists presence_app.fin_plans (
  user_id uuid not null default presence_app.owner_id(),
  id text not null,
  description text not null,
  card_id text not null,
  total numeric(14,2) not null,
  installments smallint not null check (installments >= 1),
  per_amount numeric(14,2) not null,
  purchase_ym text not null,
  first_ym text not null,
  category text not null default 'outros',
  paid_manual smallint,
  created_on date not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists presence_app.fin_recurring (
  user_id uuid not null default presence_app.owner_id(),
  id text not null,
  kind text not null check (kind in ('despesa','receita')),
  description text not null,
  amount numeric(14,2) not null,
  day smallint not null check (day between 1 and 31),
  category text not null default 'outros',
  method text not null check (method in ('debito','credito','dinheiro','pix')),
  account_id text,
  card_id text,
  start_ym text not null,
  subscription boolean not null default false,
  pauses jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists presence_app.fin_transactions (
  user_id uuid not null default presence_app.owner_id(),
  id text not null,
  kind text not null check (kind in ('despesa','receita')),
  description text not null,
  amount numeric(14,2) not null,
  date date not null,
  method text not null check (method in ('debito','credito','dinheiro','pix')),
  account_id text,
  card_id text,
  category text not null default 'outros',
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);
create index if not exists fin_transactions_date_idx on presence_app.fin_transactions (user_id, date desc);

create table if not exists presence_app.fin_goals (
  user_id uuid not null default presence_app.owner_id(),
  id text not null,
  kind text not null check (kind in ('guardar','reserva','quitar_cartao','economizar_mensal','limite_categoria')),
  title text not null,
  target numeric(14,2) not null,
  current_amount numeric(14,2) not null default 0,
  deadline date,
  category text,
  card_id text,
  monthly numeric(14,2),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

do $$ declare t text; begin
  foreach t in array array['fin_settings','fin_accounts','fin_cards','fin_plans','fin_recurring','fin_transactions','fin_goals'] loop
    execute format('alter table presence_app.%I enable row level security', t);
    execute format('drop policy if exists "dono: linhas próprias" on presence_app.%I', t);
    execute format('create policy "dono: linhas próprias" on presence_app.%I for all to authenticated using (user_id = (select presence_app.owner_id())) with check (user_id = (select presence_app.owner_id()))', t);
    execute format('revoke all on presence_app.%I from anon', t);
    execute format('grant select, insert, update, delete on presence_app.%I to authenticated', t);
  end loop;
end $$;
