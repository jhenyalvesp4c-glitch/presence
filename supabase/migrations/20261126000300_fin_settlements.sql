-- Financeiro → Acerto de contas: compras no cartão de um e do outro (ou dos dois), pagamentos (pix) e o saldo no fim.
-- Dado sensível: só quem está logado, só nas próprias linhas; sem acesso para `anon`.
create table if not exists presence_app.fin_settlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default presence_app.owner_id(),
  person text not null check (char_length(person) between 1 and 80),
  note text not null default '',
  closed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists fin_settlements_user_idx on presence_app.fin_settlements (user_id, closed, created_at desc);

create table if not exists presence_app.fin_settlement_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default presence_app.owner_id(),
  settlement_id uuid not null references presence_app.fin_settlements(id) on delete cascade,
  kind text not null default 'compra' check (kind in ('compra','pagamento')),
  item_date date,
  description text not null default '' check (char_length(description) <= 200),
  amount numeric(14,2) not null check (amount > 0),
  -- quem pagou: 'eu' (meu cartão / eu fiz o pix) ou 'outro' (cartão da outra pessoa / ela fez o pix)
  payer text not null check (payer in ('eu','outro')),
  -- compra: quantos % do valor são DA OUTRA PESSOA (0 = tudo meu, 100 = tudo dela, 50 = dividido)
  other_share smallint not null default 100 check (other_share between 0 and 100),
  installment text not null default '',
  position integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists fin_settlement_items_idx on presence_app.fin_settlement_items (user_id, settlement_id, position);

do $$ declare t text; begin
  foreach t in array array['fin_settlements','fin_settlement_items'] loop
    execute format('alter table presence_app.%I enable row level security', t);
    execute format('drop policy if exists "dono: linhas próprias" on presence_app.%I', t);
    execute format('create policy "dono: linhas próprias" on presence_app.%I for all to authenticated using (user_id = (select presence_app.owner_id())) with check (user_id = (select presence_app.owner_id()))', t);
    execute format('revoke all on presence_app.%I from anon', t);
    execute format('grant select, insert, update, delete on presence_app.%I to authenticated', t);
  end loop;
end $$;
