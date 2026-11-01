-- Schema dedicado ao novo app Presence (separado do assistente virtual, que usa o schema public).
create schema if not exists presence_app;
comment on schema presence_app is 'Novo app Presence (repo jhenyalvesp4c-glitch/presence). Isolado do assistente virtual que vive em public.';

grant usage on schema presence_app to anon, authenticated, service_role;

-- Permissões padrão para tabelas/sequências/funções criadas neste schema.
-- O acesso real a cada linha é controlado por RLS (habilitar em toda tabela nova).
alter default privileges in schema presence_app grant select, insert, update, delete on tables to authenticated, service_role;
alter default privileges in schema presence_app grant usage, select on sequences to authenticated, service_role;
alter default privileges in schema presence_app grant execute on functions to authenticated, service_role;
