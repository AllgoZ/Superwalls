-- Release expired stock holds every minute, independent of traffic.
-- If pg_cron cannot be enabled (permissions / plan), expiry still happens lazily on every checkout
-- and via GET /api/cron/expire-reservations; this migration then only emits a notice.
do $$
begin
  create extension if not exists pg_cron;
  perform cron.unschedule(jobid) from cron.job where jobname = 'superwalls-expire-reservations';
  perform cron.schedule('superwalls-expire-reservations', '* * * * *', 'select public.expire_reservations()');
exception when others then
  raise notice 'pg_cron not enabled (%): relying on lazy expiry + the cron route', sqlerrm;
end $$;
