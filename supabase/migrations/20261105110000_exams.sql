-- Examens (dates) : utilisés par l'accueil (« prochain examen ») et le planning à rebours.
create table public.exams (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  subject_id uuid not null,
  title text not null check (char_length(title) between 1 and 120),
  exam_date date not null,
  created_at timestamptz not null default now(),
  foreign key (subject_id, user_id) references public.subjects (id, user_id) on delete cascade
);
create index exams_user_date_idx on public.exams (user_id, exam_date);

alter table public.exams enable row level security;
alter table public.exams force row level security;
revoke all on public.exams from anon;
create policy exams_select_own on public.exams for select to authenticated using (user_id = (select auth.uid()));
create policy exams_insert_own on public.exams for insert to authenticated with check (user_id = (select auth.uid()));
create policy exams_update_own on public.exams for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy exams_delete_own on public.exams for delete to authenticated using (user_id = (select auth.uid()));

-- Vue d'ensemble des matières (comptes calculés en base : pas de limite de lignes de l'API).
create or replace function public.subject_overview()
returns table (subject_id uuid, documents int, processing int, notions int)
language sql stable security invoker set search_path = '' as $$
  select s.id,
         (select count(*) from public.documents d where d.subject_id = s.id)::int,
         (select count(*) from public.documents d where d.subject_id = s.id and d.status in ('uploaded', 'extracting', 'segmenting', 'generating'))::int,
         (select count(*) from public.notions n where n.subject_id = s.id and n.status = 'ready')::int
  from public.subjects s;
$$;
revoke execute on function public.subject_overview() from anon;
