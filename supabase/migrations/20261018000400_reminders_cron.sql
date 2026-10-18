-- Καθημερινή αποστολή υπενθυμίσεων: pg_cron -> Edge Function "send-reminders".
-- ΠΡΙΝ το τρέξεις, φτιάξε το secret στο vault (μία φορά, με δική σου τιμή):
--   select vault.create_secret('<ΤΟ_REMINDER_CRON_SECRET_ΣΟΥ>', 'reminder_cron_secret');
-- Η ίδια τιμή πρέπει να οριστεί και ως secret της function (REMINDER_CRON_SECRET).
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'send-reminders',
  '0 7 * * *', -- 07:00 UTC = 09:00-10:00 ώρα Ελλάδας
  $$
  select net.http_post(
    url := 'https://tqeaszksjvdjrztixyxp.supabase.co/functions/v1/send-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'reminder_cron_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);
