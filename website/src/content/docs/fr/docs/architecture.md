---
title: 'Architecture'
description: 'Minecraft Server Manager est une application Node.js mono-processus, rendue côté serveur.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/architecture.md'
---

[← Retour à l'index de la documentation](/docs/)

Minecraft Server Manager est une application Node.js à processus unique, rendue côté serveur. Elle gère
les serveurs Minecraft qui s'exécutent en tant que conteneurs Docker en utilisant l'image
[itzg/docker-minecraft-server](https://github.com/itzg/docker-minecraft-server), communiquant avec le
démon Docker via son API (jamais en appelant la CLI `docker` via shell).

## Structure d'exécution

- **Express + Handlebars** rendent les pages côté serveur. Il n'y a pas de SPA ; le JS du navigateur dans `public/js/`
  est une amélioration progressive écrite à la main. Une étape esbuild (`pnpm run build:js`) le regroupe et le
  minifie dans `public/dist/js/`; l'application sert ce bundle lorsqu'il est présent et la source brute sinon,
  donc une exécution en développement sans build fonctionne toujours.
- **`node:sqlite`** (intégré à Node ; le panneau nécessite Node ≥ 24) est la base de données - synchrone,
  zéro module natif, mode WAL. Un petit exécuteur de migrations versionnées applique les fichiers de
  `src/db/migrations/*` au démarrage. Les instructions préparées sont mises en cache dans `src/db/index.js`
  en utilisant le texte SQL comme clé.
- **`ws`** transporte les flux de console et de statistiques en direct. Les deux sont **intermédiés** : un flux
  en amont `docker logs --follow` (ou `docker stats`) par serveur, démultiplexé une fois et diffusé à chaque
  onglet connecté, plutôt qu'un flux en amont par spectateur. L'intermédiaire de console conserve un petit
  tampon de relecture pour les onglets rejoignant tardivement et supprime un abonné dont le socket prend trop
  de retard plutôt que de ralentir le flux partagé.
- **`dockerode`** est la seule façon dont l'application communique avec Docker. Le point de terminaison est auto-détecté
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

- **`web/routes/`** - un routeur par domaine (`players`, `worlds`, `crashes`, `blueprints`, `files`, …).
  `web/app.js` monte les routeurs de niveau supérieur (`api.js`, l'API JSON de session qui contient également les
  routes principales du serveur et monte les routeurs de domaine par serveur ; `index.js`, les pages ; `auth`,
  `account`, `tasks`, …). Les routeurs valident avec zod, appellent un service et retournent du JSON
  ou rendent une vue. La logique métier n'appartient pas ici. Deux routeurs sont montés dans la **zone publique**,
  avant `requireAuth` : `routes/status.js` (pages de statut par serveur opt-in en HTML) et
  `routes/apiV1.js` (`/api/v1`, une API JSON en lecture seule authentifiée par un jeton Bearer émis par l'admin
  depuis `services/apiTokens.js`, désactivée sauf si activée dans les Paramètres ; voir `docs/public-api.md`).
- **`services/`** - le cœur de l'application. Chaque service possède un domaine et peut dépendre de
  l'infrastructure et d'autres services.
- **`docker/`** - wrappers dockerode : `connect` (détection du point de terminaison + santé du démon), `containers`
  (création/démarrage/arrêt/recréation avec montages de liaison, limites de mémoire/CPU et étiquettes), `logs`, `stats`,
  `images`, `networks` (découverte du réseau hôte), `hostPath` (re-racine les chemins de liaison sous
  `DATA_DIR_HOST`), et un `watcher` qui transforme les événements Docker en historique + détection de crash.
- **`db/`** - le wrapper SQLite et l'exécuteur de migrations.
- **`storage/`** - le bootstrap de `./data`, le **garde-fou de chemins** (`safeJoin`, la colonne vertébrale de sécurité des
  fichiers), et l'indexeur de taille en arrière-plan + application des quotas.

Transversal :

- **`config/`** - configuration d'environnement plus le **catalogue de champs** : la source unique de vérité pour les
  paramètres du serveur. Chaque variable d'environnement itzg est cataloguée (étiquette, aide, type, unité, défaut,
  validation, section, drapeaux de danger). L'assistant, les formulaires de paramètres et la validation zod en sont tous
  dérivés, donc exposer un nouveau paramètre est une modification de données, pas une nouvelle plomberie d'interface utilisateur.
- **`events/`** - `recordEvent()` est le point d'entrée unique pour le journal d'historique ; les événements de cycle de vie
  capturent également des extraits de logs de conteneur dans `data/logs/<id>/events/`.
- **`ws/`** - WebSockets de console + statistiques authentifiés (cookie de session vérifié lors de la mise à niveau, `Origin`
  vérifié pour bloquer le détournement inter-sites), intermédiés par serveur (voir "Structure d'exécution").
- **`logger.js` + `instrument.js`** - `require('./logger')(label)` renvoie un logger [Pino](https://getpino.io) par module ;
  niveau défini par `LOG_LEVEL`, `makeFailureThrottle()` maintient une boucle d'arrière-plan en échec persistant à une seule
  ligne de log plus une ligne "récupérée". `src/utils/logSanitize.js` expurge les clés ressemblant à des identifiants et les jetons
  webhook des métadonnées structurées ; `src/config/logLevel.js` est la liste blanche de niveaux partagée (maintenue séparément pour éviter un cycle de require avec `config`).
  `src/instrument.js` est une couture Sentry dormante, chargée en premier dans `src/server.js`. `src/web/middleware/requestLog.js`
  écrit une ligne de log d'accès par requête (sauf `/healthz` et les fichiers statiques). ESLint applique `no-console` sous `src/**`,
  avec `preflight.js`, `instrument.js`, et `config/index.js` exemptés (ils s'exécutent avant que le logger n'existe).
- **Limitation de débit** - `src/web/middleware/rateLimit.js` place `express-rate-limit` devant `/api`
  (`RATE_LIMIT_API_PER_MIN`, par défaut 1200) et les POST de connexion / 2FA / configuration
  (`RATE_LIMIT_AUTH_PER_15MIN`, par défaut 100) ; `0` désactive un limiteur. Il utilise `req.ip` comme clé, donc
  `TRUST_PROXY` est important derrière un proxy. `/api/v1` a ses propres limiteurs : un plafond par IP client
  (cinq fois le budget par jeton) qui s'exécute avant la vérification du jeton, puis un budget par jeton
  (`RATE_LIMIT_PUBLIC_API_PER_MIN`, par défaut 120) basé sur l'ID du jeton vérifié. Un compteur doux séparé par compte
  dans `src/web/middleware/auth.js` gère le verrouillage de connexion (par IP et global par compte, en décroissance).
- **Autorisation** : deux couches. Le rôle global (`requireAuth` → `requireRole` / `requireWrite` dans
  `src/web/middleware/auth.js`) contrôle les actions globales du panneau et est le défaut sur chaque serveur. Les
  permissions par serveur (`src/services/permissions.js`, neuf capacités stockées sous forme de liste JSON par
  `(utilisateur, serveur)` dans `user_server_permissions`) affinent ce défaut pour un serveur ; chaque
  route `/api/servers/:id`, montage de sous-routeur, page, WebSocket et liste globale passe par
  `src/web/middleware/serverAccess.js` (`serverScope`, monté sur le préfixe `/servers/:id` de l'API et du routeur de page,
  masque un serveur sans `view` comme un 404 ; `requireCap(cap)` nomme la capacité dont une route a besoin). Les écritures qui nomment leur serveur dans le corps (planifications, extraction et installation de monde, exportation de blueprint) sont ouvertes aux spectateurs par `requireWrite` uniquement pour ce serveur, et chaque route de ce type vérifie elle-même la capacité. `test/permissions-routes.test.js` parcourt les piles de routeurs actives et échoue si une route d'écriture, un montage ou une page délimitée par serveur n'a pas de garde.

## Comportements clés du domaine

- **Les modpacks sont toujours épinglés.** L'image met automatiquement à jour les packs non épinglés à chaque redémarrage,
  donc le panneau résout "latest" en un ID de version concret au moment de l'installation et l'épingle. Les mises à jour sont
  un flux orchestré explicite (`updates/`) : aperçu → sauvegarde pré-mise à jour → arrêt gracieux → ré-épinglage →
  recréation → moniteur de santé → restauration en un clic.
- **La surcouche de mods personnalisés** est gérée par le panneau : les mods ajoutés par l'utilisateur atterrissent dans la
  bibliothèque dédupliquée et sont liés en dur dans le serveur afin qu'ils survivent aux mises à jour de pack. La désactivation est
  sensible à la classe. Comme la bibliothèque conserve chaque build qu'elle a téléchargé, une mise à jour enregistre le build qu'elle a remplacé
  (`server_content.previous_*`) et peut être restaurée à partir des fichiers locaux seuls. La désactivation d'un mod de pack
  écrit la variable d'environnement d'exclusion du pack à la place ; `packs.applyPack` transporte cela et le reste du réglage du pack
  (`PACK_TUNING_KEYS`) lors d'un changement de version du même pack, et le supprime lorsque le pack change.
- **Une mise à niveau de version Minecraft doit être méritée.** `services/compat.js` analyse les mods d'un serveur - résolus à partir des lignes installées par le panneau, puis du manifeste du pack CurseForge, puis par hachage de contenu par rapport à Modrinth/CurseForge - et construit une matrice de support (chargeur, version Minecraft) par projet à partir des `latestFilesIndexes` de CurseForge (200 projets par requête) et de la liste des versions par projet de Modrinth (une requête par projet, ce qui maintient le chargeur et la version associés). Le vérificateur de mises à jour n'offre que la version la plus récente supportée par TOUS les mods, et n'offre rien du tout lorsque la réponse ne peut être établie : pas de scan, un scan pour une version ou un chargeur différent, un qui n'a jamais terminé, ou un jar qu'aucun registre ne reconnaît. Les scans sont manuels uniquement, et leur progression et leurs résultats partiels se trouvent dans `version_compat` (pas dans `services/tasks.js` en mémoire), donc un rafraîchissement ou un redémarrage du panneau reprend au lieu de rester bloqué sur une roue qui tourne ; `reconcileScans()` marque les scans orphelins par un arrêt au prochain démarrage.
- **La version du chargeur de mods est une épingle, comme tout le reste.** `services/loaderPin.js` lit le build installé à partir du manifeste d'installation de l'image elle-même (`.forge-manifest.json` et similaires) et écrit l'épingle : la variable itzg du chargeur sur un serveur simple (`FORGE_VERSION`, …), ou `CF_MOD_LOADER_VERSION` sur un pack CurseForge Forge ou Fabric, qui remplace la version déclarée par le pack. L'installateur CurseForge de l'image ignore cet remplacement pour NeoForge, et les packs Modrinth et FTB n'en ont pas, donc leur chargeur suit le pack. `packs.applyPack` supprime toutes les variables `CF_` lors d'une mise à jour ou d'une restauration de pack, ce qui supprime un remplacement avec le reste. Un build typé est d'abord vérifié par rapport à la liste complète du registre (`services/loaderVersions.js` ; celle de Forge provient de ses métadonnées maven, qui ignorent les nombres ; un échec est re-vérifié une fois par rapport au registre lui-même), puis le changement est sauvegarde → épingle (par-dessus l'env tel qu'il est après la sauvegarde) → reconstruction.
- **Les ports** sont alloués à partir d'un schéma de base (jeu à partir de `PORT_GAME_START` vers le haut, RCON = jeu + `PORT_RCON_OFFSET`, Bedrock à partir de `PORT_BEDROCK_START`), sondés pour disponibilité, et réservés dans la DB. "Pris" est l'union des revendications de chaque serveur (ports actifs, plus une paire en attente ci-dessous), de chaque port hôte que tout conteneur Docker publie (`containers.publishedHostPorts` : liaisons actives des conteneurs en cours d'exécution plus celles configurées de chaque conteneur arrêté, car une sonde de port hôte depuis l'intérieur du propre conteneur du panneau ne voit que l'espace réseau de ce conteneur), et de la sonde du système d'exploitation. La partie Docker est mise en cache pendant 3 secondes et limitée : une liste qui ne répond pas en 2,5 secondes supprime uniquement la partie Docker, et une inspection lente ne coûte que les ports de ce conteneur. La création de serveur et `servers.changeGamePort` choisissent les ports via une chaîne de sérialisation qui ne couvre que le choix et sa revendication (l'écriture de la ligne pour une création, la réservation en mémoire pour un changement de port) ; le sélecteur de port de BlueMap et les remplacements de ports supplémentaires ne sont pas inclus et ne consultent pas Docker. Un changement de port sur un serveur existant (`servers.changeGamePort`, sous le verrou d'opération du serveur) est appliqué immédiatement, car Docker corrige les liaisons de port lors de la création du conteneur : la nouvelle paire (RCON toujours jeu + `PORT_RCON_OFFSET`) est vérifiée et réservée en mémoire (`ports.reserve`, à la fois l'ancienne et la nouvelle paire, honorées par chaque autre choix) sous le verrou de port. Elle est refusée (409 `PENDING_CHANGES`) tant que d'autres paramètres attendent une reconstruction, donc elle ne reconstruit jamais qu'un conteneur qui a déjà fonctionné, sur un nouveau port ; et un serveur en cours d'exécution n'est modifié que lorsque la requête indique `restart: true` (sinon 409 `NEEDS_CONFIRM`). L'image est tirée et un nom de conteneur personnalisé est vérifié avant que quoi que ce soit ne soit touché. Un serveur en cours d'exécution est arrêté ; puis la nouvelle paire est écrite avec `pending_recreate = 1` (donc un crash du panneau à partir de là laisse un "rebuild pending" honnête), le conteneur est supprimé, reconstruit sur la nouvelle paire et démarré. Si une étape après l'arrêt échoue, `putBackOnOldPort` réécrit l'ancienne paire, reconstruit (et redémarre, si elle était en cours d'exécution) dessus et enregistre quelle étape a échoué ; l'historique et les alertes indiquent si même cela a échoué, ce qui laisse le serveur arrêté jusqu'à ce que quelqu'un le démarre. La capacité `settings` est suffisante, y compris le serveur en cours d'exécution. Les non-administrateurs ne peuvent choisir que parmi `PORT_GAME_START` et au-dessus.
  (Les colonnes `port_*_pending` de la migration 029 appartiennent à une conception antérieure, non publiée, et ne sont pas utilisées ; 031 les efface.) Une collision de verrou répond 409 avec `code: 'BUSY'`, que les appelants réessayant vérifient plutôt que le libellé. Un redémarrage automatique après crash (`watcher.restartAfterCrash`) et une sauvegarde ou un démarrage planifié (`scheduler.runTaskWithRetry`) qui trouvent le serveur occupé par une autre action réessayent toutes les 20 s / 60 s pendant jusqu'à 30 minutes, et une mise à jour ou une restauration de pack réessaie ses étapes verrouillées de la même manière (`opLock.retryWhileBusy`) ; un redémarrage après crash ou un démarrage planifié en attente abandonne une fois que quelqu'un a arrêté, tué ou démarré le serveur depuis (`events.lifecycleActionSince`), et le redémarrage après crash abandonne également lorsque le redémarrage automatique est désactivé ou que le serveur a disparu. Les redémarrages, arrêts et commandes planifiés ne sont pas réessayés, et un planning dont la dernière exécution est toujours en attente saute son prochain déclenchement.
- **Les quotas de disque** sont appliqués par le panneau car Docker ne peut pas limiter l'utilisation des montages de liaison : l'indexeur met en cache les tailles par répertoire et les opérations de croissance de disque sont conditionnées par celles-ci.
- **Les secrets** (mots de passe RCON, clés API, secrets TOTP, URL du webhook Discord) sont chiffrés au repos avec AES-256-GCM en utilisant une clé aléatoire dédiée à `$DATA_DIR/.secret-key` (mode `0600`, générée automatiquement). Elle est indépendante de `SESSION_SECRET` ; une clé dérivée de `SESSION_SECRET` est conservée comme solution de repli uniquement en déchiffrement pour les valeurs écrites avant l'existence de la clé dédiée, et `src/services/secretsMigration.js` re-chiffre celles-ci sous la clé dédiée une fois au démarrage. Une clé `.secret-key` qui existe mais ne peut pas être analysée est une erreur de démarrage critique (elle n'est jamais régénérée silencieusement par-dessus). Les blueprints suppriment tous les secrets lors de l'exportation.
- **`server.properties` est détenu par le panneau mais masqué par l'environnement.** L'image itzg réaffirme chaque propriété basée sur l'environnement à chaque démarrage (`OVERRIDE_SERVER_PROPERTIES` par défaut vrai), donc une valeur que le panneau modifie directement - PvP/difficulté des contrôles du monde, le commutateur de liste blanche, l'éditeur de fichiers - serait silencieusement annulée au prochain démarrage à moins que la variable d'environnement correspondante ne soit supprimée et que le conteneur ne soit recréé. Chaque écriture de propriété directe passe par `writeServerProperties()` (fichier entier) ou `setServerProperty()` (une clé) dans `src/services/servers.js`, qui réécrivent atomiquement le fichier, désactivent la variable d'environnement derrière chaque clé modifiée (via l'attribut `prop:` sur les champs du catalogue, vérifié dans les tests par rapport aux définitions de propriétés de l'image elle-même), et marquent `pending_recreate`. La difficulté est écrite dans le fichier ainsi qu'envoyée via RCON, car un serveur dédié réapplique la propriété `difficulty` à chaque démarrage. Minecraft lui-même réenregistre server.properties à partir de ses valeurs de démarrage lors de l'activation/désactivation de la liste blanche, ce qui annulerait les modifications apportées pendant que le serveur s'exécute, donc le commutateur de liste blanche en cours d'exécution capture d'abord le fichier et le réécrit avec uniquement `white-list` modifié. Les variables d'environnement restent entièrement configurables à la création (l'assistant les affiche et elles s'appliquent une fois) ; elles ne désépinglent que la première fois que le panneau modifie la propriété sous-jacente. MOTD suit le même contrat : une modification directe du fichier `motd` le désactive, donc la dernière écriture l'emporte.

## Formats de données et de transmission

- **`data/panel.db`** - la base de données SQLite. Instantané quotidiennement via `VACUUM INTO` vers
  `data/backups/_panel/` (les 14 plus récents conservés) ; `PRAGMA integrity_check` s'exécute au démarrage.
- **`data/.session-secret`** - le secret de signature de cookie auto-généré, créé lors de la première exécution si
  `SESSION_SECRET` n'est pas défini. Le supprimer fait pivoter le secret (ce qui invalide les sessions).
- **`data/.secret-key`** - la clé de chiffrement au repos dédiée de 32 octets (mode `0600`), auto-créée
  lors de la première exécution. Indépendante de `SESSION_SECRET` ; la supprimer rend chaque identifiant stocké
  indéchiffrable, elle appartient donc à vos sauvegardes.
- **Blueprints (`.mcserver.zip`)** - une archive zip avec un `manifest.json` décrivant la configuration, les ressources, la
  référence de pack épinglée, le manifeste de surcouche (URL source + sha256), les fichiers de configuration choisis, et
  facultativement un monde. L'importation re-télécharge et vérifie par hachage chaque mod et attribue de nouveaux ports.
- **Conteneurs Docker** créés par le panneau sont nommés et étiquetés afin que le watcher puisse les trouver ;
  le panneau possède leur cycle de vie complet.

## Séquence de démarrage

1. `require('./instrument')` (la couture Sentry) avant toute chose, puis `require('./preflight')`
   pour échouer clairement sur une version Node non prise en charge.
2. Charger la configuration ; s'assurer/générer `.session-secret` **et** `.secret-key`.
3. `ensureDataRoot()` - créer la structure `./data`, effacer `tmp/`.
4. Exécuter les migrations de la DB, puis `PRAGMA integrity_check` (journalise bruyamment, pointe vers `data/backups/_panel`
   en cas d'échec).
5. Re-chiffrer les secrets hérités utilisant `SESSION_SECRET` sous `.secret-key` (`secretsMigration`).
6. Importer les clés API de l'environnement une fois (`apiKeys.importFromEnvOnce()`), épingler tout serveur portant encore un sélecteur de modpack non épinglé (`packPins.pinUnpinnedServers()`), marquer les scans de compatibilité de version laissés en cours par un processus précédent comme interrompus
   (`compat.reconcileScans()`), puis semer les blueprints de démarrage (protégé).
7. Démarrer le serveur HTTP + WS. Sur une liaison exposée, afficher le code PIN `/setup` de première exécution.
8. Installer le garde-fou d'exécution post-démarrage (attrape les fautes non interceptées ; `MSM_EXIT_ON_FATAL=1` le fait sortir de manière forcée pour les déploiements supervisés).
9. Démarrer les services d'arrière-plan : intermédiaire WS, indexeur de stockage, watchers de crash + inventaire, planificateur,
   pont d'événements Discord, watcher de communication de chatbot, et le **minuteur de maintenance quotidien** (élaguer les anciennes lignes d'analyse, les transcriptions de chatbot, l'historique des événements (365 jours) et les lignes de cache API, puis instantané de `panel.db`).
10. Initialiser Docker **en arrière-plan**. L'interface utilisateur est entièrement utilisable pendant que le démon est en panne ;
    les fonctionnalités Docker s'activent lorsqu'il devient accessible. Une fois connecté, `refreshStatuses({ boot })`
    réconcilie les statuts mis en cache, émet un événement unique `offline-after-restart` pour un serveur qui était actif avant le redémarrage du panneau et qui ne sera pas redémarré, et la boucle de démarrage démarre les serveurs `auto_start` plus récupère les serveurs `auto_restart` trouvés plantés pendant la panne
    (en respectant le backoff en boucle de crash).

> L'ordre instrument-avant-preflight est un compromis délibéré : il permet à une future configuration Sentry de patcher le runtime en premier, au prix d'un message légèrement moins convivial sur une version Node vraiment ancienne.

## Pipeline de build

`pnpm run build` = `build:css` (Tailwind → `public/css/app.css`) + `build:js` (esbuild →
`public/dist/js/`, ESM avec découpage de code). `postinstall` exécute **uniquement le CSS**. `public/css/app.css`
et `public/dist/` sont des artefacts de build ignorés par git ; l'étape de build du Dockerfile exécute le `pnpm run build` complet
et copie `public/` dans l'image d'exécution. Les actifs statiques sont servis avec une mise en cache
`immutable`/longue pour les fichiers avec empreinte, courte pour CSS/JS, et `no-cache` pour HTML et `/api`.
