-- Salva demandas do Kanban de uma vez só, numa única transação: apaga as excluídas e grava as novas ou
-- alteradas junto com o andamento por dossiê, o histórico e as observações. Assim, fechar ou recarregar a
-- página no meio de um salvamento nunca deixa uma demanda sem os dados dela.
-- p_items: lista de { demand, executions, history, notes } (as linhas que o app monta).
create or replace function presence_app.save_demands(p_project text, p_items jsonb, p_delete text[])
returns void
language plpgsql
security invoker
set search_path = presence_app, pg_temp
as $$
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

    insert into demand_executions (project_id, code, dossier_name, status, done_on, note, position)
    select p_project, c, e ->> 'dossier_name', e ->> 'status', e ->> 'done_on', coalesce(e ->> 'note', ''), (e ->> 'position')::int
    from jsonb_array_elements(coalesce(it -> 'executions', '[]'::jsonb)) e;

    insert into demand_history (project_id, code, label, text, status, position)
    select p_project, c, coalesce(h ->> 'label', ''), h ->> 'text', h ->> 'status', (h ->> 'position')::int
    from jsonb_array_elements(coalesce(it -> 'history', '[]'::jsonb)) h;

    insert into demand_notes (project_id, code, text, position)
    select p_project, c, n ->> 'text', (n ->> 'position')::int
    from jsonb_array_elements(coalesce(it -> 'notes', '[]'::jsonb)) n;
  end loop;
end;
$$;

grant execute on function presence_app.save_demands(text, jsonb, text[]) to anon, authenticated, service_role;
