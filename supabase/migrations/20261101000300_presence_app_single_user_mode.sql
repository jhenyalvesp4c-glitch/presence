-- MODO TEMPORÁRIO SEM LOGIN (desenvolvimento).
-- Enquanto o app não tem login, todos os dados pertencem a um dono fixo
-- (00000000-0000-0000-0000-000000000001) e o papel `anon` pode ler/gravar SOMENTE as linhas dele.
-- As policies de `authenticated` continuam existindo e não são afetadas.
--
-- ATENÇÃO: a chave publishable vai no navegador, então qualquer pessoa com a URL do app
-- consegue ler e gravar esses dados. Não publique com dados reais antes de reativar o login.
--
-- Para voltar ao modo com login:
--   drop policy "sem login: ..." (as 3 abaixo, por tabela);
--   revoke all on all tables in schema presence_app from anon;
--   reatribua o user_id das linhas do dono fixo para o id real em auth.users e recrie as FKs:
--   alter table presence_app.profiles add constraint profiles_id_fkey foreign key (id) references auth.users (id) on delete cascade;
--   (idem assistant_messages_user_id_fkey e demands_user_id_fkey em user_id).

alter table presence_app.profiles drop constraint if exists profiles_id_fkey;
alter table presence_app.assistant_messages drop constraint if exists assistant_messages_user_id_fkey;
alter table presence_app.demands drop constraint if exists demands_user_id_fkey;

alter table presence_app.assistant_messages alter column user_id set default '00000000-0000-0000-0000-000000000001';
alter table presence_app.demands alter column user_id set default '00000000-0000-0000-0000-000000000001';

insert into presence_app.profiles (id, display_name)
values ('00000000-0000-0000-0000-000000000001', 'Jheny')
on conflict (id) do nothing;

grant select, insert, update, delete on presence_app.profiles, presence_app.assistant_messages, presence_app.demands to anon;

create policy "sem login: perfil fixo" on presence_app.profiles
  for all to anon
  using (id = '00000000-0000-0000-0000-000000000001')
  with check (id = '00000000-0000-0000-0000-000000000001');
create policy "sem login: mensagens do dono fixo" on presence_app.assistant_messages
  for all to anon
  using (user_id = '00000000-0000-0000-0000-000000000001')
  with check (user_id = '00000000-0000-0000-0000-000000000001');
create policy "sem login: demandas do dono fixo" on presence_app.demands
  for all to anon
  using (user_id = '00000000-0000-0000-0000-000000000001')
  with check (user_id = '00000000-0000-0000-0000-000000000001');
