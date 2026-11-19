-- Acerto de contas: divisão padrão (% que fica com a outra pessoa) para as contas da casa.
alter table presence_app.fin_settlements add column if not exists default_share smallint check (default_share between 0 and 100);
