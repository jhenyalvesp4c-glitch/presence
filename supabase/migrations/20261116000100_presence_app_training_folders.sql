-- Treinamentos: pastas de roteiros (nomes de pastas, inclusive vazias). Cada roteiro guarda a sua pasta em `data` (script.folder).
alter table presence_app.training_library add column if not exists folders jsonb not null default '[]'::jsonb;
