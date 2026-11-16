-- Pedidos de melhoria feitos ao Orion por conversa: quando ele não consegue fazer algo, monta o pedido,
-- a pessoa confirma na tela e ele fica aqui, na fila, para o Claude implementar.
create table if not exists presence_app.improvement_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default presence_app.owner_id(),
  title text not null,
  request text not null default '',
  details text not null default '',
  area text not null default '',
  status text not null default 'na_fila' check (status in ('na_fila','em_andamento','feito','cancelado')),
  claude_note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists improvement_requests_user_idx on presence_app.improvement_requests (user_id, created_at desc);
alter table presence_app.improvement_requests enable row level security;
drop policy if exists "dono: linhas próprias" on presence_app.improvement_requests;
create policy "dono: linhas próprias" on presence_app.improvement_requests for all to authenticated
  using (user_id = (select presence_app.owner_id())) with check (user_id = (select presence_app.owner_id()));
drop policy if exists "sem login: dono fixo" on presence_app.improvement_requests;
create policy "sem login: dono fixo" on presence_app.improvement_requests for all to anon
  using (user_id = '00000000-0000-0000-0000-000000000001'::uuid) with check (user_id = '00000000-0000-0000-0000-000000000001'::uuid);
grant select, insert, update, delete on presence_app.improvement_requests to anon, authenticated;
