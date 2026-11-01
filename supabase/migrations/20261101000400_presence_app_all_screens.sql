-- Backend de todas as telas: tarefas, dia (rotina/agenda/plano), treino, hábitos e demandas.
-- Tudo no schema presence_app. Modo sem login: dono fixo 00000000-0000-0000-0000-000000000001
-- (veja a migration single_user_mode). Cada tabela tem RLS para `anon` (dono fixo) e para
-- `authenticated` (linhas próprias), então o app já está pronto para o login voltar.

-- ───────────────────────── Tarefas ─────────────────────────
create table presence_app.task_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default '00000000-0000-0000-0000-000000000001',
  slug text not null check (slug ~ '^[a-z0-9_-]{1,40}$'),
  name text not null check (char_length(name) between 1 and 60),
  icon text not null default 'star',
  color text not null default 'cyan' check (color in ('cyan','violet','emerald','amber','rose')),
  position int not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, slug)
);

create table presence_app.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default '00000000-0000-0000-0000-000000000001',
  title text not null check (char_length(title) between 1 and 200),
  description text check (char_length(description) <= 2000),
  category_id uuid references presence_app.task_categories (id) on delete set null,
  priority text not null default 'media' check (priority in ('alta','media','baixa')),
  due_date date,
  due_time time,
  done boolean not null default false,
  done_at timestamptz,
  position int not null default 0,
  source text not null default 'manual' check (source in ('manual','assistente')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index tasks_user_due_idx on presence_app.tasks (user_id, due_date);

-- ───────────────────────── Dia: rotina, plano, agenda ─────────────────────────
-- Rotina-base: o "dia padrão" a partir do qual o planejamento é gerado.
create table presence_app.routine_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default '00000000-0000-0000-0000-000000000001',
  time time not null,
  title text not null check (char_length(title) between 1 and 120),
  description text not null default '' check (char_length(description) <= 300),
  tag text not null default 'Rotina' check (char_length(tag) <= 30),
  color text not null default 'cyan' check (color in ('cyan','violet','emerald','amber','rose')),
  icon text not null default 'star',
  kind text not null default 'habito' check (kind in ('tarefa','compromisso','habito','treino','autocuidado','financeiro','pausa','extra')),
  position int not null default 0,
  created_at timestamptz not null default now()
);

-- Preferências e estado de cada dia planejado.
create table presence_app.day_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default '00000000-0000-0000-0000-000000000001',
  plan_date date not null,
  disposicao text not null default 'normal' check (disposicao in ('alta','normal','baixa')),
  tempo text not null default 'completo' check (tempo in ('completo','manha','tarde','pouco')),
  prioridade text not null default '' check (char_length(prioridade) <= 120),
  pausas boolean not null default true,
  categories text[] not null default '{tarefas,comp,habitos,treino,auto}',
  focus_areas text[] not null default '{Projetos}',
  started_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, plan_date)
);

-- Atividades de um dia (plano gerado + o que a usuária adicionou/editou).
create table presence_app.schedule_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default '00000000-0000-0000-0000-000000000001',
  plan_date date not null,
  time time not null,
  title text not null check (char_length(title) between 1 and 120),
  description text not null default '' check (char_length(description) <= 300),
  tag text not null default 'Rotina' check (char_length(tag) <= 30),
  color text not null default 'cyan' check (color in ('cyan','violet','emerald','amber','rose')),
  icon text not null default 'star',
  kind text not null default 'habito' check (kind in ('tarefa','compromisso','habito','treino','autocuidado','financeiro','pausa','extra')),
  done boolean not null default false,
  position int not null default 0,
  task_id uuid references presence_app.tasks (id) on delete set null,
  created_at timestamptz not null default now()
);
create index schedule_items_day_idx on presence_app.schedule_items (user_id, plan_date, time);

create table presence_app.day_priorities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default '00000000-0000-0000-0000-000000000001',
  plan_date date not null,
  title text not null check (char_length(title) between 1 and 200),
  done boolean not null default false,
  starred boolean not null default false,
  position int not null default 0,
  created_at timestamptz not null default now()
);
create index day_priorities_day_idx on presence_app.day_priorities (user_id, plan_date);

-- ───────────────────────── Treino ─────────────────────────
create table presence_app.workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default '00000000-0000-0000-0000-000000000001',
  name text not null check (char_length(name) between 1 and 80),
  duration_min int not null default 60 check (duration_min between 5 and 300),
  muscles text[] not null default '{}',
  position int not null default 0,
  created_at timestamptz not null default now()
);

create table presence_app.workout_exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default '00000000-0000-0000-0000-000000000001',
  workout_id uuid not null references presence_app.workouts (id) on delete cascade,
  position int not null default 0,
  name text not null check (char_length(name) between 1 and 80),
  muscle text not null default '',
  sets_reps text not null default '3 x 12',
  rest_seconds int not null default 60 check (rest_seconds between 0 and 600),
  instructions text check (char_length(instructions) <= 1000)
);
create index workout_exercises_workout_idx on presence_app.workout_exercises (workout_id, position);

-- Divisão semanal (weekday: 0 = domingo … 6 = sábado).
create table presence_app.workout_split (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default '00000000-0000-0000-0000-000000000001',
  weekday smallint not null check (weekday between 0 and 6),
  title text not null check (char_length(title) between 1 and 80),
  workout_id uuid references presence_app.workouts (id) on delete set null,
  unique (user_id, weekday)
);

create table presence_app.workout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default '00000000-0000-0000-0000-000000000001',
  workout_id uuid references presence_app.workouts (id) on delete set null,
  workout_name text not null,
  session_date date not null default current_date,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  duration_min int check (duration_min between 0 and 1000),
  kcal int check (kcal between 0 and 10000),
  created_at timestamptz not null default now()
);
create index workout_sessions_date_idx on presence_app.workout_sessions (user_id, session_date desc);

create table presence_app.exercise_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default '00000000-0000-0000-0000-000000000001',
  session_id uuid not null references presence_app.workout_sessions (id) on delete cascade,
  exercise_id uuid references presence_app.workout_exercises (id) on delete set null,
  exercise_name text not null,
  done boolean not null default false,
  load_kg numeric(6,2) check (load_kg between 0 and 1000),
  created_at timestamptz not null default now(),
  unique (session_id, exercise_id)
);

alter table presence_app.profiles
  add column weekly_workout_goal int not null default 5 check (weekly_workout_goal between 1 and 14);

-- ───────────────────────── Hábitos ─────────────────────────
create table presence_app.habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default '00000000-0000-0000-0000-000000000001',
  name text not null check (char_length(name) between 1 and 80),
  icon text not null default 'sprout',
  color text not null default 'emerald' check (color in ('cyan','violet','emerald','amber','rose')),
  position int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table presence_app.habit_completions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default '00000000-0000-0000-0000-000000000001',
  habit_id uuid not null references presence_app.habits (id) on delete cascade,
  completed_on date not null,
  created_at timestamptz not null default now(),
  unique (habit_id, completed_on)
);

-- ───────────────────────── Demandas ─────────────────────────
alter table presence_app.demands
  add column priority text not null default 'media' check (priority in ('alta','media','baixa'));

-- ───────────────────────── updated_at ─────────────────────────
create trigger tasks_set_updated_at before update on presence_app.tasks
  for each row execute function presence_app.set_updated_at();
create trigger day_plans_set_updated_at before update on presence_app.day_plans
  for each row execute function presence_app.set_updated_at();

-- ───────────────────────── RLS (todas as tabelas novas) ─────────────────────────
do $$
declare
  t text;
begin
  foreach t in array array[
    'task_categories','tasks','routine_items','day_plans','schedule_items','day_priorities',
    'workouts','workout_exercises','workout_split','workout_sessions','exercise_logs',
    'habits','habit_completions'
  ] loop
    execute format('alter table presence_app.%I enable row level security', t);
    execute format('grant select, insert, update, delete on presence_app.%I to anon, authenticated, service_role', t);
    execute format($p$create policy "sem login: dono fixo" on presence_app.%I for all to anon
      using (user_id = '00000000-0000-0000-0000-000000000001')
      with check (user_id = '00000000-0000-0000-0000-000000000001')$p$, t);
    execute format($p$create policy "dono: linhas próprias" on presence_app.%I for all to authenticated
      using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)$p$, t);
  end loop;
end $$;

-- ───────────────────────── Configuração inicial (não são dados de uso) ─────────────────────────
insert into presence_app.task_categories (slug, name, icon, color, position) values
  ('rotina','Rotina do dia','sun','cyan',1),
  ('comp','Compromissos','calendar','violet',2),
  ('auto','Autocuidado','flower','rose',3),
  ('saude','Saúde & Treino','dumbbell','emerald',4),
  ('trab','Trabalho / Projetos','laptop','cyan',5),
  ('casa','Casa & Organização','home','amber',6),
  ('fin','Financeiro','wallet','amber',7),
  ('pes','Pessoal','heart','violet',8);

insert into presence_app.routine_items (time, title, description, tag, color, icon, kind, position) values
  ('07:00','Rotina da manhã','Higiene • Skincare • Café • Organização','Rotina','emerald','sun','habito',1),
  ('08:00','Leitura 20 min','Hábito diário de leitura','Hábito','emerald','sprout','habito',2),
  ('09:00','Trabalho e demandas','Responder demandas, alinhar pontos e priorizar tarefas.','Foco','violet','laptop','tarefa',3),
  ('12:30','Almoço e pausa','Alimentação, descanso e desconexão.','Pausa','amber','food','pausa',4),
  ('14:00','Projetos da Presence','Avançar nas implementações e revisar pendências.','Projeto','emerald','layers','tarefa',5),
  ('16:30','Treino','Treino do dia','Saúde','violet','dumbbell','treino',6),
  ('18:00','Autocuidado','Banho, cabelo e cuidados pessoais.','Bem-estar','rose','shower','autocuidado',7),
  ('20:00','Tempo livre','Leitura, série ou hobby.','Equilíbrio','emerald','book','habito',8),
  ('22:00','Rotina noturna','Planejar amanhã, skincare e descanso.','Rotina','cyan','moon','habito',9);

with w as (
  insert into presence_app.workouts (name, duration_min, muscles, position) values
    ('Glúteo e Posterior', 60, '{Glúteos,"Posterior de coxa","Lateral da coxa",Adutores}', 1),
    ('Glúteo e Perna', 60, '{Glúteos,Quadríceps,Panturrilha}', 2)
  returning id, name
)
insert into presence_app.workout_exercises (workout_id, position, name, muscle, sets_reps, rest_seconds)
select w.id, e.pos, e.name, e.muscle, e.sets_reps, e.rest
from w
join (values
  ('Glúteo e Posterior', 1, 'Elevação de quadril', 'Máquina / Glúteo', '3 x 12–15', 60),
  ('Glúteo e Posterior', 2, 'Stiff', 'Posterior de coxa', '3 x 10–12', 60),
  ('Glúteo e Posterior', 3, 'Flexora', 'Posterior de coxa', '3 x 12–15', 45),
  ('Glúteo e Posterior', 4, 'Abdutora', 'Glúteo (lateral)', '3 x 15–20', 45),
  ('Glúteo e Posterior', 5, 'Adutora', 'Parte interna da coxa', '3 x 15–20', 45),
  ('Glúteo e Posterior', 6, 'Agachamento máquina', 'Glúteo e quadríceps', '3 x 10–12', 60),
  ('Glúteo e Perna', 1, 'Agachamento livre', 'Quadríceps e glúteo', '4 x 8–10', 90),
  ('Glúteo e Perna', 2, 'Leg press', 'Quadríceps', '3 x 12', 60),
  ('Glúteo e Perna', 3, 'Afundo', 'Glúteo e quadríceps', '3 x 10 cada', 60),
  ('Glúteo e Perna', 4, 'Cadeira extensora', 'Quadríceps', '3 x 15', 45),
  ('Glúteo e Perna', 5, 'Panturrilha em pé', 'Panturrilha', '4 x 15', 45),
  ('Glúteo e Perna', 6, 'Glúteo na polia', 'Glúteo máximo', '3 x 12 cada', 45)
) as e(wname, pos, name, muscle, sets_reps, rest) on e.wname = w.name;

insert into presence_app.workout_split (weekday, title, workout_id)
select s.weekday, s.title, (select id from presence_app.workouts where name = s.wname)
from (values
  (1, 'Glúteo + Posterior', 'Glúteo e Posterior'),
  (2, 'Cardio + Abdômen', null),
  (3, 'Glúteo + Perna', 'Glúteo e Perna'),
  (4, 'Cardio + Superiores (leve)', null),
  (5, 'Glúteo + Posterior', 'Glúteo e Posterior'),
  (6, 'Livre / Mobilidade', null),
  (0, 'Descanso', null)
) as s(weekday, title, wname);
