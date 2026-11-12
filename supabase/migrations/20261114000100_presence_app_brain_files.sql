-- Segundo cérebro: título, arquivos anexos (Storage), texto extraído por IA e "espelhos" da Documentação.
--  * source 'documentacao' = espelho de algo da aba Documentação (logins sem senha, documentos criados); ref_id identifica qual.
--  * attachments: [{ path, name, mime, size }] no bucket privado presence-app-brain-files.
--  * ai_summary: texto lido do print/PDF/arquivo (para a pesquisa do Orion achar o conteúdo).
alter table presence_app.brain_entries
  add column title text not null default '' check (char_length(title) <= 200),
  add column ref_id text null check (char_length(ref_id) <= 200),
  add column ai_summary text not null default '' check (char_length(ai_summary) <= 20000),
  add column attachments jsonb not null default '[]'::jsonb;
alter table presence_app.brain_entries drop constraint brain_entries_source_check;
alter table presence_app.brain_entries add constraint brain_entries_source_check check (source in ('orion','assistente','documentacao'));
alter table presence_app.brain_entries add constraint brain_entries_user_ref_key unique (user_id, ref_id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('presence-app-brain-files', 'presence-app-brain-files', false, 26214400, null)
on conflict (id) do nothing;

create policy "presence-app-brain-files: sem login ler" on storage.objects for select to anon
  using (bucket_id = 'presence-app-brain-files' and (storage.foldername(name))[1] = '00000000-0000-0000-0000-000000000001');
create policy "presence-app-brain-files: sem login enviar" on storage.objects for insert to anon
  with check (bucket_id = 'presence-app-brain-files' and (storage.foldername(name))[1] = '00000000-0000-0000-0000-000000000001');
create policy "presence-app-brain-files: sem login trocar" on storage.objects for update to anon
  using (bucket_id = 'presence-app-brain-files' and (storage.foldername(name))[1] = '00000000-0000-0000-0000-000000000001')
  with check (bucket_id = 'presence-app-brain-files' and (storage.foldername(name))[1] = '00000000-0000-0000-0000-000000000001');
create policy "presence-app-brain-files: sem login apagar" on storage.objects for delete to anon
  using (bucket_id = 'presence-app-brain-files' and (storage.foldername(name))[1] = '00000000-0000-0000-0000-000000000001');
create policy "presence-app-brain-files: dono" on storage.objects for all to authenticated
  using (bucket_id = 'presence-app-brain-files' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'presence-app-brain-files' and (storage.foldername(name))[1] = (select auth.uid())::text);
