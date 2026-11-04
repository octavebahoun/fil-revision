# Fil — réviser ses cours, une chose à la fois

Plateforme de révision pensée pour le TDAH et les absences épileptiques : fiches de 5 lignes, flashcards, quiz, « Où j'en étais ? », « J'ai décroché ».

**Lancer en local** : `pnpm install && pnpm exec supabase start && pnpm env:local && pnpm dev` → http://localhost:3000
**Ajouter un cours** : glisse le fichier dans l'app (Matières → Ajouter), ou `pnpm import:cours <dossier>`.
**Vérifier** : `pnpm verify` (lint, types, tests, audit photosensible) puis `pnpm e2e`.
Guide pas à pas : [GUIDE.md](GUIDE.md) · Architecture et exploitation : [docs/](docs/)

---

Détails à venir (phase 9).
