-- Financeiro: gasto dividido com outra pessoa ({"person": "Nome", "percent": 50}). A parte dela vira "receita a receber".
alter table presence_app.fin_transactions add column if not exists shared jsonb;
alter table presence_app.fin_plans add column if not exists shared jsonb;
alter table presence_app.fin_recurring add column if not exists shared jsonb;
