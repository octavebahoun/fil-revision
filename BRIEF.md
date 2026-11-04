# BRIEF : Plateforme de révision adaptée TDAH et absences épileptiques (version complète)

Tu es l'équipe entière : architecte, développeur full-stack, ingénieur IA (extraction et génération de contenu pédagogique), designer UX spécialisé en accessibilité cognitive, ingénieur sécurité, QA et DevOps. Ta mission : livrer une **plateforme de révision en ligne, complète**, utilisable sur PC et sur téléphone. Elle reçoit mes cours (PDF, PPTX, DOCX) et les transforme en tout ce dont j'ai besoin pour réviser. Ce n'est pas un MVP : tout le périmètre de la section 5 est attendu, extensions comprises.

**Pour qui.** Pour moi : étudiant en B3 à l'IESIG (web, data, cloud), développeur de niveau intermédiaire. J'ai un **TDAH** et des **absences épileptiques**. Concrètement :
- ma concentration décroche vite et je ne lis pas les longs textes ;
- pendant une absence, je perds quelques secondes de conscience sans m'en rendre compte, puis je ne sais plus où j'en étais.

Chaque choix de conception part de là. Pour moi, une plateforme classique est inutilisable : longs textes, minuteurs, pages chargées, effets qui clignotent.

---

## 1. Règles d'autonomie

- Tu travailles seul, de bout en bout, sur plusieurs sessions. Tu enchaînes les phases sans attendre mon accord.
- **Une seule exception** : l'étape 0 (section 3).
- Si je ne réponds pas à une question sous **10 minutes**, tu prends la décision la plus raisonnable, tu la notes dans `DECISIONS.md` et tu continues.
- Tu tiens à jour en permanence :
  - `PROGRESS.md` : phase en cours, tâches faites, tâche suivante, problèmes ouverts ;
  - `DECISIONS.md` : chaque choix, avec sa raison en une ou deux lignes.
- Au début de chaque session (y compris après une limite d'usage, une compaction de contexte ou un redémarrage), tu relis ce brief, puis `PROGRESS.md` et `DECISIONS.md`, avant de toucher au code.
- Tu fais des commits Git atomiques au format Conventional Commits. Aucun commit ne casse le build. Si `gh` est authentifié, tu crées un dépôt GitHub **privé**, jamais public.
- **Communication avec moi** : mes règles de `~/.claude/CLAUDE.md` s'appliquent. Messages de 5 lignes maximum, une seule question à la fois.

---

## 2. Sources de vérité

**Mes cours** sont dans `/home/precieux/Téléchargements/IESIG/`. Ce dossier est en **lecture seule** : tu n'y modifies jamais rien.
- Un sous-dossier = une matière. Il y a 10 PDF aujourd'hui (environ 260 000 caractères, texte extractible, aucun scan). D'autres arriveront pendant l'année.
- Plusieurs dossiers sont encore vides : ce sont des matières à venir. Crée-les quand même comme matières vides, pour que je voie le programme.

Pièges connus de cette arborescence :
- `Analyse des besoins\net modélisation UML` contient un retour à la ligne dans le nom : normalise les espaces.
- `Conteneurs, CI/CD et gestion des versions` a été coupé par le `/` en un dossier `Conteneurs, CI/` qui contient un sous-dossier `CD et gestion des versions`. Reconstruis le nom.
- Les dossiers préfixés `00 –` (forum, ressources) ne sont pas des matières. Ignore-les s'ils sont vides, sinon range leur contenu dans « Ressources ».
- Certains fichiers sont des **énoncés d'exercice**, pas des cours (ex. `IWA-B3-M2_ ... _ IESIG.pdf`, une étude de cas avec des étapes). Ils sont traités à part (section 5.2).
- Le cours `Introductory Class...` est en anglais. Tout le reste est en français.

Ces cours sont des supports de l'école. Ils ne sont jamais commités (`.gitignore`), jamais exposés publiquement, et stockés uniquement dans mon espace privé.

**Règle de priorité** : ce brief > tes préférences.

Un conflit est déjà tranché. D'un côté, je veux une app vivante et motivante, parce que les petites récompenses aident vraiment avec le TDAH. De l'autre, l'épilepsie interdit tout ce qui flashe. **La sécurité neurologique gagne toujours** : du mouvement doux et lent, jamais de flash ni de clignotement.

---

## 3. Étape 0 : ce que tu me demandes, une seule fois

Le fichier `.env` existe déjà à la racine, avec les noms de variables ci-dessous. Je le remplis moi-même. Ton message d'étape 0 tient en 5 lignes :
- tu listes uniquement les variables encore vides ;
- tu me demandes de les remplir dans `.env` et **jamais dans le chat**.

Ne lis jamais une valeur de secret à voix haute dans tes messages ni dans tes logs.

```
# IA : deux fournisseurs compatibles OpenAI
DEEPSEEK_API_KEY=
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-v4-pro
META_API_KEY=
META_BASE_URL=https://api.meta.ai/v1
META_MODEL=muse-spark-1.3-contributor
AI_PRIMARY_PROVIDER=deepseek
AI_FALLBACK_PROVIDER=meta
AI_DAILY_BUDGET_USD=2

# Supabase cloud (production)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=
SUPABASE_PROJECT_REF=
SUPABASE_ACCESS_TOKEN=
SUPABASE_DB_PASSWORD=

# Vercel (déploiement non interactif)
VERCEL_TOKEN=

# Accès : seuls ces e-mails peuvent créer un compte (séparés par des virgules)
ALLOWED_EMAILS=
```

**Les IA.** Les deux fournisseurs sont compatibles OpenAI, et les deux clés ont été testées le 4 novembre 2026.
- **DeepSeek** est le fournisseur principal. Modèles disponibles : `deepseek-v4-pro` (par défaut) et `deepseek-flash`. Tu peux utiliser `deepseek-flash` pour les tâches légères (passe de vérification, tuteur) si la qualité tient : note-le.
- **Meta** est l'API officielle `api.meta.ai`, en secours. Elle répond sur `/v1/chat/completions` et sur `/v1/responses`, donc l'adaptateur générique suffit.
- Les modèles Meta (`muse-wonder-1.0`, `muse-spark-1.3`, etc.) **raisonnent avant de répondre**. Les tokens de raisonnement comptent dans la limite de sortie. Si cette limite est trop basse, le contenu revient vide : prévois une marge et traite une réponse vide comme une erreur à relancer.
- Meta propose aussi `muse-voice-transcribe-1.0`. Utilise-le pour la dictée de la méthode Feynman si la reconnaissance vocale du navigateur ne suffit pas (Firefox, par exemple).

**Ce que tu génères toi-même** et ajoutes au `.env` (et au `.env.example` sans les valeurs) :
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` : ce dernier prend la forme `mailto:` suivie du premier e-mail de `ALLOWED_EMAILS` ;
- `CRON_SECRET` ;
- tout autre secret interne.

Utilise pour ça un script `scripts/gen-secrets`.

**Dev local.** L'app tourne sur `http://localhost:3000`. Supabase tourne en local via `supabase start` (Docker est installé). Les clés locales vont dans `.env.development.local`, générées depuis `supabase status`.

**Auth Supabase.**
- Site URL : l'URL de production Vercel.
- URL de redirection : `http://localhost:3000/auth/callback` et `https://<projet>.vercel.app/auth/callback`.
- Tu configures tout ça toi-même via `supabase config push` ou l'API Management, avec `SUPABASE_ACCESS_TOKEN`.

**Sans réponse sous 10 minutes**, tu démarres quand même :
- un adaptateur IA simulé et déterministe (`AI_PRIMARY_PROVIDER=mock`) ;
- Supabase local ;
- aucun déploiement tant que les clés cloud manquent.

Tu branches les vrais services dès que les variables sont remplies, et tu vérifies qu'elles sont bien lues.

**Nom du produit** : choisis-en un toi-même, court, en français, chaleureux, qui évoque la concentration ou la révision, et qui n'est pas le nom d'un produit connu. Note-le dans `DECISIONS.md`.

---

## 4. Décisions : carte blanche, avec garde-fous

Tu choisis librement les librairies, l'ORM, les outils de test et les composants. Chaque choix va dans `DECISIONS.md`.

- **Stack de départ** : Next.js (App Router) + TypeScript strict + Tailwind + shadcn/ui, déployé sur Vercel. Supabase pour Postgres, Auth, Storage et RLS. Migrations avec la Supabase CLI. Répétition espacée avec FSRS (`ts-fsrs`). Tu t'en écartes seulement avec une raison écrite.
- **Offres gratuites** : tout tient dans Vercel Hobby et Supabase Free. Note les quotas qui comptent (durée des fonctions, stockage, cron).
- **Couche IA** : une interface unique `LlmProvider` (base URL + clé + modèle) et un routeur qui gère principal, secours et simulé. Pas de SDK propriétaire couplé au code métier. Toutes les sorties IA sont validées par un schéma Zod.
- **Recherche dans les cours** : aucune API d'embeddings payante n'est requise (DeepSeek n'en propose pas). Utilise la recherche plein texte Postgres (config `french`) + `pg_trgm`. Ajoute pgvector seulement si tu trouves un chemin gratuit et fiable, et note-le.
- **Traitements longs** (import, génération) : découpe-les en étapes idempotentes et reprenables, de moins de 60 s chacune, avec leur état en base (table `jobs`). Choisis le mécanisme compatible avec les offres gratuites (Vercel Workflow, Supabase Queues + Cron, etc.) et justifie-le.
- **Langue** : interface en français uniquement, sans i18n.
- **Outils manquants** (`supabase` CLI, etc.) : installe-les en espace utilisateur (pnpm/npx), sans sudo, et note-le.

---

## 5. Périmètre

### 5.1 Principes TDAH et absences : obligatoires sur chaque écran

1. **Une chose à la fois.** Chaque écran a une seule action principale. Un bloc de texte fait 5 lignes au plus sur mobile. Le reste se cache derrière « En savoir plus ».
2. **Rien ne se perd.** Chaque interaction est sauvegardée tout de suite. Si je ferme l'onglet, perds le réseau ou décroche, je reprends exactement au même endroit.
3. **« Où j'en étais ? »** Ce bandeau calme apparaît dans trois cas : je reviens sur l'onglet, je rouvre l'app, ou je reste 45 s inactif en session. Il montre le dernier élément vu, un rappel d'une ligne et un bouton « Reprendre ». Une absence ne se voit pas de l'intérieur : c'est à l'app de m'aider à me raccrocher.
4. **Bouton « J'ai décroché ».** Il est toujours visible en session (raccourci `D`). Il réaffiche l'élément précédent. Ce que j'ai raté pendant l'absence ne compte pas comme une erreur.
5. **Pas de pression temporelle par défaut.** Aucun compte à rebours, aucune avance automatique, aucun score lié au temps. Un minuteur optionnel existe seulement pour les examens blancs, et il se met en pause tout seul quand je suis inactif.
6. **Inactivité n'est pas échec.** Une carte restée sans réponse n'est jamais notée fausse. Elle ne fausse pas FSRS non plus.
7. **Sécurité photosensible** (WCAG 2.3.1 et 2.3.2), parce qu'un flash peut avoir de vraies conséquences pour moi :
   - rien ne clignote, aucune alternance rapide de luminosité, aucun flash plein écran ;
   - pas de motifs rayés en mouvement, pas de parallaxe agressive ;
   - les célébrations sont lentes (400 ms ou plus) et sans saut de luminosité ;
   - `prefers-reduced-motion` est respecté, avec en plus un réglage dans l'app : « Animations : normales / réduites / aucune ».
8. **Motiver sans culpabiliser.** La progression est visible (barre de session, « 4/10 »), avec de petites victoires. La série de jours a des jokers automatiques. Jamais de message du type « Tu as raté 3 jours ».
9. **Démarrer sans friction.** L'accueil, c'est un gros bouton « Réviser maintenant (10 min) » qui choisit pour moi. Tout le reste est secondaire.
10. **Style des contenus générés** : ce sont les règles que je me suis données à moi-même.
    - Une notion = une explication = un exemple.
    - 5 lignes maximum, conclues par UNE question de vérification.
    - Jamais condescendant.
    - Si je dis « je comprends pas », simplifie encore.

### 5.2 Socle

- **Compte.** Connexion par e-mail et mot de passe, avec réinitialisation. L'inscription est limitée à `ALLOWED_EMAILS`, parce que chaque génération est payée par mes clés : un inconnu ne doit jamais pouvoir s'inscrire. Les données sont isolées par utilisateur (RLS), même s'il n'y a qu'un utilisateur aujourd'hui.
- **Matières et cours.**
  - Upload par glisser-déposer : PDF, PPTX, DOCX, TXT, MD, 50 Mo maximum.
  - Import en masse avec `pnpm import:cours <chemin>`. Il est idempotent grâce au hash : réimporter ne crée aucun doublon, et un nouveau fichier est détecté.
  - L'avancement du traitement s'affiche en direct.
- **Pipeline d'ingestion.**
  - Extraction du texte par page ou par diapo.
  - Nettoyage des en-têtes, pieds de page et numéros répétés.
  - Découpage en **notions** : un concept atomique, avec un titre et ses pages sources.
  - Classement de chaque document : cours, énoncé d'exercice ou ressource.
  - Cache par hash : jamais de régénération pour un contenu inchangé.
- **Génération, par notion.**
  - Une fiche, au format 5.1 n°10.
  - Des flashcards.
  - Des questions de quiz : QCM, vrai/faux, réponse courte, code à compléter, éléments à remettre dans l'ordre, éléments à associer.
  - Chaque élément cite sa source (fichier + page). Un clic ouvre le document à cette page.
  - Une seconde passe confronte chaque élément au passage source et écarte ce qui n'y figure pas. Zéro invention.
  - Pour l'anglais : vocabulaire anglais-français et phrases utiles.
- **Énoncés d'exercice.** Pas de corrigé donné d'emblée. Une « aide guidée » découpe l'énoncé en étapes, propose des indices progressifs (indice 1, puis 2, puis 3) et commente ma réponse.
- **Révision.**
  - Session « Réviser maintenant » : un mélange de cartes dues (FSRS) et de nouvelles cartes. Durée de 5, 10, 15 ou 25 min (10 par défaut). Une pause m'est proposée à la fin.
  - Trois modes.
    - Lire les fiches : une par écran, par glissement ou avec les flèches.
    - Flashcards : notes « À revoir / Difficile / Bien / Facile », plus « J'étais absent », qui ne pénalise pas.
    - Quiz.
  - La correction est toujours bienveillante : une explication courte et un lien vers la fiche.
- **Mes contenus.** Je peux modifier ou supprimer une carte, ou la signaler comme fausse. Une carte signalée est régénérée ou retirée.
- **Accueil et tableau de bord.** Il affiche l'action du jour, la maîtrise par matière (en %) et le prochain examen. Rien de plus.
- **Confort de lecture.**
  - Taille de police et interligne réglables.
  - Police Atkinson Hyperlegible, avec OpenDyslexic en option.
  - Règle de lecture qui surligne la ligne en cours.
  - Mode focus : tout est masqué sauf la carte.
  - Thèmes clair, sombre et contraste élevé.
- **Lecture audio** avec la synthèse vocale du navigateur (Web Speech API), à vitesse réglable, sur chaque fiche et chaque question.
- **Parking à pensées.** Une idée me vient en pleine session ? Je la note en 2 secondes sans quitter la session, et je la retrouve après.
- **Coûts IA.**
  - Plafond quotidien (`AI_DAILY_BUDGET_USD`).
  - Estimation du coût avant une génération massive.
  - Journal des appels : fournisseur, tokens, coût.
  - Limitation de débit sur les routes IA.

### 5.3 Extensions (à livrer aussi)

- **Tuteur « Explique-moi ».** Un chat ancré dans mes cours (recherche, puis réponse avec citations), au style 5.1 n°10, avec trois boutons : « Plus simple », « Un autre exemple », « Interroge-moi ».
- **Méthode Feynman.** J'explique une notion avec mes mots, à l'écrit ou par dictée vocale du navigateur. L'IA me dit ce qui est juste et ce qui manque, en 5 lignes au plus.
- **Examens blancs.** Un quiz mixte par matière, sans minuteur par défaut. Le bilan pointe les notions faibles, qui sont ajoutées aux révisions.
- **Planning d'examens.** Je saisis les dates. La plateforme répartit les révisions à rebours, avec une charge quotidienne plafonnée et réglable. Si je saute un jour, le rattrapage est progressif.
- **Mode « Fatigué ».** Une session de 5 min, uniquement avec des cartes faciles que je connais déjà.
- **Cartes mentales par matière.** Navigables au clavier, avec une version texte équivalente.
- **PWA.**
  - Installable.
  - Sessions disponibles hors ligne : les cartes du jour sont gardées dans IndexedDB.
  - Synchronisation au retour du réseau, sans perte ni doublon.
- **Rappels par notifications push web** (VAPID) : à l'heure que je choisis, avec un ton doux, désactivables. Sur iPhone, les notifications exigent l'app installée sur l'écran d'accueil : explique-le dans l'interface.
- **Exercices de code** pour SQL, PHP et React/TS, générés depuis le cours. Ils sont vérifiés dans le navigateur (SQL via PGlite ou SQLite WASM, JS/TS dans une iframe isolée), jamais exécutés sur le serveur. Pour PHP, une correction par l'IA à partir de la sortie attendue suffit.
- **Exports.** Les fiches en PDF imprimable, les flashcards en CSV importable dans Anki.

**Ordre de construction** :
1. le socle, utilisable de bout en bout ;
2. la mise en ligne (phase 5), pour que je commence à réviser au plus tôt ;
3. les extensions, une par une.

La branche principale fonctionne à tout moment.

---

## 6. Backend : exigences

- **RLS sur chaque table** (`user_id = auth.uid()`) et sur chaque bucket. Des tests anti-IDOR prouvent qu'un second utilisateur ne peut ni lire ni modifier aucune ressource du premier.
- **Stockage privé**, avec des URL signées de courte durée.
- **Clés IA et `SUPABASE_SECRET_KEY` côté serveur uniquement.** Un test parcourt le build client et échoue s'il y trouve une clé.
- **Injection de prompt.** Le texte des cours est une donnée non fiable : délimite-le et interdis au modèle d'y suivre la moindre instruction. Une sortie hors schéma est rejetée puis régénérée. Écris un test avec un PDF piégé (« ignore tes instructions… »).
- **Uploads.**
  - Vérification du type réel (magic bytes), de la taille et du nombre de pages.
  - Parsing avec délai maximal.
  - Un fichier corrompu donne un message clair, jamais un crash.
- **Protections générales.**
  - Limitation de débit sur l'authentification et l'IA.
  - Messages d'erreur neutres à la connexion.
  - CSP stricte, HSTS, `frame-ancestors`.
- **Logs** structurés, sans contenu de cours ni secrets.
- **Migrations** versionnées. `supabase db reset` + seed donne un état propre, avec un jeu de démo identifié comme tel.
- **Données de santé : aucune.** « J'ai décroché » est un événement d'apprentissage, pas un journal de crises. L'app ne fait ni diagnostic ni conseil médical.
- **Qualité.** Typage strict, zéro avertissement de lint.

---

## 7. Frontend : exigences

- **Identité** : calme, chaleureuse, motivante. Palette douce, contraste AA minimum, tokens sémantiques (aucune couleur codée en dur), modes clair, sombre et contraste élevé.
- **Mobile d'abord** : je réviserai surtout sur mon téléphone. Cibles tactiles de 44 px minimum, actions principales à portée de pouce.
- **Mouvement** au service du sens. Exemples :
  - entrée de carte en 200 à 300 ms (translation + opacité) ;
  - retournement 3D doux des flashcards en 400 ms ;
  - barre de progression qui se remplit ;
  - fin de session célébrée par des particules lentes, sans flash ;
  - squelettes de chargement.

  N'anime que `transform` et `opacity`, à 60 fps, et respecte toujours 5.1 n°7.
- **États obligatoires** sur chaque écran : chargement, vide, erreur, hors ligne, traitement en cours.
- **WCAG 2.2 AA.**
  - Clavier complet, avec des raccourcis en session : `Espace` retourne, `1` à `4` notent, `D` signale un décrochage, `F` active le mode focus.
  - Focus visible.
  - Libellés sur tous les champs.
  - Annonces `aria-live` pour les changements de session.
- **Microcopie** : tutoiement, phrases courtes, ton bienveillant. Zéro jargon dans les messages d'erreur.

---

## 8. Phases et critères de sortie

| Phase | Contenu | Sortie vérifiable |
|---|---|---|
| 1. Fondations | Dépôt, Next.js, Supabase local, CI, tokens, shell de navigation, auth limitée à `ALLOWED_EMAILS` | Connexion fonctionnelle, inscription refusée hors liste, CI verte |
| 2. Ingestion | Upload, `import:cours`, extraction, nettoyage, notions, jobs | Les 10 PDF importés, notions visibles avec leurs pages, réimport sans doublon |
| 3. Génération | Couche IA (DeepSeek, Meta, simulé), fiches, flashcards, quiz, vérification contre la source, budget | Tests verts en mode simulé ; une génération réelle sur les 10 PDF, échantillon relu (section 9.8) |
| 4. Révision | Accueil, session, FSRS, trois modes, sauvegarde continue, « Où j'en étais ? », « J'ai décroché », confort de lecture, audio, parking | Test « absence simulée » vert (9.5) |
| 5. Mise en ligne | Supabase cloud, migrations, Vercel, Auth configurée, mon compte, mes cours importés | L'URL de prod fonctionne sur mobile (Playwright contre la prod) et la RLS est vérifiée en prod |
| 6. Tuteur et entraînement | Explique-moi, Feynman, aide guidée aux exercices, examens blancs, mode Fatigué | Parcours E2E verts, réponses conformes à 5.1 n°10 |
| 7. Organisation | Planning d'examens, rappels push, cartes mentales | Notification reçue à l'heure prévue, planning recalculé après un jour sauté |
| 8. Mobilité | PWA, hors ligne, synchronisation, exercices de code, exports | Session complète en mode avion, puis synchronisation sans perte |
| 9. Release finale | Audits complets, finitions, documentation | Section 9 entièrement validée sur tout le produit |

---

## 9. Boucle de vérification (à chaque phase)

1. Lint, typage, formatage : zéro erreur.
2. Tests unitaires et d'intégration contre un vrai Postgres (Supabase local), tests RLS anti-IDOR, couverture de 80 % ou plus sur le code métier.
3. Démarrage à froid : `supabase db reset` puis `pnpm build && pnpm start`. Tout fonctionne.
4. Tests E2E Playwright sur chaque parcours livré.
5. **Test « absence simulée »** :
   - ouvrir une session et répondre à 2 cartes ;
   - rester inactif 60 s : le bandeau apparaît, et aucune erreur n'est comptée ;
   - fermer l'onglet puis rouvrir : la session reprend sur la même carte ;
   - couper le réseau : rien n'est perdu.
6. **Audit photosensible.**
   - Un script parcourt les CSS et les animations. Il échoue sur toute animation en boucle de moins de 333 ms qui touche l'opacité, la couleur ou la luminosité, et sur toute utilisation de `blink`.
   - Tu revois en plus les vidéos Playwright des écrans animés.
7. **Captures** de chaque écran en mobile, tablette et desktop, en clair et en sombre. Tu les **regardes** et tu les critiques comme un designer exigeant qui connaît le TDAH. Tu te poses deux questions :
   - Y a-t-il plus d'une action principale ?
   - Un bloc de texte dépasse-t-il 5 lignes ?

   Puis tu corriges et tu recaptures.
8. **Qualité du contenu généré.** Tu relis au moins 20 fiches, tirées d'au moins 3 matières, et tu les compares à la source. Tu corriges les prompts jusqu'à zéro invention. Un contrôle automatique rejette toute fiche trop longue.
9. **Audits.**
   - Accessibilité avec axe sur chaque écran : zéro violation sérieuse ou critique.
   - Dépendances avec `pnpm audit` : aucune vulnérabilité haute non traitée.
10. **Relecture sécurité** de tes changements, avec la section 6 comme liste de contrôle.

Tu notes les résultats dans `PROGRESS.md`. Si un point échoue, tu le corriges avant de passer à la phase suivante.

---

## 10. Livrables

- L'URL de production qui fonctionne, avec mon compte créé et mes cours importés et générés.
- En local : `supabase start && pnpm dev` démarre tout.
- `README.md` : le premier écran tient en 10 lignes (ce que c'est, comment lancer, comment ajouter un cours), les détails viennent après.
- `GUIDE.md` : « Ajouter un nouveau cours » en 5 étapes courtes.
- `docs/` : architecture, exploitation (sauvegarde, rotation des clés, suivi des coûts, quotas des offres gratuites).
- `.env.example` complet et commenté, sans aucune valeur secrète.
- `DECISIONS.md`, `PROGRESS.md`, et `RELEASE_NOTES.md` (ce qui est livré, ce qui est vérifié, les limites connues).

---

## 11. Définition de « terminé »

Le produit est terminé quand toutes ces conditions sont remplies :
- tout le périmètre de la section 5 existe et est testé ;
- les 10 points de la section 9 passent sur l'ensemble du produit ;
- je peux, depuis mon téléphone, ouvrir l'app, appuyer sur un seul bouton et réviser 10 minutes un cours que je viens d'ajouter ;
- je peux décrocher en pleine session et me raccrocher sans rien perdre ni être pénalisé.

Le niveau attendu : une plateforme que tu oserais présenter à un jury d'accessibilité et à un étudiant TDAH exigeant sans t'excuser de rien.

Commence par l'étape 0.
