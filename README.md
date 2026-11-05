# Fil — réviser ses cours, une chose à la fois

Fil transforme tes cours (PDF, PPTX, DOCX, TXT, MD) en fiches de 5 lignes, flashcards et quiz, pensés pour le TDAH et les absences épileptiques.
**En ligne** : https://fil-revision.vercel.app (inscription limitée aux adresses de `ALLOWED_EMAILS`).
**Lancer en local** : `pnpm install && pnpm exec supabase start && pnpm env:local && pnpm dev` → http://localhost:3000
**Ajouter un cours** : Matières → une matière → « Ajouter un cours » (glisser-déposer), ou `pnpm import:cours <dossier> [--prod] [--yes]`.
**Vérifier** : `pnpm verify` (lint, types, format, tests, audit photosensible), puis `pnpm e2e`.
Pas à pas : [GUIDE.md](GUIDE.md) · Architecture : [docs/architecture.md](docs/architecture.md) · Exploitation : [docs/exploitation.md](docs/exploitation.md)

---

## Ce qu'on y trouve

- **Réviser maintenant (10 min)** : un seul bouton, la session choisit pour toi (cartes dues FSRS + nouvelles notions).
- **« Où j'en étais ? »** (retour sur l'onglet, réouverture, 45 s d'inactivité) et **« J'ai décroché »** (touche `D`) : une absence n'est jamais comptée comme une erreur.
- Trois modes (fiches, flashcards, quiz), mode Fatigué, examens blancs, tuteur « Explique-moi », méthode Feynman (dictée), aide guidée aux énoncés, exercices de code (SQL, JS/TS, PHP), planning d'examens à rebours, rappels push, cartes mentales, exports PDF et Anki, hors ligne complet (PWA).
- Confort : Atkinson Hyperlegible ou OpenDyslexic, taille et interligne réglables, règle de lecture, thèmes clair/sombre/contraste élevé, animations normales/réduites/aucune, lecture audio.

## Commandes utiles

| Commande | Rôle |
|---|---|
| `pnpm dev` | serveur de développement (Supabase local requis) |
| `pnpm build && pnpm start` / `pnpm build:local && pnpm start:local` | build de production (cloud / local) |
| `pnpm test` · `pnpm test:coverage` | tests unitaires et d'intégration (Postgres réel de Supabase local) |
| `pnpm e2e` | Playwright (mobile Pixel 7 ; `E2E_ALL_DEVICES=1` ajoute le bureau ; `E2E_PROD_BUILD=1` sur le build) |
| `pnpm audit:photo` · `pnpm audit:secrets` · `pnpm audit:content` | audits photosensible, secrets du build client, contenu généré |
| `pnpm import:cours <dossier>` | import en masse idempotent (`--prod` pour la prod, `--yes` pour confirmer le coût) |
| `pnpm db:reset` · `pnpm db:types` | base locale propre + liste blanche ; types TypeScript |
| `pnpm gen:secrets` · `pnpm setup:prod --url …` · `pnpm vercel:env --url …` | secrets internes ; configuration Supabase cloud ; variables Vercel |

## Pile

Next.js 16 (App Router) · TypeScript strict · Tailwind 4 · shadcn/ui · Supabase (Postgres, Auth, Storage, RLS, Cron) · ts-fsrs · DeepSeek (principal) / Meta (secours) / simulé · Vercel.
