-- Checklist dentro de cada demanda (passos para ir riscando). Só ADICIONA: tabela nova com RLS por dono (sem política para anon)
-- e save_demands passa a gravar também o checklist.
create table presence_app.demand_checklist (
  id bigint generated always as identity primary key,
  user_id uuid not null default presence_app.owner_id(),
  project_id text not null,
  code text not null,
  text text not null check (char_length(text) between 1 and 500),
  done boolean not null default false,
  position int not null default 0,
  foreign key (project_id, code) references presence_app.project_demands (project_id, code) on delete cascade
);
create index demand_checklist_idx on presence_app.demand_checklist (project_id, code, position);

alter table presence_app.demand_checklist enable row level security;
grant select, insert, update, delete on presence_app.demand_checklist to authenticated, service_role;
create policy "dono: linhas próprias" on presence_app.demand_checklist for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create or replace function presence_app.save_demands(p_project text, p_items jsonb, p_delete text[])
 returns void
 language plpgsql
 set search_path to 'presence_app', 'pg_temp'
as $function$
declare
  it jsonb;
  c text;
begin
  if coalesce(array_length(p_delete, 1), 0) > 0 then
    delete from project_demands where project_id = p_project and code = any (p_delete);
  end if;

  for it in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
    c := it -> 'demand' ->> 'code';

    insert into project_demands (project_id, code, type, title, description, priority, status, deadline, dossier_name)
    values (
      p_project, c, it -> 'demand' ->> 'type', it -> 'demand' ->> 'title', coalesce(it -> 'demand' ->> 'description', ''),
      it -> 'demand' ->> 'priority', it -> 'demand' ->> 'status', coalesce(it -> 'demand' ->> 'deadline', ''),
      it -> 'demand' ->> 'dossier_name'
    )
    on conflict (project_id, code) do update set
      type = excluded.type, title = excluded.title, description = excluded.description, priority = excluded.priority,
      status = excluded.status, deadline = excluded.deadline, dossier_name = excluded.dossier_name;

    delete from demand_executions where project_id = p_project and code = c;
    delete from demand_history where project_id = p_project and code = c;
    delete from demand_notes where project_id = p_project and code = c;
    delete from demand_checklist where project_id = p_project and code = c;

    insert into demand_executions (project_id, code, dossier_name, status, done_on, note, position)
    select p_project, c, e ->> 'dossier_name', e ->> 'status', e ->> 'done_on', coalesce(e ->> 'note', ''), (e ->> 'position')::int
    from jsonb_array_elements(coalesce(it -> 'executions', '[]'::jsonb)) e;

    insert into demand_history (project_id, code, label, text, status, position)
    select p_project, c, coalesce(h ->> 'label', ''), h ->> 'text', h ->> 'status', (h ->> 'position')::int
    from jsonb_array_elements(coalesce(it -> 'history', '[]'::jsonb)) h;

    insert into demand_notes (project_id, code, text, position)
    select p_project, c, n ->> 'text', (n ->> 'position')::int
    from jsonb_array_elements(coalesce(it -> 'notes', '[]'::jsonb)) n;

    insert into demand_checklist (project_id, code, text, done, position)
    select p_project, c, k ->> 'text', coalesce((k ->> 'done')::boolean, false), (k ->> 'position')::int
    from jsonb_array_elements(coalesce(it -> 'checklist', '[]'::jsonb)) k;
  end loop;
end;
$function$;
