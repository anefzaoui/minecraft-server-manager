---
title: 'Architecture'
description: 'Minecraft Server Manager est une application Node.js mono-processus, rendue côté serveur.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/architecture.md'
---

[← Retour à l'index de la documentation](/docs/)

Minecraft Server Manager est une application Node.js monoprocessus, rendue côté serveur. Elle gère
les serveurs Minecraft qui s'exécutent en tant que conteneurs Docker en utilisant l'image
[itzg/docker-minecraft-server](https://github.com/itzg/docker-minecraft-server), communiquant avec le
démon Docker via son API (jamais en appelant le CLI `docker`).

## Structure d'exécution

- **Express + Handlebars** rendent les pages côté serveur. Il n'y a pas de SPA ; le JS du navigateur dans `public/js/`
  est une amélioration progressive écrite à la main. Une étape esbuild (`pnpm run build:js`) le regroupe et le
  minifie dans `public/dist/js/`; l'application sert ce bundle lorsqu'il est présent et la source brute sinon,
  donc une exécution en développement sans build fonctionne toujours.
- **`node:sqlite`** (intégré à Node ; le panneau nécessite Node ≥ 24) est la base de données - synchrone,
  zéro module natif, mode WAL. Un petit runner de migrations versionnées applique `src/db/migrations/*` au
  démarrage. Les instructions préparées sont mises en cache dans `src/db/index.js` indexées par le texte SQL.
- **`ws`** transporte les flux de console et de statistiques en direct. Les deux sont **intermédiés** : un flux
  amont `docker logs --follow` (ou `docker stats`) par serveur, démultiplexé une fois et diffusé à chaque
  onglet connecté, plutôt qu'un flux amont par spectateur. Le broker de console conserve un petit tampon de relecture
  pour les onglets rejoignant tardivement et supprime un abonné dont le socket prend trop de retard plutôt que
  de ralentir le flux partagé.
- **dockerode** est la seule façon dont l'application communique avec Docker. Le point de terminaison est auto-détecté
  par plateforme (pipe nommé Windows vs socket Unix).
- **Tout l'état persistant se trouve dans un seul répertoire** (`$DATA_DIR`, par défaut `./data`). Copier ce
  répertoire migre l'intégralité du panneau.

## Couches

Les dépendances s'écoulent dans une seule direction :

```
                 ┌─────────────────────────────┐
   HTTP  ───────▶│  web/routes/*  (+ middleware)│   analyse et validation des entrées, mise en forme des réponses
                 └──────────────┬──────────────┘
                                │
                 ┌──────────────▼──────────────┐
                 │         services/*          │   logique métier (les fonctionnalités réelles)
                 └───┬─────────┬─────────┬─────┘
                     │         │         │
        ┌────────────▼──┐ ┌────▼────┐ ┌──▼──────────┐
        │   docker/*    │ │  db/*   │ │  storage/*  │   infrastructure
        └───────────────┘ └─────────┘ └─────────────┘
```

- **`web/routes/`** - un routeur par domaine (`servers`, `players`, `worlds`, `crashes`, `blueprints`,
  `files`, …), monté dans `web/app.js`. Les routeurs valident avec zod, appellent un service et retournent du JSON
  ou rendent une vue. La logique métier n'a pas sa place ici. Deux routeurs sont montés dans la **zone publique**,
  avant `requireAuth` : `routes/status.js` (pages de statut HTML par serveur, optionnelles) et
  `routes/apiV1.js` (`/api/v1`, une API JSON en lecture seule authentifiée par un jeton Bearer émis par l'admin
  depuis `services/apiTokens.js`, désactivée sauf si activée dans les Paramètres ; voir `docs/public-api.md`).
- **`services/`** - le cœur de l'application. Chaque service possède un domaine et peut dépendre de
  l'infrastructure et d'autres services.
- **`docker/`** - wrappers dockerode : `connect` (détection du point de terminaison + santé du démon), `containers`
  (création/démarrage/arrêt/recréation avec montages de volume, limites de mémoire/CPU et étiquettes), `logs`, `stats`,
  `images`, et un `watcher` qui transforme les événements Docker en historique + détection de crash.
- **`db/`** - le wrapper SQLite et le runner de migrations.
- **`storage/`** - le bootstrap de `./data`, le **garde-fou de chemins** (`safeJoin`, l'épine dorsale de la sécurité des fichiers),
  et l'indexeur de taille en arrière-plan + application des quotas.

Transversal :

- **`config/`** - configuration d'environnement plus le **catalogue de champs** : la source unique de vérité pour les
  paramètres du serveur. Chaque variable d'environnement itzg est cataloguée (étiquette, aide, type, unité, défaut,
  validation, section, drapeaux de danger). L'assistant, les formulaires de paramètres et la validation zod en sont tous dérivés,
  donc exposer un nouveau paramètre est un changement de données, pas une nouvelle plomberie d'interface utilisateur.
- **`events/`** - `recordEvent()` est le point d'entrée unique pour le journal d'historique ; les événements de cycle de vie capturent
  également des extraits de journaux de conteneurs vers `data/logs/<id>/events/`.
- **`ws/`** - WebSockets de console + statistiques authentifiés (cookie de session vérifié lors de la mise à niveau, `Origin` vérifié pour bloquer le détournement inter-sites), intermédiés par serveur (voir "Structure d'exécution").
- **`logger.js` + `instrument.js`** - `require('./logger')(label)` retourne un logger [Pino](https://getpino.io) par module ; niveau de `LOG_LEVEL`,
  `makeFailureThrottle()` maintient une boucle d'arrière-plan en échec persistant à une seule ligne de log plus une ligne "récupérée".
  `src/utils/logSanitize.js` expurge les clés ressemblant à des identifiants et les jetons webhook des métadonnées structurées ;
  `src/config/logLevel.js` est la liste d'autorisation de niveau partagée (maintenue séparément pour éviter un cycle de require avec `config`).
  `src/instrument.js` est une couture Sentry dormante, chargée en premier dans `src/server.js`. `src/web/middleware/requestLog.js` écrit une ligne de log d'accès par requête
  (sauf `/healthz` et les ressources statiques). ESLint applique `no-console` sous `src/**`, avec `preflight.js`, `instrument.js`, et `config/index.js` exemptés (ils s'exécutent avant que le logger n'existe).
- **Limitation de débit** - `src/web/middleware/rateLimit.js` place `express-rate-limit` devant `/api`
  (`RATE_LIMIT_API_PER_MIN`, défaut 1200) et les POST de connexion / 2FA / configuration
  (`RATE_LIMIT_AUTH_PER_15MIN`, défaut 100) ; `0` désactive un limiteur. Il indexe sur `req.ip`, donc
  `TRUST_PROXY` est important derrière un proxy. `/api/v1` a son propre limiteur par jeton
  (`RATE_LIMIT_PUBLIC_API_PER_MIN`, défaut 120), indexé sur un hachage du jeton Bearer avec un fallback IP. Un compteur doux séparé par compte dans
  `src/web/middleware/auth.js` gère le verrouillage de connexion (par IP et global par compte, décroissant).

## Comportements clés du domaine

- **Les Modpacks sont toujours épinglés.** L'image met à jour automatiquement les packs non épinglés à chaque redémarrage,
  donc le panneau résout "latest" en un identifiant de version concret au moment de l'installation et l'épingle. Les mises à jour sont un
  flux orchestré explicite (`updates/`) : aperçu → sauvegarde avant mise à jour → arrêt gracieux → ré-épinglage →
  recréation → moniteur de santé → restauration en un clic.
- **La surcouche de mods personnalisés** est gérée par le panneau : les mods ajoutés par l'utilisateur atterrissent dans la bibliothèque dédupliquée et
  sont liés en dur dans le serveur afin de survivre aux mises à jour de packs. La désactivation est consciente de la classe.
- **Les ports** sont alloués à partir d'un schéma de base (jeu à partir de `PORT_GAME_START` vers le haut, RCON = jeu +
  `PORT_RCON_OFFSET`, Bedrock à partir de `PORT_BEDROCK_START`), sondés pour disponibilité, et réservés dans la
  base de données.
- **Les quotas disque** sont appliqués par le panneau car Docker ne peut pas limiter l'utilisation des montages de volume : l'indexeur
  met en cache les tailles par répertoire et les opérations de croissance du disque sont conditionnées par celles-ci.
- **Les secrets** (mots de passe RCON, clés API, secrets TOTP, URL du webhook Discord) sont chiffrés au repos
  avec AES-256-GCM en utilisant une clé dédiée aléatoire à `$DATA_DIR/.secret-key` (mode `0600`,
  auto-générée). Elle est indépendante de `SESSION_SECRET` ; une clé dérivée de `SESSION_SECRET` est conservée comme
  solution de repli en lecture seule pour les valeurs écrites avant que la clé dédiée n'existe, et
  `src/services/secretsMigration.js` les chiffre à nouveau sous la clé dédiée une fois au démarrage.
  Un `.secret-key` existant mais qui ne peut pas être analysé est une erreur de démarrage critique (il n'est jamais silencieusement
  régénéré par-dessus). Les blueprints suppriment tous les secrets lors de l'exportation.

## Formats de données et de transmission

- **`data/panel.db`** - la base de données SQLite. Instantanés quotidiens via `VACUUM INTO` vers
  `data/backups/_panel/` (les 14 plus récents conservés) ; `PRAGMA integrity_check` s'exécute au démarrage.
- **`data/.session-secret`** - le secret de signature de cookie auto-généré, créé lors de la première exécution si
  `SESSION_SECRET` n'est pas défini. Le supprimer fait pivoter le secret (ce qui invalide les sessions).
- **`data/.secret-key`** - la clé de chiffrement dédiée au repos de 32 octets (mode `0600`), auto-créée
  lors de la première exécution. Indépendante de `SESSION_SECRET` ; la supprimer rend chaque identifiant stocké
  indéchiffrable, elle appartient donc à vos sauvegardes.
- **Blueprints (`.mcserver.zip`)** - une archive zip avec un `manifest.json` décrivant la configuration, les ressources, la
  référence du pack épinglé, le manifeste de la surcouche (URL source + sha256), les fichiers de configuration choisis, et
  facultativement un monde. L'importation re-télécharge et vérifie le hachage de chaque mod et attribue de nouveaux ports.
- **Conteneurs Docker** créés par le panneau sont nommés et étiquetés afin que le watcher puisse les trouver ;
  le panneau possède leur cycle de vie complet.

## Séquence de démarrage

1. `require('./instrument')` (la couture Sentry) avant toute chose, puis `require('./preflight')`
   pour échouer clairement sur une version de Node non prise en charge.
2. Charger la configuration ; s'assurer/générer `.session-secret` **et** `.secret-key`.
3. `ensureDataRoot()` - créer la structure `./data`, effacer `tmp/`.
4. Exécuter les migrations de la base de données, puis `PRAGMA integrity_check` (journalise bruyamment, pointe vers `data/backups/_panel`
   en cas d'échec).
5. Chiffrer à nouveau les secrets hérités indexés par `SESSION_SECRET` sous `.secret-key` (`secretsMigration`).
6. Semer les blueprints de démarrage (protégé).
7. Démarrer le serveur HTTP + WS. Sur une liaison exposée, afficher le code PIN `/setup` de première exécution.
8. Installer le garde-fou d'exécution post-démarrage (attrape les fautes non interceptées ; `MSM_EXIT_ON_FATAL=1` le fait sortir de manière forcée pour les déploiements supervisés).
9. Démarrer les services d'arrière-plan : broker WS, indexeur de stockage, watchers de crash + inventaire, planificateur,
   pont d'événements Discord, et le **minuteur de maintenance quotidien** (élaguer les anciennes lignes d'analyse + instantané
   de `panel.db`).
10. Initialiser Docker **en arrière-plan**. L'interface utilisateur est entièrement utilisable pendant que le démon est arrêté ;
    les fonctionnalités Docker s'activent lorsqu'il devient accessible. Une fois connecté, `refreshStatuses({ boot })`
    réconcilie les statuts mis en cache, émet un événement unique `offline-after-restart` pour un serveur qui était actif avant le redémarrage du panneau et qui ne sera pas redémarré, et la boucle de démarrage lance les serveurs `auto_start` plus récupère les serveurs `auto_restart` trouvés plantés pendant la panne
    (en respectant le délai d'attente en cas de boucle de crash).

> L'ordre instrument-avant-preflight est un compromis délibéré : il permet à une future connexion Sentry de patcher le runtime en premier, au prix d'un message légèrement moins convivial sur une version de Node vraiment ancienne.

## Pipeline de build

`pnpm run build` = `build:css` (Tailwind → `public/css/app.css`) + `build:js` (esbuild →
`public/dist/js/`, ESM avec découpage de code). `postinstall` exécute **UNIQUEMENT le CSS**. `public/css/app.css`
et `public/dist/` sont des artefacts de build ignorés par git ; l'étape de build du Dockerfile exécute le `pnpm run build` complet
et copie `public/` dans l'image d'exécution. Les ressources statiques sont servies avec une mise en cache
`immutable`/longue pour les fichiers indexés par empreinte, une mise en cache courte pour CSS/JS, et `no-cache` pour HTML et
`/api`.
