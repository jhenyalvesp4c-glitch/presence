-- Saúde → Análise: preferências da tela (período, medidas escondidas) e metas de peso e de cintura, na conta.
alter table presence_app.profiles
  add column if not exists analysis_period text check (analysis_period in ('30','90','180','365','all')),
  add column if not exists analysis_hidden text[] not null default '{}',
  add column if not exists goal_weight_kg numeric(5,1) check (goal_weight_kg > 20 and goal_weight_kg < 400),
  add column if not exists goal_waist_cm numeric(5,1) check (goal_waist_cm > 30 and goal_waist_cm < 250);
