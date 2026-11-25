-- Meta que desconta da sobra de caixa (reserva do mês), com liga/desliga por meta.
alter table presence_app.fin_goals add column if not exists reserve boolean not null default false;
