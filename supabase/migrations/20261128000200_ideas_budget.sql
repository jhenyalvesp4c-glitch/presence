-- Orçamento da ideia: lista de compras/gastos (nome, quantidade, valor, link, estado) para somar quanto vai custar.
alter table presence_app.ideas add column if not exists budget jsonb not null default '[]'::jsonb;
