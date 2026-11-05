# Avancement

## Phase en cours
Phase 6 — Tuteur et entraînement (démarrage). Phase 5 faite (prod en ligne), phase 3 : relecture et durcissement en cours.

## Fait
- **Phase 1** : Next.js 16, Supabase local, auth limitée à `ALLOWED_EMAILS` (hook Postgres), CSP à nonce, RLS + tests anti-IDOR, CI écrite, dépôt GitHub **privé** (octavebahoun/fil-revision).
- **Phase 2** : upload direct vers le stockage privé, `pnpm import:cours` idempotent, extraction, nettoyage, notions, classement, jobs reprenables. Les 10 PDF importés (simulé), réimport sans doublon.
- **Phase 3** : couche IA (DeepSeek → Meta → simulé), Zod, double vérification + contrôle des noms propres et chiffres inventés, cache, budget, estimation avant génération massive, régénération des cartes signalées, page Coûts IA. Génération réelle sur 3 cours (3 matières, 80 notions) : coût réel 0,83 $. Relecture de 25 fiches : fidèles, 2 exemples inventés trouvés → consignes et contrôles durcis, re-vérification en cours.
- **Phase 4** : sessions FSRS, 3 modes, sauvegarde continue hors ligne, « Où j'en étais ? », « J'ai décroché », confort de lecture, audio, parking, réglages, accueil. **Test « absence simulée » vert** (a révélé et corrigé un blocage de la file d'envoi).
- **Phase 5** : https://fil-revision.vercel.app en ligne (Vercel fra1 + Supabase cloud eu-central-2). Migrations poussées, hook de liste blanche actif (403 hors liste vérifié), Vault + pg_cron, ton compte créé. **RLS vérifiée en prod (41/41)**, **E2E Playwright mobile contre la prod (7/7)**.
- Tests locaux : 148 unitaires/intégration, 7 E2E.

## Tâche suivante
1. Fin de la re-vérification de l'échantillon, puis import + génération des 10 PDF en prod (cache local copié pour ne pas repayer).
2. Phase 6 : tuteur, Feynman, aide guidée aux exercices, examens blancs.

## Problèmes ouverts
- Solde DeepSeek ≈ 5 $ au 2026-11-05 : la génération complète doit passer une seule fois (copie du cache local → prod prévue).
- Prix des modèles non confirmés officiellement : estimation prudente, à recaler avec le solde DeepSeek.
