-- Lembretes antes da hora da tarefa: minutos de antecedência (ex.: {30, 60, 2880}). Nulo = sem aviso antecipado.
alter table presence_app.tasks add column if not exists remind_before integer[];
alter table presence_app.tasks drop constraint if exists tasks_remind_before_ok;
alter table presence_app.tasks add constraint tasks_remind_before_ok check (remind_before is null or (cardinality(remind_before) <= 6 and 0 < all (remind_before) and 20160 >= all (remind_before)));
