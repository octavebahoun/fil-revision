# Décisions

Chaque choix, avec sa raison en une ou deux lignes. Les plus récentes en bas de chaque section.

## Produit
- **Nom : « Fil »** — court, français, chaleureux. « Ne pas perdre le fil », « reprendre le fil » : exactement le besoin après une absence. Accroche : « Reprends le fil. »
- **Étape 0** : toutes les variables du `.env` étaient déjà remplies le 2026-11-04 → aucune question posée, démarrage direct.

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
