-- Compras já contidas no limite informado do cartão (ex.: detalhamento de fatura): não consomem o limite de novo.
alter table presence_app.fin_plans add column if not exists in_limit boolean not null default false;
alter table presence_app.fin_transactions add column if not exists in_limit boolean not null default false;
