-- Itens do acerto gerados a partir de compras divididas (vínculo com o financeiro): source_ref = "plan:<id>:<parcela>" ou "tx:<id>".
alter table presence_app.fin_settlement_items add column if not exists source_ref text;
create unique index if not exists fin_settlement_items_ref_uq on presence_app.fin_settlement_items (user_id, source_ref) where source_ref is not null;
