-- Verificar demandas no WhatsApp: pedidos já decididos (enviados como demanda ou descartados), para não aparecerem de novo na próxima verificação.
-- Dado pessoal: só o dono vê; sem acesso para `anon`.
create table if not exists presence_app.whatsapp_requests (
  id uuid primary key default gen_random_uuid(), user_id uuid not null default presence_app.owner_id(),
  key text not null, chat_name text not null default '', is_group boolean not null default false, asker text not null default '',
  title text not null check (char_length(title) between 1 and 300), details text not null default '' check (char_length(details) <= 2000), quote text not null default '' check (char_length(quote) <= 1000),
  asked_label text not null default '', deadline date, priority text not null default 'media' check (priority in ('alta','media','baixa')),
  status text not null default 'enviada' check (status in ('enviada','descartada')), created_at timestamptz not null default now(),
  unique (user_id, key)
);
alter table presence_app.whatsapp_requests enable row level security;
drop policy if exists "dono: linhas próprias" on presence_app.whatsapp_requests;
create policy "dono: linhas próprias" on presence_app.whatsapp_requests for all to authenticated using (user_id = (select presence_app.owner_id())) with check (user_id = (select presence_app.owner_id()));
revoke all on presence_app.whatsapp_requests from anon;
grant select, insert, update, delete on presence_app.whatsapp_requests to authenticated;
