# Notes de version — Fil 1.0 (2026-11-05)

## Livré

- **Socle** : comptes limités à `ALLOWED_EMAILS` (double barrière : action serveur + hook Postgres), matières et cours, upload par glisser-déposer (50 Mo, envoi direct au stockage privé), `pnpm import:cours` idempotent (ignore les projets de code), extraction par page/diapo, nettoyage, notions, classement cours/exercice/ressource, génération par notion (fiche 5 lignes, flashcards, 6 types de quiz, vocabulaire anglais), citations cliquables vers la page source, double vérification anti-invention, mes contenus (modifier, supprimer, signaler → régénération ou retrait), coûts IA (plafond, estimation avant génération, journal, limitation de débit).
- **Révision** : « Réviser maintenant » (5/10/15/25 min), FSRS, trois modes, mode Fatigué, sauvegarde continue (IndexedDB + file d'envoi), « Où j'en étais ? », « J'ai décroché » (D), parking à pensées (N), mode focus (F), confort de lecture complet, lecture audio, série avec jokers.
- **Extensions** : tuteur « Explique-moi » avec citations et 3 relances, méthode Feynman (écrit ou dictée), aide guidée aux énoncés (indices 1→2→3), examens blancs (minuteur optionnel qui se met en pause), planning à rebours (charge plafonnée, rattrapage progressif), rappels push VAPID (note iPhone), cartes mentales clavier + version texte, PWA hors ligne, exercices de code (SQLite WASM, JS/TS en iframe isolée, PHP relu par l'IA), exports PDF imprimables et CSV Anki.

## Vérifié

| Contrôle | Résultat |
|---|---|
| Lint, types stricts, format | 0 erreur, 0 avertissement |
| Tests unitaires + intégration (Postgres réel) | 179 verts ; couverture du code métier : 93,9 % des lignes, 94,5 % des fonctions |
| RLS anti-IDOR | 41/41 en local **et en production** |
| E2E Playwright (mobile, et bureau pour l'accessibilité) | 14 parcours verts, dont « absence simulée » et « session complète en mode avion » ; 10/10 contre la prod |
| Accessibilité axe (WCAG 2.2 AA) | 0 violation sérieuse ou critique sur 24 écrans, mobile et bureau |
| Audit photosensible (CSS livré) | OK ; aucune boucle rapide, aucun `blink` |
| Secrets dans le build client | aucun |
| `pnpm audit --prod` | aucune vulnérabilité |
| Démarrage à froid (`db reset` + seed + build + start) | OK, compte de démo fonctionnel |
| Contenu généré | 25 fiches relues sur 3 matières ; 2 exemples inventés trouvés → consignes et contrôles durcis ; `pnpm audit:content` : 0 problème sur 665 cartes |
| CI GitHub Actions | verte |

## Limites connues

- **E-mails d'authentification en anglais** (offre gratuite Supabase sans SMTP personnalisé) ; le lien de réinitialisation doit être ouvert dans le même navigateur. Modèles français prêts (`supabase/templates`, `SMTP_CONFIGURED=1`).
- **Génération en cours en production** : plafonnée à 2 $/jour, elle se termine seule en 1 à 2 jours. Le solde DeepSeek (≈ 2,96 $ le 2026-11-05) est juste suffisant ; s'il s'épuise, Meta prend le relais (plus cher).
- Les fichiers scannés (sans texte) ne sont pas pris en charge.
- Environ 4 % des notions n'ont pas de fiche : le relecteur a refusé toute version non fidèle au cours (flashcards et quiz restent disponibles).
- Les rappels push nécessitent l'app installée sur iPhone ; la notification réelle n'a pas pu être vérifiée sur un appareil physique (logique d'horaire testée, envoi testé via le bouton « Tester »).
- La dictée Feynman de secours (Meta) n'est utilisée que sans reconnaissance vocale du navigateur.
- Le planning se recalcule chaque jour à partir de l'état réel ; la charge du jour n'est pas modifiable à la main.
