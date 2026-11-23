-- Agenda a rotina de avisos: a cada minuto o banco chama a rota do servidor com o segredo guardado em push_config.
-- (Se o endereço do app mudar, rode de novo com o endereço novo. Para desligar: select cron.unschedule('orion-push');)
select cron.unschedule(jobid) from cron.job where jobname = 'orion-push';
select cron.schedule(
  'orion-push', '* * * * *',
  $job$ select net.http_post(
    url := 'https://spark-mind-friend-htvx.vercel.app/api/push/cron',
    headers := jsonb_build_object('x-cron-secret', (select c.cron_secret from presence_app.push_config c where c.id = 1), 'content-type', 'application/json'),
    body := '{}'::jsonb,
    timeout_milliseconds := 20000
  ) $job$
);
