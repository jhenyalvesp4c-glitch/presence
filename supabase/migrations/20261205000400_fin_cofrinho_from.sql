-- A partir de qual parcela o cofrinho paga (as anteriores saem do seu bolso). Nulo = desde a primeira.
alter table presence_app.fin_plans add column if not exists funded_from integer;
