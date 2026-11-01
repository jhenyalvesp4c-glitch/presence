-- Expõe o schema presence_app na Data API (PostgREST), mantendo os schemas que
-- já estavam expostos para o assistente virtual (public, graphql_public).
-- ATENÇÃO: esta configuração no banco tem prioridade sobre "Exposed schemas" do painel.
-- Para expor outro schema no futuro, inclua todos os desta lista.
-- Para desfazer: alter role authenticator reset pgrst.db_schemas; notify pgrst, 'reload config';
alter role authenticator set pgrst.db_schemas = 'public, graphql_public, presence_app';
notify pgrst, 'reload config';
