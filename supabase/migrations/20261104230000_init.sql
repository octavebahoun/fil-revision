-- Fil — schéma initial
-- Chaque table métier porte user_id et est protégée par RLS (user_id = auth.uid()).
-- Les clés étrangères sont composites (id, user_id) pour empêcher de rattacher
-- une ressource à celle d'un autre utilisateur (anti-IDOR, même en écriture).

create extension if not exists pg_trgm with schema extensions;

create schema if not exists private;
revoke all on schema private from public;
revoke all on schema private from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Utilitaires
-- ---------------------------------------------------------------------------
create or replace function private.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- Liste blanche d'inscription (hook Supabase Auth before_user_created)
-- ---------------------------------------------------------------------------
create table private.allowed_emails (
  email text primary key check (email = lower(btrim(email)) and position('@' in email) > 1)
);

create or replace function public.hook_before_user_created(event jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_email text := lower(btrim(coalesce(event -> 'user' ->> 'email', '')));
begin
  if v_email = '' or not exists (select 1 from private.allowed_emails a where a.email = v_email) then
    return jsonb_build_object(
      'error', jsonb_build_object('http_code', 403, 'message', 'signup_not_allowed')
    );
  end if;
  return '{}'::jsonb;
end $$;

revoke execute on function public.hook_before_user_created(jsonb) from public, anon, authenticated;
grant execute on function public.hook_before_user_created(jsonb) to supabase_auth_admin;

-- Synchronisation de la liste blanche (appelée côté serveur avec la clé secrète uniquement)
create or replace function public.admin_set_allowed_emails(p_emails text[]) returns int
language plpgsql security definer set search_path = '' as $$
declare
  n int;
begin
  delete from private.allowed_emails where true;
  insert into private.allowed_emails (email)
  select distinct lower(btrim(e)) from unnest(p_emails) e where btrim(e) <> '';
  get diagnostics n = row_count;
  return n;
end $$;
revoke execute on function public.admin_set_allowed_emails(text[]) from public, anon, authenticated;
grant execute on function public.admin_set_allowed_emails(text[]) to service_role;

-- Ajout unitaire (tests, invitations ponctuelles)
create or replace function public.admin_allow_email(p_email text) returns void
language sql security definer set search_path = '' as $$
  insert into private.allowed_emails (email) values (lower(btrim(p_email))) on conflict do nothing;
$$;
revoke execute on function public.admin_allow_email(text) from public, anon, authenticated;
grant execute on function public.admin_allow_email(text) to service_role;

-- ---------------------------------------------------------------------------
-- Profils et réglages
-- ---------------------------------------------------------------------------
create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (display_name is null or char_length(display_name) <= 80),
  settings jsonb not null default '{}'::jsonb,
  streak jsonb not null default '{"current":0,"best":0,"jokers":1,"lastDay":null}'::jsonb,
  timezone text not null default 'Europe/Paris',
  last_reminder_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger profiles_touch before update on public.profiles
  for each row execute function private.touch_updated_at();

create or replace function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (user_id) values (new.id) on conflict do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.handle_new_user();

-- ---------------------------------------------------------------------------
-- Matières, documents, pages
-- ---------------------------------------------------------------------------
create table public.subjects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 200),
  slug text not null check (slug ~ '^[a-z0-9-]{1,120}$'),
  kind text not null default 'matiere' check (kind in ('matiere', 'ressources')),
  language text not null default 'fr' check (language in ('fr', 'en')),
  is_demo boolean not null default false,
  position int not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, slug),
  unique (id, user_id)
);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  subject_id uuid not null,
  title text not null check (char_length(title) between 1 and 300),
  filename text not null check (char_length(filename) between 1 and 300),
  storage_path text,
  mime text not null,
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 52428800),
  sha256 text not null check (sha256 ~ '^[a-f0-9]{64}$'),
  kind text not null default 'cours' check (kind in ('cours', 'exercice', 'ressource')),
  language text not null default 'fr' check (language in ('fr', 'en')),
  page_count int check (page_count is null or page_count >= 0),
  status text not null default 'uploaded'
    check (status in ('uploaded', 'extracting', 'segmenting', 'generating', 'ready', 'error')),
  error_message text,
  origin text not null default 'upload' check (origin in ('upload', 'import', 'demo')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, sha256),
  unique (id, user_id),
  foreign key (subject_id, user_id) references public.subjects (id, user_id) on delete cascade
);
create index documents_subject_idx on public.documents (subject_id);
create trigger documents_touch before update on public.documents
  for each row execute function private.touch_updated_at();

create table public.document_pages (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  document_id uuid not null,
  page_number int not null check (page_number >= 1),
  language text not null default 'fr' check (language in ('fr', 'en')),
  text text not null,
  tsv tsvector generated always as (
    to_tsvector(case when language = 'en' then 'english'::regconfig else 'french'::regconfig end, text)
  ) stored,
  unique (document_id, page_number),
  foreign key (document_id, user_id) references public.documents (id, user_id) on delete cascade
);
create index document_pages_tsv_idx on public.document_pages using gin (tsv);

-- ---------------------------------------------------------------------------
-- Notions et contenus générés
-- ---------------------------------------------------------------------------
create table public.notions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  document_id uuid not null,
  subject_id uuid not null,
  title text not null check (char_length(title) between 1 and 200),
  pages int[] not null check (cardinality(pages) >= 1),
  position int not null,
  language text not null default 'fr' check (language in ('fr', 'en')),
  source_text text not null,
  content_hash text not null,
  status text not null default 'pending'
    check (status in ('pending', 'generating', 'ready', 'error', 'skipped')),
  error_message text,
  tsv tsvector generated always as (
    setweight(to_tsvector(case when language = 'en' then 'english'::regconfig else 'french'::regconfig end, title), 'A')
    || setweight(to_tsvector(case when language = 'en' then 'english'::regconfig else 'french'::regconfig end, source_text), 'B')
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (document_id, position),
  unique (id, user_id),
  foreign key (document_id, user_id) references public.documents (id, user_id) on delete cascade,
  foreign key (subject_id, user_id) references public.subjects (id, user_id) on delete cascade
);
create index notions_subject_idx on public.notions (subject_id);
create index notions_tsv_idx on public.notions using gin (tsv);
create index notions_title_trgm_idx on public.notions using gin (title extensions.gin_trgm_ops);
create trigger notions_touch before update on public.notions
  for each row execute function private.touch_updated_at();

create table public.cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  notion_id uuid not null,
  subject_id uuid not null,
  document_id uuid not null,
  type text not null check (type in (
    'fiche', 'flashcard', 'qcm', 'vrai_faux', 'reponse_courte', 'code_trou', 'ordre',
    'association', 'vocab', 'phrase', 'code_exercise'
  )),
  content jsonb not null,
  source_pages int[] not null default '{}',
  source_quote text,
  status text not null default 'active' check (status in ('active', 'flagged', 'removed')),
  verified boolean not null default false,
  edited boolean not null default false,
  flag_reason text check (flag_reason is null or char_length(flag_reason) <= 500),
  gen_hash text,
  position int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (notion_id, user_id) references public.notions (id, user_id) on delete cascade,
  foreign key (subject_id, user_id) references public.subjects (id, user_id) on delete cascade,
  foreign key (document_id, user_id) references public.documents (id, user_id) on delete cascade
);
create index cards_notion_idx on public.cards (notion_id);
create index cards_subject_idx on public.cards (subject_id, status);
create trigger cards_touch before update on public.cards
  for each row execute function private.touch_updated_at();

-- État FSRS par carte (créé à la première révision)
create table public.card_states (
  card_id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  due timestamptz not null default now(),
  stability double precision not null default 0,
  difficulty double precision not null default 0,
  elapsed_days int not null default 0,
  scheduled_days int not null default 0,
  learning_steps int not null default 0,
  reps int not null default 0,
  lapses int not null default 0,
  state smallint not null default 0 check (state between 0 and 3),
  last_review timestamptz,
  updated_at timestamptz not null default now(),
  foreign key (card_id, user_id) references public.cards (id, user_id) on delete cascade
);
create index card_states_due_idx on public.card_states (user_id, due);

-- ---------------------------------------------------------------------------
-- Sessions de révision
-- ---------------------------------------------------------------------------
create table public.study_sessions (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  mode text not null check (mode in ('mix', 'fiches', 'flashcards', 'quiz', 'fatigue', 'exam', 'notion')),
  subject_id uuid,
  planned_minutes int not null default 10 check (planned_minutes between 1 and 180),
  items jsonb not null default '[]'::jsonb,
  position int not null default 0 check (position >= 0),
  status text not null default 'active' check (status in ('active', 'done', 'abandoned')),
  stats jsonb not null default '{}'::jsonb,
  timer jsonb,
  started_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  ended_at timestamptz,
  unique (id, user_id),
  foreign key (subject_id, user_id) references public.subjects (id, user_id) on delete cascade
);
create index study_sessions_user_idx on public.study_sessions (user_id, status, updated_at desc);

create table public.reviews (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  card_id uuid not null,
  session_id uuid,
  outcome text not null check (outcome in ('rated', 'absent')),
  rating smallint check (rating between 1 and 4),
  correct boolean,
  answer jsonb,
  state_before jsonb,
  state_after jsonb,
  undone boolean not null default false,
  reviewed_at timestamptz not null,
  created_at timestamptz not null default now(),
  check ((outcome = 'rated') = (rating is not null)),
  foreign key (card_id, user_id) references public.cards (id, user_id) on delete cascade,
  foreign key (session_id, user_id) references public.study_sessions (id, user_id) on delete cascade
);
create index reviews_card_idx on public.reviews (card_id, reviewed_at desc);
create index reviews_user_day_idx on public.reviews (user_id, reviewed_at desc);

-- « J'ai décroché » : événement d'apprentissage, pas une donnée de santé.
create table public.session_events (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  session_id uuid not null,
  type text not null check (type in ('decroche', 'reprise', 'pause')),
  card_id uuid,
  at timestamptz not null,
  foreign key (session_id, user_id) references public.study_sessions (id, user_id) on delete cascade
);

create table public.parking (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  session_id uuid,
  text text not null check (char_length(text) between 1 and 1000),
  done boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Traitements longs (jobs découpés en étapes < 60 s)
-- ---------------------------------------------------------------------------
create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  type text not null check (type in ('ingest_document', 'generate_notion', 'regenerate_card', 'mindmap', 'exercise_guide')),
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'queued' check (status in ('queued', 'running', 'done', 'error', 'cancelled')),
  step text not null default 'start',
  progress int not null default 0,
  total int not null default 0,
  attempts int not null default 0,
  max_attempts int not null default 5,
  run_after timestamptz not null default now(),
  locked_until timestamptz,
  last_error text,
  dedupe_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, dedupe_key)
);
create index jobs_queue_idx on public.jobs (status, run_after);
create trigger jobs_touch before update on public.jobs
  for each row execute function private.touch_updated_at();

create or replace function public.claim_jobs(p_limit int, p_lease_seconds int, p_user uuid default null)
returns setof public.jobs
language sql security definer set search_path = '' as $$
  update public.jobs j
     set status = 'running',
         locked_until = now() + make_interval(secs => p_lease_seconds),
         attempts = j.attempts + 1
   where j.id in (
     select q.id from public.jobs q
      where ((q.status = 'queued' and q.run_after <= now())
          or (q.status = 'running' and q.locked_until < now()))
        and (p_user is null or q.user_id = p_user)
      order by q.created_at
      limit p_limit
      for update skip locked
   )
  returning j.*;
$$;
revoke execute on function public.claim_jobs(int, int, uuid) from public, anon, authenticated;
grant execute on function public.claim_jobs(int, int, uuid) to service_role;

-- ---------------------------------------------------------------------------
-- IA : journal, cache, budget
-- ---------------------------------------------------------------------------
create table public.ai_calls (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  provider text not null,
  model text not null,
  purpose text not null,
  prompt_tokens int not null default 0,
  completion_tokens int not null default 0,
  reasoning_tokens int not null default 0,
  cost_usd numeric(12, 6) not null default 0,
  ok boolean not null,
  error_code text,
  latency_ms int,
  created_at timestamptz not null default now()
);
create index ai_calls_user_day_idx on public.ai_calls (user_id, created_at desc);

create table public.ai_cache (
  user_id uuid not null references auth.users (id) on delete cascade,
  key text not null,
  purpose text not null,
  output jsonb not null,
  created_at timestamptz not null default now(),
  primary key (user_id, key)
);

-- ---------------------------------------------------------------------------
-- Limitation de débit (compteur à fenêtre fixe)
-- ---------------------------------------------------------------------------
create table private.rate_limits (
  key text primary key,
  window_start timestamptz not null,
  count int not null
);

create or replace function public.rate_limit_hit(p_key text, p_max int, p_window_seconds int)
returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_count int;
begin
  insert into private.rate_limits as r (key, window_start, count)
  values (p_key, now(), 1)
  on conflict (key) do update
    set count = case when r.window_start < now() - make_interval(secs => p_window_seconds) then 1 else r.count + 1 end,
        window_start = case when r.window_start < now() - make_interval(secs => p_window_seconds) then now() else r.window_start end
  returning count into v_count;
  return v_count <= p_max;
end $$;
revoke execute on function public.rate_limit_hit(text, int, int) from public, anon, authenticated;
grant execute on function public.rate_limit_hit(text, int, int) to service_role;

-- ---------------------------------------------------------------------------
-- RLS : chaque table, user_id = auth.uid()
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles', 'subjects', 'documents', 'document_pages', 'notions', 'cards', 'card_states',
    'study_sessions', 'reviews', 'session_events', 'parking', 'jobs', 'ai_calls', 'ai_cache'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format('revoke all on public.%I from anon', t);
    execute format(
      'create policy %I on public.%I for select to authenticated using (user_id = (select auth.uid()))',
      t || '_select_own', t);
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (user_id = (select auth.uid()))',
      t || '_insert_own', t);
    execute format(
      'create policy %I on public.%I for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))',
      t || '_update_own', t);
    execute format(
      'create policy %I on public.%I for delete to authenticated using (user_id = (select auth.uid()))',
      t || '_delete_own', t);
  end loop;
end $$;

-- Le journal IA et le cache sont écrits uniquement par le serveur : lecture seule pour l'utilisateur.
drop policy ai_calls_insert_own on public.ai_calls;
drop policy ai_calls_update_own on public.ai_calls;
drop policy ai_calls_delete_own on public.ai_calls;
drop policy ai_cache_insert_own on public.ai_cache;
drop policy ai_cache_update_own on public.ai_cache;

-- ---------------------------------------------------------------------------
-- Stockage privé des documents : <user_id>/<sha256>.<ext>
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documents', 'documents', false, 52428800,
  array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain', 'text/markdown'
  ]
)
on conflict (id) do nothing;

create policy documents_bucket_select_own on storage.objects for select to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy documents_bucket_insert_own on storage.objects for insert to authenticated
  with check (bucket_id = 'documents' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy documents_bucket_update_own on storage.objects for update to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'documents' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy documents_bucket_delete_own on storage.objects for delete to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = (select auth.uid())::text);
