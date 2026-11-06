-- Calendário na página de Demandas: compromissos são tarefas da categoria "Compromissos" (slug comp).
-- Campos extras na tabela de tarefas (schema presence_app). Assim eles entram sozinhos no
-- "Organize meu dia" e no "Planeje meu dia".
-- project_id e dossier_id são textos: projetos e dossiês ainda moram no navegador (localStorage).
alter table presence_app.tasks
  add column if not exists end_time time,
  add column if not exists place text check (place is null or char_length(place) <= 200),
  add column if not exists color text check (color is null or color in ('cyan','violet','emerald','amber','pink','rose')),
  add column if not exists project_id text,
  add column if not exists dossier_id text;

create index if not exists tasks_project_dossier_idx on presence_app.tasks (project_id, dossier_id) where project_id is not null;
