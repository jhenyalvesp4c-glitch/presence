-- Total da fatura como o banco mostra (mês de vencimento "aaaa-mm" -> valor). Os itens cadastrados abatem desse total.
alter table presence_app.fin_cards add column if not exists declared jsonb not null default '{}'::jsonb;
