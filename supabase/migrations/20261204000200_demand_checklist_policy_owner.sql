-- Correção: a política do checklist usava auth.uid(), mas o dono dos dados é presence_app.owner_id() (a conta principal tem owner_id fixo
-- diferente do uid do login). Igual às outras tabelas de demandas. Sem acesso para anon.
drop policy if exists "dono: linhas próprias" on presence_app.demand_checklist;
create policy "dono: linhas próprias" on presence_app.demand_checklist for all to authenticated
  using (user_id = (select presence_app.owner_id())) with check (user_id = (select presence_app.owner_id()));
revoke all on presence_app.demand_checklist from anon;
