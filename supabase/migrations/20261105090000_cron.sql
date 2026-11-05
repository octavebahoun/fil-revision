-- Planificateur : Supabase Cron (pg_cron) appelle le worker de jobs chaque minute via pg_net.
-- Compatible avec l'offre gratuite (Vercel Hobby ne permet qu'un cron quotidien).
-- Les URL et secrets sont lus dans Supabase Vault ; sans eux, la tâche ne fait rien.

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

create or replace function private.call_app(p_path text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_url text;
  v_secret text;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'app_url' limit 1;
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'cron_secret' limit 1;
  if v_url is null or v_secret is null then
    return;
  end if;
  perform net.http_post(
    url := rtrim(v_url, '/') || p_path,
    headers := jsonb_build_object('Authorization', 'Bearer ' || v_secret, 'Content-Type', 'application/json'),
    body := '{}'::jsonb,
    timeout_milliseconds := 5000
  );
end $$;

revoke execute on function private.call_app(text) from public, anon, authenticated;

-- Le worker ne tourne que s'il reste des jobs prêts : pas d'appel inutile.
create or replace function private.tick_jobs() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if exists (
    select 1 from public.jobs
    where (status = 'queued' and run_after <= now()) or (status = 'running' and locked_until < now())
  ) then
    perform private.call_app('/api/jobs/tick');
  end if;
end $$;

select cron.schedule('fil-jobs-tick', '* * * * *', $$ select private.tick_jobs(); $$);

-- Ménage : journal pg_net et historique cron (évite de remplir l'offre gratuite).
select cron.schedule('fil-cleanup', '17 3 * * *', $$
  delete from net._http_response where created < now() - interval '1 day';
  delete from cron.job_run_details where end_time < now() - interval '3 days';
  delete from private.rate_limits where window_start < now() - interval '1 day';
$$);
