-- Phase 7 : mémoire du planning (rattrapage progressif) et abonnements aux notifications push.
alter table public.profiles add column plan_state jsonb;

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  endpoint text not null unique check (endpoint ~ '^https://'),
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now()
);
alter table public.push_subscriptions enable row level security;
alter table public.push_subscriptions force row level security;
revoke all on public.push_subscriptions from anon;
create policy push_select_own on public.push_subscriptions for select to authenticated using (user_id = (select auth.uid()));
create policy push_insert_own on public.push_subscriptions for insert to authenticated with check (user_id = (select auth.uid()));
create policy push_delete_own on public.push_subscriptions for delete to authenticated using (user_id = (select auth.uid()));

-- Rappels : toutes les 5 minutes, l'app envoie les notifications dont l'heure est venue.
select cron.schedule('fil-reminders', '*/5 * * * *', $$ select private.call_app('/api/cron/reminders'); $$);
