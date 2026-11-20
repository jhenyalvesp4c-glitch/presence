-- Quando a pessoa paga a fatura: null = no vencimento; N = N dias depois do fechamento (0 = no próprio dia do fechamento).
-- Quem paga no fechamento conta o dinheiro saindo nessa data (e no mês do fechamento), nunca na virada do mês.
alter table presence_app.fin_cards add column if not exists pay_after_close smallint check (pay_after_close between 0 and 10);
