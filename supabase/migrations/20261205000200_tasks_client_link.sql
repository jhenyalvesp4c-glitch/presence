-- Tarefa/compromisso vinculado a um cliente (aparece na ficha do cliente).
alter table presence_app.tasks add column if not exists client_id uuid references presence_app.clients(id) on delete set null;
create index if not exists tasks_client_idx on presence_app.tasks (client_id) where client_id is not null;
