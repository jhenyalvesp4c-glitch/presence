-- Ordem manual das tarefas dentro da ficha do cliente (0, 1, 2…). Nulo = ordem de criação.
alter table presence_app.tasks add column if not exists client_order integer;
