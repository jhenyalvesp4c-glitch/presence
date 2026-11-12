-- Integração MCP (ChatGPT e outros assistentes): camada adicional, sem módulos paralelos.
-- 1) Vínculos entre registros que já existem (tarefas/compromissos/lembretes):
--      tasks.demand_code      -> código da demanda do Kanban (#G041) do mesmo projeto (tasks.project_id)
--      tasks.related_task_id  -> outro registro (ex.: o lembrete aponta para o compromisso)
--      tasks.kind             -> 'tarefa' (padrão) ou 'lembrete'
--      tasks.source           -> ganha o valor 'mcp' (origem: assistente externo via MCP)
-- 2) mcp_proposals: propostas aguardando confirmação (nada é gravado nos módulos antes do "confirmar").
-- 3) mcp_operations: histórico de tudo que o MCP gravou ou desfez.
alter table presence_app.tasks
  add column if not exists demand_code text check (demand_code is null or char_length(demand_code) <= 20),
  add column if not exists related_task_id uuid references presence_app.tasks (id) on delete set null,
  add column if not exists kind text not null default 'tarefa' check (kind in ('tarefa','lembrete'));

alter table presence_app.tasks drop constraint if exists tasks_source_check;
alter table presence_app.tasks add constraint tasks_source_check check (source in ('manual','assistente','mcp'));

create index if not exists tasks_demand_idx on presence_app.tasks (project_id, demand_code) where demand_code is not null;
create index if not exists tasks_related_idx on presence_app.tasks (related_task_id) where related_task_id is not null;

create table presence_app.mcp_proposals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default '00000000-0000-0000-0000-000000000001',
  client text not null default '' check (char_length(client) <= 120),
  code text not null check (code ~ '^[0-9]{4}$'),
  status text not null default 'pendente' check (status in ('pendente','confirmada','cancelada','expirada')),
  records jsonb not null,
  summary text not null default '',
  warnings jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '30 minutes',
  confirmed_at timestamptz
);
create index mcp_proposals_status_idx on presence_app.mcp_proposals (status, created_at desc);

create table presence_app.mcp_operations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default '00000000-0000-0000-0000-000000000001',
  proposal_id uuid references presence_app.mcp_proposals (id) on delete set null,
  kind text not null check (kind in ('criacao','desfazer')),
  status text not null check (status in ('ok','parcial','erro','desfeita')),
  client text not null default '' check (char_length(client) <= 120),
  summary text not null default '',
  created jsonb not null default '[]'::jsonb,
  error text,
  created_at timestamptz not null default now()
);
create index mcp_operations_created_idx on presence_app.mcp_operations (created_at desc);

do $$
declare
  t text;
begin
  foreach t in array array['mcp_proposals','mcp_operations'] loop
    execute format('alter table presence_app.%I enable row level security', t);
    execute format('grant select, insert, update, delete on presence_app.%I to anon, authenticated, service_role', t);
    execute format($p$create policy "sem login: dono fixo" on presence_app.%I for all to anon
      using (user_id = '00000000-0000-0000-0000-000000000001')
      with check (user_id = '00000000-0000-0000-0000-000000000001')$p$, t);
    execute format($p$create policy "dono: linhas próprias" on presence_app.%I for all to authenticated
      using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)$p$, t);
  end loop;
end $$;
