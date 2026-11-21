-- Pix combinado que ainda não aconteceu: aparece como "aguardando" e não entra na conta até ser confirmado.
alter table presence_app.fin_settlement_items add column if not exists pending boolean not null default false;
