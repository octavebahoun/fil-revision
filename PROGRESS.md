# Avancement

## Phase en cours
Phase 1 — Fondations

## Fait
- Next.js 16 + Tailwind 4 + shadcn/ui, tokens sémantiques (clair, sombre, contraste élevé), polices Atkinson / OpenDyslexic.
- Supabase local (CLI 3.0.0), migration initiale : toutes les tables du socle, RLS sur chaque table et sur le bucket `documents`.
- Auth e-mail + mot de passe, réinitialisation, inscription limitée à `ALLOWED_EMAILS` (hook Postgres vérifié : 403 hors liste).
- CSP à nonce, HSTS, frame-ancestors ; limitation de débit en base.
- `scripts/gen-secrets.ts` : VAPID, CRON_SECRET, JOBS_SECRET générés dans `.env`.
- Tests RLS anti-IDOR : 41/41 verts (tables + stockage).

## Tâche suivante
CI GitHub Actions, dépôt privé, premier commit ; puis E2E connexion.

## Problèmes ouverts
- Aucun.
