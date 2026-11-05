# Avancement

## Phase en cours
Phase 9 — Release terminée. Dernière version en production (2026-11-05) ; seule la génération des cours se poursuit automatiquement chaque nuit.

## Fait
- **Phases 1 à 8** : voir RELEASE_NOTES.md (périmètre complet de la section 5).
- **Prod** : https://fil-revision.vercel.app (version finale), compte créé, migrations à jour, crons actifs (traitements 1 min, rappels 5 min, ménage nuit). **RLS 41/41 et E2E 10/10 contre la prod** (connexion, absence simulée, J'ai décroché, mode avion, exercices de code) ; comptes de test supprimés. 15 vrais cours importés (22 faux fichiers d'un projet Python retirés, import corrigé). Génération : 150 notions prêtes / 485, 1 181 cartes ; reprise automatique chaque nuit (plafond 2 $/jour).
- **Section 9** : lint/types/format OK, 179 tests (couverture 93,9 %), 14 E2E dont absence simulée et mode avion, axe 0 violation sérieuse sur 24 écrans (mobile + bureau), audit photosensible OK, aucun secret dans le build, `pnpm audit --prod` propre, démarrage à froid OK, relecture de 25 fiches + `audit:content` (0 problème), CI verte.

## Tâche suivante
1. Surveiller la fin de la génération en prod (solde DeepSeek ≈ 2,96 $), puis `pnpm audit:content --prod`.

## Problèmes ouverts
- Solde DeepSeek juste suffisant pour finir la génération (≈ 2,7 $ estimés restants).
- E-mails Auth en anglais tant qu'aucun SMTP personnalisé n'est branché.
