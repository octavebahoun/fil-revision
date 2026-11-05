# Avancement

## Phase en cours
Phase 9 — Release : tout est vérifié en local et en CI. **Reste à déployer en prod la dernière version** (phases 7–9) : bloqué par une permission de l'outil (déploiement), en attente de l'accord de l'utilisateur.

## Fait
- **Phases 1 à 8** : voir RELEASE_NOTES.md (périmètre complet de la section 5).
- **Prod** : https://fil-revision.vercel.app (code de la phase 6), compte créé, RLS 41/41 et E2E 7/7 vérifiés en prod. 15 vrais cours importés (22 faux fichiers d'un projet Python retirés, import corrigé). Génération : 150 notions prêtes / 485, 1 181 cartes ; reprise automatique chaque nuit (plafond 2 $/jour).
- **Section 9** : lint/types/format OK, 179 tests (couverture 93,9 %), 14 E2E dont absence simulée et mode avion, axe 0 violation sérieuse sur 24 écrans (mobile + bureau), audit photosensible OK, aucun secret dans le build, `pnpm audit --prod` propre, démarrage à froid OK, relecture de 25 fiches + `audit:content` (0 problème), CI verte.

## Tâche suivante
1. Avec l'accord de l'utilisateur : `supabase db push --remote` (migration plan/push) puis `vercel deploy --prod`, puis E2E et RLS contre la prod.
2. Surveiller la fin de la génération en prod (solde DeepSeek ≈ 2,96 $), puis `pnpm audit:content --prod`.

## Problèmes ouverts
- Solde DeepSeek juste suffisant pour finir la génération (≈ 2,7 $ estimés restants).
- E-mails Auth en anglais tant qu'aucun SMTP personnalisé n'est branché.
