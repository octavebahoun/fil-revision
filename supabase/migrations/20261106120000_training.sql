-- Phase 6 : tuteur « Explique-moi », méthode Feynman, aide guidée aux exercices, examens blancs.

create table public.tutor_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  notion_id uuid,
  title text not null default 'Question' check (char_length(title) <= 200),
  created_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (notion_id, user_id) references public.notions (id, user_id) on delete set null (notion_id)
);

create table public.tutor_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  thread_id uuid not null,
  role text not null check (role in ('user', 'assistant')),
  content text not null check (char_length(content) between 1 and 4000),
  citations jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  foreign key (thread_id, user_id) references public.tutor_threads (id, user_id) on delete cascade
);
create index tutor_messages_thread_idx on public.tutor_messages (thread_id, created_at);

create table public.feynman_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  notion_id uuid not null,
  explanation text not null check (char_length(explanation) between 1 and 4000),
  feedback jsonb,
  created_at timestamptz not null default now(),
  foreign key (notion_id, user_id) references public.notions (id, user_id) on delete cascade
);

create table public.exercise_guides (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  document_id uuid not null,
  steps jsonb not null,
  created_at timestamptz not null default now(),
  unique (document_id),
  unique (id, user_id),
  foreign key (document_id, user_id) references public.documents (id, user_id) on delete cascade
);

create table public.exercise_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  guide_id uuid not null,
  step_index int not null check (step_index >= 0),
  hints_shown int not null default 0 check (hints_shown between 0 and 3),
  answer text check (answer is null or char_length(answer) <= 4000),
  feedback jsonb,
  done boolean not null default false,
  updated_at timestamptz not null default now(),
  unique (guide_id, step_index),
  foreign key (guide_id, user_id) references public.exercise_guides (id, user_id) on delete cascade
);

create table public.mock_exams (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  subject_id uuid not null,
  session_id uuid not null,
  timer_minutes int check (timer_minutes is null or timer_minutes between 5 and 180),
  result jsonb,
  created_at timestamptz not null default now(),
  finished_at timestamptz,
  foreign key (subject_id, user_id) references public.subjects (id, user_id) on delete cascade,
  foreign key (session_id, user_id) references public.study_sessions (id, user_id) on delete cascade
);

do $$
declare
  t text;
begin
  foreach t in array array['tutor_threads', 'tutor_messages', 'feynman_attempts', 'exercise_guides', 'exercise_progress', 'mock_exams'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('create policy %I on public.%I for select to authenticated using (user_id = (select auth.uid()))', t || '_select_own', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (user_id = (select auth.uid()))', t || '_insert_own', t);
    execute format('create policy %I on public.%I for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t || '_update_own', t);
    execute format('create policy %I on public.%I for delete to authenticated using (user_id = (select auth.uid()))', t || '_delete_own', t);
  end loop;
end $$;

-- Recherche dans les cours (plein texte français/anglais + trigrammes sur les titres).
create or replace function public.search_course(p_query text, p_notion uuid default null, p_subject uuid default null, p_limit int default 6)
returns table (notion_id uuid, title text, document_id uuid, pages int[], source_text text, rank real)
language sql stable security invoker set search_path = '' as $$
  with q as (
    select websearch_to_tsquery('french', p_query) as fr, websearch_to_tsquery('english', p_query) as en
  )
  select n.id, n.title, n.document_id, n.pages, n.source_text,
         (ts_rank(n.tsv, q.fr) + ts_rank(n.tsv, q.en) + extensions.similarity(n.title, p_query))::real
  from public.notions n, q
  where n.status = 'ready'
    and (p_subject is null or n.subject_id = p_subject)
    and (
      p_notion = n.id
      or n.tsv @@ q.fr or n.tsv @@ q.en
      or extensions.similarity(n.title, p_query) > 0.2
    )
  order by (n.id = p_notion) desc nulls last, 6 desc
  limit greatest(1, least(p_limit, 20));
$$;
revoke execute on function public.search_course(text, uuid, uuid, int) from anon;
