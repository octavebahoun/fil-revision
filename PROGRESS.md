# Avancement

## Phase en cours
Phase 4 — Révision (code écrit, tests E2E à lancer). Phases 1 et 2 faites, phase 3 en cours (génération réelle sur échantillon).

## Fait
- **Phase 1** : Next.js 16, Supabase local, auth limitée à `ALLOWED_EMAILS` (hook Postgres), CSP à nonce, RLS + tests anti-IDOR (41), E2E connexion (4).
- **Phase 2** : upload direct vers le stockage privé, `pnpm import:cours` idempotent, extraction PDF/PPTX/DOCX/TXT/MD, nettoyage (en-têtes, bandeaux de diapo, sommaires), notions, classement cours/exercice/ressource, jobs reprenables (< 60 s par étape, pg_cron + pg_net). Les 10 PDF importés en mode simulé, réimport sans doublon.
- **Phase 3 (partiel)** : couche IA (DeepSeek → Meta → simulé), sorties validées par Zod, double vérification (citation exacte + relecture), cache par empreinte (jamais pour le simulé), budget/jour, journal des coûts, test du PDF piégé.
- **Phase 4 (code)** : session « Réviser maintenant », FSRS, 3 modes, sauvegarde continue (IndexedDB + file d'envoi), « Où j'en étais ? » (45 s / retour onglet / réouverture), « J'ai décroché » (D, annule les erreurs récentes), confort de lecture, audio, parking à pensées, réglages, accueil.
- Tests : 87 unitaires + intégration (RLS, pipeline, synchro) verts.

## Tâche suivante (reprise)
1. `pnpm exec supabase start`, puis `E2E_PROD_BUILD=1 pnpm e2e tests/e2e/session.spec.ts` (le build local est déjà fait).
2. Relancer la génération réelle de l'échantillon : `LOG_LEVEL=warn pnpm import:cours <dossier échantillon>` (le cache garde ce qui est déjà payé), puis relire 20 fiches (section 9.8).
3. Commit, puis phase 5 (mise en ligne).

## Problèmes ouverts
- Dépôt GitHub privé : création refusée par une permission de l'outil → à valider par l'utilisateur.
- Solde DeepSeek ≈ 5 $ au 2026-11-05 : la génération complète doit passer une seule fois (copie du cache local → prod prévue).
- Prix des modèles non confirmés officiellement : estimation prudente, à recaler avec le solde DeepSeek.
