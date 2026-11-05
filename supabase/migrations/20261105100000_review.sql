-- Fonctions de révision (security invoker : la RLS de l'utilisateur s'applique).

-- Cartes dues (FSRS), hors fiches.
create or replace function public.review_due_cards(p_subject uuid default null, p_notion uuid default null, p_limit int default 300)
returns table (card_id uuid, type text, notion_id uuid, subject_id uuid, due timestamptz, state smallint, stability double precision)
language sql stable security invoker set search_path = '' as $$
  select c.id, c.type, c.notion_id, c.subject_id, s.due, s.state, s.stability
  from public.cards c
  join public.card_states s on s.card_id = c.id
  where c.status = 'active'
    and c.type not in ('fiche', 'code_exercise')
    and s.due <= now()
    and (p_subject is null or c.subject_id = p_subject)
    and (p_notion is null or c.notion_id = p_notion)
  order by s.due
  limit greatest(1, least(p_limit, 1000));
$$;

-- Notions jamais étudiées (aucune carte avec un état FSRS), dans l'ordre du cours.
create or replace function public.review_new_notions(p_subject uuid default null, p_limit int default 40)
returns table (notion_id uuid, subject_id uuid, document_id uuid, title text, fiche_id uuid)
language sql stable security invoker set search_path = '' as $$
  select n.id, n.subject_id, n.document_id, n.title,
         (select f.id from public.cards f where f.notion_id = n.id and f.type = 'fiche' and f.status = 'active' limit 1)
  from public.notions n
  join public.documents d on d.id = n.document_id
  where n.status = 'ready'
    and d.kind <> 'exercice'
    and (p_subject is null or n.subject_id = p_subject)
    and not exists (
      select 1 from public.cards c join public.card_states s on s.card_id = c.id where c.notion_id = n.id
    )
    and exists (select 1 from public.cards c where c.notion_id = n.id and c.status = 'active' and c.type <> 'fiche')
  order by d.created_at, n.position
  limit greatest(1, least(p_limit, 500));
$$;

-- Cartes « faciles que je connais déjà » (mode Fatigué).
create or replace function public.review_easy_cards(p_subject uuid default null, p_limit int default 60)
returns table (card_id uuid, type text, notion_id uuid, subject_id uuid)
language sql stable security invoker set search_path = '' as $$
  select c.id, c.type, c.notion_id, c.subject_id
  from public.cards c
  join public.card_states s on s.card_id = c.id
  where c.status = 'active'
    and c.type in ('flashcard', 'vrai_faux', 'qcm', 'vocab', 'phrase')
    and s.state = 2
    and s.stability >= 2
    and s.lapses <= 1
    and (p_subject is null or c.subject_id = p_subject)
    and coalesce((select r.rating from public.reviews r where r.card_id = c.id and r.outcome = 'rated' and not r.undone order by r.reviewed_at desc limit 1), 3) >= 3
  order by s.stability desc
  limit greatest(1, least(p_limit, 300));
$$;

-- Maîtrise par matière : part des cartes révisables en état « Révision » et à jour.
create or replace function public.subject_mastery()
returns table (subject_id uuid, total int, known int, due int)
language sql stable security invoker set search_path = '' as $$
  select c.subject_id,
         count(*)::int,
         count(*) filter (where s.state = 2 and (s.due > now() or s.stability >= 3))::int,
         count(*) filter (where s.due <= now())::int
  from public.cards c
  left join public.card_states s on s.card_id = c.id
  where c.status = 'active' and c.type not in ('fiche', 'code_exercise')
  group by c.subject_id;
$$;

-- Jours de révision (pour la série) : jours distincts avec au moins une réponse, heure de Paris.
create or replace function public.study_days(p_since date)
returns table (day date)
language sql stable security invoker set search_path = '' as $$
  select distinct (r.reviewed_at at time zone 'Europe/Paris')::date
  from public.reviews r
  where r.reviewed_at >= (p_since::timestamp at time zone 'Europe/Paris')
  order by 1;
$$;

revoke execute on function public.review_due_cards(uuid, uuid, int) from anon;
revoke execute on function public.review_new_notions(uuid, int) from anon;
revoke execute on function public.review_easy_cards(uuid, int) from anon;
revoke execute on function public.subject_mastery() from anon;
revoke execute on function public.study_days(date) from anon;
