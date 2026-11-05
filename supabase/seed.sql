-- ============================================================================
-- JEU DE DÉMONSTRATION (Supabase LOCAL uniquement — jamais poussé en production)
-- Compte : demo@fil.demo / Demo-fil-2026   ·   Toutes les données sont marquées [DÉMO].
-- ============================================================================

do $$
declare
  v_user uuid := '00000000-0000-4000-8000-00000000d3e0';
  v_subject uuid := '00000000-0000-4000-8000-00000000d3e1';
  v_doc uuid := '00000000-0000-4000-8000-00000000d3e2';
  v_n1 uuid := '00000000-0000-4000-8000-00000000d3f1';
  v_n2 uuid := '00000000-0000-4000-8000-00000000d3f2';
  v_n3 uuid := '00000000-0000-4000-8000-00000000d3f3';
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token
  ) values (
    '00000000-0000-0000-0000-000000000000', v_user, 'authenticated', 'authenticated', 'demo@fil.demo',
    extensions.crypt('Demo-fil-2026', extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', '{"demo":true}', now(), now(), '', '', '', ''
  );
  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), v_user, v_user::text, jsonb_build_object('sub', v_user::text, 'email', 'demo@fil.demo'), 'email', now(), now(), now());

  insert into public.subjects (id, user_id, name, slug, is_demo)
  values (v_subject, v_user, '[DÉMO] Bases de données', 'demo-bases-de-donnees', true);

  insert into public.documents (id, user_id, subject_id, title, filename, mime, size_bytes, sha256, kind, page_count, status, origin)
  values (v_doc, v_user, v_subject, '[DÉMO] Introduction aux bases de données', 'demo-bdd.pdf', 'application/pdf', 1024,
          'de30de30de30de30de30de30de30de30de30de30de30de30de30de30de30de30', 'cours', 3, 'ready', 'demo');

  insert into public.document_pages (user_id, document_id, page_number, text) values
    (v_user, v_doc, 1, 'La clé primaire. Une clé primaire identifie de façon unique chaque ligne d''une table. Par exemple, le numéro étudiant identifie chaque étudiant.'),
    (v_user, v_doc, 2, 'La clé étrangère. Une clé étrangère est une colonne qui fait référence à la clé primaire d''une autre table. Elle garantit l''intégrité référentielle.'),
    (v_user, v_doc, 3, 'La normalisation. La normalisation organise les tables pour éviter les redondances. La première forme normale impose des valeurs atomiques.');

  insert into public.notions (id, user_id, document_id, subject_id, title, pages, position, source_text, content_hash, status) values
    (v_n1, v_user, v_doc, v_subject, 'La clé primaire', '{1}', 0, '[p. 1]' || chr(10) || 'Une clé primaire identifie de façon unique chaque ligne d''une table. Par exemple, le numéro étudiant identifie chaque étudiant.', 'demo-n1', 'ready'),
    (v_n2, v_user, v_doc, v_subject, 'La clé étrangère', '{2}', 1, '[p. 2]' || chr(10) || 'Une clé étrangère est une colonne qui fait référence à la clé primaire d''une autre table. Elle garantit l''intégrité référentielle.', 'demo-n2', 'ready'),
    (v_n3, v_user, v_doc, v_subject, 'La normalisation', '{3}', 2, '[p. 3]' || chr(10) || 'La normalisation organise les tables pour éviter les redondances. La première forme normale impose des valeurs atomiques.', 'demo-n3', 'ready');

  insert into public.cards (user_id, notion_id, subject_id, document_id, type, content, source_pages, source_quote, verified, position) values
    (v_user, v_n1, v_subject, v_doc, 'fiche', '{"title":"La clé primaire","explanation":"Une clé primaire identifie de façon unique chaque ligne d''une table.","example":"Le numéro étudiant identifie chaque étudiant.","question":"Que garantit une clé primaire ?","answer":"Chaque ligne est identifiée de façon unique.","more":""}', '{1}', 'Une clé primaire identifie de façon unique chaque ligne d''une table.', true, 0),
    (v_user, v_n1, v_subject, v_doc, 'flashcard', '{"front":"Que fait une clé primaire ?","back":"Elle identifie de façon unique chaque ligne d''une table."}', '{1}', 'Une clé primaire identifie de façon unique chaque ligne d''une table.', true, 1),
    (v_user, v_n1, v_subject, v_doc, 'vrai_faux', '{"statement":"Le numéro étudiant peut servir de clé primaire.","answer":true,"explanation":"Le cours le donne en exemple : il identifie chaque étudiant."}', '{1}', 'le numéro étudiant identifie chaque étudiant', true, 2),
    (v_user, v_n2, v_subject, v_doc, 'fiche', '{"title":"La clé étrangère","explanation":"Une clé étrangère fait référence à la clé primaire d''une autre table.","example":"Elle garantit l''intégrité référentielle entre deux tables.","question":"À quoi fait référence une clé étrangère ?","answer":"À la clé primaire d''une autre table.","more":""}', '{2}', 'Une clé étrangère est une colonne qui fait référence à la clé primaire d''une autre table.', true, 0),
    (v_user, v_n2, v_subject, v_doc, 'qcm', '{"question":"Que garantit une clé étrangère ?","choices":["L''intégrité référentielle","La vitesse des requêtes","Le chiffrement des données"],"answerIndex":0,"explanation":"Le cours précise qu''elle garantit l''intégrité référentielle."}', '{2}', 'Elle garantit l''intégrité référentielle.', true, 1),
    (v_user, v_n3, v_subject, v_doc, 'fiche', '{"title":"La normalisation","explanation":"La normalisation organise les tables pour éviter les redondances.","example":"La première forme normale impose des valeurs atomiques.","question":"Pourquoi normaliser une base ?","answer":"Pour éviter les redondances.","more":""}', '{3}', 'La normalisation organise les tables pour éviter les redondances.', true, 0),
    (v_user, v_n3, v_subject, v_doc, 'reponse_courte', '{"question":"Quelle forme normale impose des valeurs atomiques ?","answers":["la première","première forme normale","1FN"],"explanation":"C''est la première forme normale."}', '{3}', 'La première forme normale impose des valeurs atomiques.', true, 1);
end $$;
