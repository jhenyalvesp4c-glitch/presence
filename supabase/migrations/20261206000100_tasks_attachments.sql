-- Imagens (e PDFs) anexadas à tarefa: lista de {path, name, mime, size} no Storage.
alter table presence_app.tasks add column if not exists attachments jsonb not null default '[]'::jsonb;
