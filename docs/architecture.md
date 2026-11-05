# Architecture

## Vue d'ensemble

```
Navigateur (PWA)                         Vercel (Next.js 16, région fra1)                 Supabase (eu-central-2)
- pages React (App Router)  ─────────►   - Server Components / Server Actions  ────────►  - Postgres + RLS (user_id = auth.uid())
- IndexedDB : sessions, file d'envoi     - /api/sync (événements d'apprentissage)          - Auth (hook liste blanche before_user_created)
- Service worker : hors ligne, push      - /api/jobs/tick (worker, 300 s max)  ◄────────   - Storage privé « documents » (URL signées 5 min)
- SQLite WASM, iframe isolée (code)      - /api/cron/reminders                ◄────────   - Cron (pg_cron + pg_net) : tick 1 min, rappels 5 min
                                         - DeepSeek / Meta (API compatibles OpenAI)        - Vault : URL de l'app, CRON_SECRET
```

## Flux principaux

- **Ingestion** (`src/lib/ingest`, `src/lib/jobs/handlers/ingest.ts`) : le fichier part directement du navigateur vers le stockage privé (URL d'envoi signée, contourne la limite de 4,5 Mo des fonctions). Job `ingest_document` en étapes < 60 s : `extract` (type réel par magic bytes, empreinte, extraction par page/diapo avec délai maximal, nettoyage) → `segment` (fenêtres de pages → notions, cache par empreinte) → `plan` (estimation du coût ; au-delà du seuil, attente de confirmation) → jobs `generate_notion`.
- **Génération** (`handlers/generate.ts`) : `fiche` (fiche + flashcards [+ vocabulaire]) → `quiz` → `verify` (1. citation exacte + noms propres/chiffres présents dans le document ; 2. relecture par le modèle léger) → jusqu'à 2 nouvelles tentatives de fiche avec la raison du refus → `save`. Les cartes modifiées à la main sont conservées.
- **Jobs** : table `jobs`, réservation `claim_jobs` (`FOR UPDATE SKIP LOCKED`, bail 150 s), nouvelle tentative avec attente exponentielle, pause automatique au plafond IA du jour (reprise à minuit). Déclencheurs : `after()` après un envoi, `/api/jobs/kick` depuis l'écran de suivi, Supabase Cron chaque minute, et la CLI d'import (même code, sans limite de durée).
- **Révision** (`src/lib/review`) : session construite en SQL + TS (`buildSession`), stockée dans `study_sessions`. Côté client, chaque geste est écrit dans IndexedDB puis envoyé dans l'ordre (`/api/sync`, idempotent par identifiant). FSRS est appliqué côté serveur ; l'état d'avant chaque réponse est gardé pour « J'ai décroché ».
- **IA** (`src/lib/ai`) : interface `LlmProvider` (base URL + clé + modèle), routeur principal → secours → simulé, sorties validées par Zod, 2 tentatives par fournisseur, budget quotidien, journal `ai_calls`, cache `ai_cache` (jamais alimenté par le simulé). Le texte des cours est une donnée non fiable entourée de balises à jeton aléatoire.

## Sécurité

- RLS sur chaque table et sur le bucket ; clés étrangères composites `(id, user_id)` ; tests anti-IDOR (41) en local **et en prod**.
- CSP à nonce (`script-src 'strict-dynamic'`, `style-src-elem` à nonce, `frame-ancestors 'none'`), HSTS, `X-Frame-Options`, `Permissions-Policy` (micro limité au site).
- Clés IA et `SUPABASE_SECRET_KEY` côté serveur uniquement ; `pnpm audit:secrets` parcourt le build client.
- Limitation de débit en base (connexion, inscription, IA, envois). Messages d'erreur neutres.
- Code des exercices exécuté uniquement dans le navigateur : SQL dans SQLite WASM, JS/TS dans une iframe `sandbox` (origine opaque, sans cookies) qui lance un Worker arrêté après 3 s. PHP n'est jamais exécuté (relu par l'IA).

## Accessibilité et sécurité neurologique

- Tokens sémantiques uniquement (aucune couleur en dur), thèmes clair/sombre/contraste élevé, thème posé avant le premier rendu (pas de flash).
- Animations limitées à `transform`/`opacity`, ≥ 400 ms pour les célébrations, aucune boucle rapide : `pnpm audit:photo` échoue sur toute boucle < 333 ms touchant l'opacité, la couleur ou la luminosité, et sur `blink`.
- axe (WCAG 2.2 AA) sur chaque écran, mobile et bureau : zéro violation sérieuse ou critique.
