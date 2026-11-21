-- Pasta da Documentação e reunião podem ser ligadas a um dossiê (página do dossiê reúne tudo).
alter table presence_app.library_folders add column if not exists dossier_id text;
alter table presence_app.meetings add column if not exists dossier_id text;
alter table presence_app.meetings add column if not exists dossier_project text;
