-- A fila de pedidos de melhoria é executada automaticamente pelo Claude: só quem está logado pode escrever nela (nada de papel anônimo).
drop policy if exists "sem login: dono fixo" on presence_app.improvement_requests;
revoke all on presence_app.improvement_requests from anon;
grant select, insert, update, delete on presence_app.improvement_requests to authenticated;
