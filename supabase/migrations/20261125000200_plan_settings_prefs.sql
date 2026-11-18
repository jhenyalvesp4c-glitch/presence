-- O que o Orion aprendeu sobre a rotina (horários preferidos de hábitos, limite de tarefas por dia, horário de pico).
alter table presence_app.plan_settings add column if not exists prefs jsonb not null default '{}'::jsonb;
