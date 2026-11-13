-- Trava dos avisos de lembrete: o primeiro aparelho que percebe um lembrete "reserva" o aviso falado,
-- assim, com o Presence aberto em dois lugares, só um fala (e fala todos os lembretes do horário de uma vez).
create table if not exists presence_app.reminder_alerts (
  user_id uuid not null default presence_app.owner_id(),
  task_id uuid not null,
  due_key text not null,
  claimed_at timestamptz not null default now(),
  primary key (user_id, task_id, due_key)
);
alter table presence_app.reminder_alerts enable row level security;
drop policy if exists "dono: linhas próprias" on presence_app.reminder_alerts;
create policy "dono: linhas próprias" on presence_app.reminder_alerts for all to authenticated
  using (user_id = (select presence_app.owner_id())) with check (user_id = (select presence_app.owner_id()));
drop policy if exists "sem login: dono fixo" on presence_app.reminder_alerts;
create policy "sem login: dono fixo" on presence_app.reminder_alerts for all to anon
  using (user_id = '00000000-0000-0000-0000-000000000001'::uuid) with check (user_id = '00000000-0000-0000-0000-000000000001'::uuid);
grant select, insert, update, delete on presence_app.reminder_alerts to anon, authenticated;
create index if not exists reminder_alerts_claimed_idx on presence_app.reminder_alerts (claimed_at);
