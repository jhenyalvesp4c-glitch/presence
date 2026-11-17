-- Fecha o "modo sem login": a chave pública do banco (que vai no código do site) NÃO pode mais ler nem mexer nos dados.
-- Só quem está logado (papel authenticated) acessa, e só o que é seu (políticas "dono"). Nada aqui mexe nessas políticas.
do $$ declare r record; begin
  for r in select schemaname, tablename, policyname from pg_policies
           where roles::text = '{anon}'
             and (schemaname = 'presence_app' or (schemaname = 'storage' and tablename = 'objects' and policyname like 'presence-app-%'))
  loop
    execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

revoke all on all tables in schema presence_app from anon;
revoke all on all sequences in schema presence_app from anon;
revoke execute on all functions in schema presence_app from anon, public;
grant execute on function presence_app.owner_id() to authenticated;
grant execute on function presence_app.claim_account(text) to authenticated;
grant execute on function presence_app.save_demands(text, jsonb, text[]) to authenticated;
-- tabelas criadas no futuro também não dão nada ao anon por padrão
alter default privileges in schema presence_app revoke all on tables from anon;
alter default privileges in schema presence_app revoke execute on functions from anon, public;
