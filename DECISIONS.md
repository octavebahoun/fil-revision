# Décisions

Chaque choix, avec sa raison en une ou deux lignes. Les plus récentes en bas de chaque section.

## Produit
- **Nom : « Fil »** — court, français, chaleureux. « Ne pas perdre le fil », « reprendre le fil » : exactement le besoin après une absence. Accroche : « Reprends le fil. »
- **Étape 0** : toutes les variables du `.env` étaient déjà remplies le 2026-11-04 → aucune question posée, démarrage direct.
- **Meta, fournisseur IA par défaut** (demande de l'utilisateur, 2026-11-06, prioritaire sur le brief) : choix Meta / DeepSeek dans Réglages, enregistré par compte ; l'autre sert de secours. Conséquences : délai d'appel Meta 110 s, étapes de jobs jusqu'à 120 s (au lieu de < 60 s), bail des jobs 330 s, estimation de coût calculée avec Meta et ses tokens de raisonnement (×2,5).
- **Changer un cours de matière** (Gérer ce cours → Matière) : notions, cartes et progression suivent. Ajouté après qu'un même PDF (Figma) présent dans deux dossiers a été importé dans la mauvaise matière.

## Stack
- **Next.js 16.4 (App Router) + TypeScript strict + Tailwind 4 + shadcn/ui (Radix, preset Nova)**, comme demandé.
- **`cacheComponents` désactivé** : toutes les pages sont propres à l'utilisateur et la CSP à nonce impose le rendu dynamique ; le cache de composants n'apporterait que de la complexité.
- **Pas d'ORM** : `@supabase/supabase-js` + types générés (`supabase gen types`). Les requêtes passent par la RLS avec le jeton de l'utilisateur ; un ORM contournerait la RLS.
- **Supabase CLI installée en devDependency** (`pnpm exec supabase`, v3.0.0), sans sudo.
- **Tests** : Vitest (unitaires + intégration contre le Postgres de Supabase local), Playwright (E2E, mobile Pixel 7 par défaut), axe-core pour l'accessibilité.
- **Toasts maison** (composant `Announcer`) au lieu de `sonner` : sonner injecte des `<style>` sans nonce (bloqués par la CSP) et anime trop vite.
- **Polices** : Atkinson Hyperlegible Next via `next/font` (auto-hébergée), OpenDyslexic via `@fontsource/opendyslexic` (auto-hébergée, téléchargée seulement si choisie).

## Sécurité
- **Inscription limitée** par deux barrières : contrôle dans l'action serveur + hook Supabase `before_user_created` (fonction Postgres) qui refuse toute adresse absente de `private.allowed_emails`. Le hook protège même contre un appel direct à l'API Auth avec la clé publique.
- **Messages neutres** : connexion → un seul message d'échec ; inscription et mot de passe oublié → même réponse que l'adresse soit autorisée ou non (pas d'énumération).
- **Liens d'e-mail en `token_hash`** (`/auth/confirm`) plutôt que PKCE seul : ils fonctionnent même si l'e-mail est ouvert sur un autre appareil que celui de l'inscription.
- **Clés étrangères composites `(id, user_id)`** : en plus de la RLS, empêchent de rattacher une ligne à la ressource d'un autre utilisateur.
- **CSP à nonce** posée dans `proxy.ts` : `script-src 'nonce' 'strict-dynamic'`, `style-src-elem` à nonce (Radix reçoit le nonce via `get-nonce`), `style-src-attr 'unsafe-inline'` (attributs `style` de React/Radix, risque faible), `frame-ancestors 'none'`. HSTS et autres en-têtes dans `next.config.ts`.
- **Limitation de débit en base** (`rate_limit_hit`, fenêtre fixe) : fonctionne en serverless, contrairement à un compteur en mémoire.
- **Mot de passe** : 10 caractères minimum, lettres + chiffres (config Supabase + Zod).

## Interface
- **Thème** posé côté serveur depuis un cookie d'affichage (`fil_prefs`) + petit script `head` pour le thème « système » : aucun flash clair→sombre au chargement (important pour la photosensibilité).
- **Mouvement** : réglage « normales / réduites / aucune ». `prefers-reduced-motion` force au moins « réduites ». On n'anime que `transform` et `opacity`.
- **Cibles tactiles** : boutons shadcn redimensionnés à 44 px minimum (`min-h-11`), champs à 48 px et police 16 px (pas de zoom iOS).

## Ressources de la machine
- **Mode léger** (demande de l'utilisateur, 2026-11-05) : PC partagé d'environ 7 Go de RAM. Supabase local sans Studio ni Realtime (le suivi en direct utilise du polling), un seul serveur Next à la fois, arrêté dès qu'il ne sert plus, Playwright à 1 worker.

## IA et génération (phase 3)
- **Raisonnement coupé** (`thinking: disabled`) pour la segmentation, les fiches et les quiz : extraction fidèle d'un texte, deux fois moins de tokens de sortie. La **relecture** garde le raisonnement (modèle léger `deepseek-flash`, peu cher).
- **Prix prudents** (tarifs catalogue les plus hauts relevés en novembre 2026) : 1re génération réelle estimée 0,97 $, payée 0,83 $ (solde DeepSeek). Surchargeables par `AI_PRICING_JSON`.
- **Listes tolérantes** : une flashcard ou une question mal formée est écartée sans rejeter toute la réponse ; la fiche reste stricte. Une citation trop longue est tronquée (son début reste exact).
- **Fiche = 5 lignes de 100 caractères** : explication ≤ 200, exemple ≤ 200, question ≤ 100 caractères. Si le modèle enchaîne plusieurs questions, seule la première est gardée.
- **Le simulé n'alimente jamais le cache** (sinon une vraie génération ultérieure recevrait du faux contenu).
- **Estimation avant génération massive** : au-delà de `AI_CONFIRM_THRESHOLD_USD` (0,30 $ par défaut), un cours attend un clic « Lancer la préparation » ; en CLI, `--yes`.
- **Codes d'erreur précis** dans le journal IA (`schema:fiche.question:custom`…), sans aucun contenu de cours.

## Révision (phase 4)
- **FSRS calculé côté serveur** à la synchronisation (ts-fsrs, sans aléa) ; l'état d'avant chaque réponse est gardé pour pouvoir l'annuler (« J'ai décroché »).
- **« J'ai décroché »** annule les erreurs des 2 dernières minutes (fenêtre d'absence probable) et revient à l'élément précédent.
- **Inactivité** : seul un clic sur une réponse note une carte ; 45 s sans interaction → bandeau « Où j'en étais ? ».
- **File d'envoi** IndexedDB : verrou relâché de façon asynchrone (bug trouvé par le test « absence simulée » : la file se figeait après une coupure), délai de 8 s par requête, relance au retour du réseau.
- **Pages de session hors navigation** (groupe `(focus)`) : une seule chose à l'écran.
- **Fonctions SQL** (`review_due_cards`, `subject_mastery`…) : évitent la limite de 1 000 lignes de l'API.

## Mise en ligne (phase 5)
- **Vercel** : projet `fil-revision`, région `fra1` (proche de Supabase `eu-central-2`), Node 24, cron Vercel quotidien en secours. **Supabase Cron** (pg_cron + pg_net, chaque minute) appelle `/api/jobs/tick` quand des jobs attendent ; URL et secret dans Vault.
- **E-mails en anglais** : l'offre gratuite de Supabase interdit de modifier les modèles sans SMTP personnalisé. Les modèles français sont prêts (`supabase/templates`) et s'activent avec `SMTP_CONFIGURED=1`. Conséquence : le lien de réinitialisation doit être ouvert dans le même navigateur que la demande.
- **Compte de production** créé par l'API admin (confirmé, mot de passe aléatoire jamais stocké) : l'utilisateur choisit son mot de passe via « Mot de passe oublié ».
- **Tests contre la prod** : `TEST_TARGET=prod` (RLS) et `E2E_BASE_URL` (Playwright) utilisent des comptes temporaires, supprimés après ; la liste blanche est resynchronisée.
- **E2E sans limitation de débit** (toutes les connexions viennent de la même IP) ; la limitation est couverte par les tests d'intégration.
