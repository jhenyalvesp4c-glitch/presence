-- Cofrinho: conta que guarda dinheiro separado para pagar parcelas de compras específicas.
alter table presence_app.fin_accounts drop constraint if exists fin_accounts_kind_check;
alter table presence_app.fin_accounts add constraint fin_accounts_kind_check check (kind in ('banco','carteira','dinheiro','investimento','cofrinho'));
-- Qual cofrinho (id da conta) paga as parcelas desta compra.
alter table presence_app.fin_plans add column if not exists funded_by text;
