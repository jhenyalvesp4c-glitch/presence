-- Categorias do financeiro editáveis: ajustes das de fábrica e categorias novas, guardados junto das configurações (uma linha por pessoa).
alter table presence_app.fin_settings add column if not exists categories jsonb not null default '[]'::jsonb;
