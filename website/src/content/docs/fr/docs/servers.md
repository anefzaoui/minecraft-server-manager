---
title: 'Création et gestion de serveurs'
description: "Créez, démarrez, arrêtez, reconstruisez et configurez des serveurs Minecraft dans le panneau : l'assistant de création, les paramètres, la mémoire et le port du jeu."
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/servers.md'
---

[← Retour à l'index de la documentation](/docs/)

## Créer un serveur

Cliquez sur **Créer un serveur** (barre supérieure) ou sur la carte **Créer un serveur** pour ouvrir l'assistant.

![Créer un serveur](/docs/images/create-wizard.png)

L'assistant pré-remplit le tas Java et la quota disque à partir des **Paramètres par défaut pour les nouveaux serveurs** sur la page Paramètres, que l'administrateur peut modifier à tout moment. Un nouveau serveur y prend également sa limite CPU.

![Paramètres par défaut pour les nouveaux serveurs](/docs/images/settings-defaults.png)

Vous choisissez :

- Un **nom** (et une description, une icône et une couleur d'accentuation optionnelles). Les tags pour organiser votre flotte sont ajoutés plus tard, dans les paramètres du serveur.
- Un **type de serveur** : Vanilla, Paper, ou Purpur dans l'onglet **Vanilla**. Pour un serveur moddé, l'onglet **À partir des mods** choisit le chargeur (Fabric, Forge, NeoForge, ou Quilt), la version de Minecraft, et une version du chargeur (la dernière, ou une spécifique), puis vous permet de rechercher des mods.
- Une **version de Minecraft** : `LATEST`, un snapshot, ou une version spécifique (bêtas et alphas incluses).
- Un **port de jeu** : un port libre est suggéré. La console distante (RCON) utilise le port 1000 supérieur (par défaut). Vous pouvez le modifier plus tard (voir [Changer le port de jeu](#changing-the-game-port)).
- **Ressources** : le tas Java (la limite de mémoire du conteneur est définie 50% au-dessus) et une quota disque.

**Options avancées** ouvre tous les autres paramètres supportés par l'image du serveur, plus les variables d'environnement supplémentaires et (pour les administrateurs) les paramètres Docker avancés.

Vous préférez un modpack ? L'onglet **À partir d'un modpack** installe un pack CurseForge, Modrinth, ou GT New Horizons à la place (voir [Modpacks](/docs/modpacks/)), ou prend un **zip personnalisé que vous téléchargez** : un `.mrpack` Modrinth, un export de modpack CurseForge (`manifest.json`), ou n'importe quel zip de fichiers jar de mods. Le manifeste (ou un vote majoritaire parmi les fichiers jar identifiés) remplit le chargeur et la version de Minecraft, et tous les mods s'installent en une seule tâche. Vous pouvez également démarrer à partir d'un [Blueprint](/docs/blueprints/) sauvegardé dans l'onglet **À partir d'un Blueprint**.

Le panneau choisit automatiquement un runtime Java pertinent pour votre version, télécharge l'image, crée le conteneur et le démarre, le tout à partir d'un seul formulaire.

## La liste des serveurs

La page **Serveurs** liste votre flotte entière avec son statut et des statistiques rapides.

![Liste des serveurs](/docs/images/servers-list.png)

## Un serveur unique

![Joueurs](/docs/images/players.png)

Ouvrir un serveur vous donne un espace de travail à onglets :

- **Vue d'ensemble** : l'adresse à partager avec les joueurs, la description, l'utilisation en direct, et qui est en ligne.
- **Console** : le flux de logs en direct et l'entrée de commandes, le chat en jeu, et les [commandes de chat](/docs/console-and-chat/).
- **Joueurs** : la liste des joueurs, plus l'inventaire et les statistiques.
- **Mods** : la liste des mods installés, le [navigateur de mods](/docs/modpacks/), et les mises à jour de contenu. Sur un serveur moddé, son sous-onglet **Versions** vérifie pour quelles futures versions de Minecraft vos mods ont des versions disponibles ([mises à jour](/docs/updates/#minecraft-version-compatibility)).
- **Monde** : [mondes, la carte en direct, et le gestionnaire de fichiers](/docs/worlds-and-files/).
- **Sauvegardes** : [instantanés et restauration](/docs/backups/) pour ce serveur.
- **Surveillance** : historique par serveur et métriques en direct, y compris les rapports de crash (voir ci-dessous).
- **Paramètres** : **Configuration** (tout ce qui concerne le fonctionnement du serveur), plus les [intégrations](/docs/integrations/) (Discord, Page de statut, Invites, et, pour les administrateurs, Chatbot).

Les contrôles de démarrage, d'arrêt et de redémarrage se trouvent dans l'en-tête au-dessus de chaque onglet. Ce que vous pouvez faire sur chaque onglet dépend de vos [permissions sur ce serveur](/docs/users-and-roles/#per-server-permissions) : par exemple, le sous-onglet **Fichiers** nécessite la permission Fichiers, et l'envoi de commandes console nécessite Console.

![Vue d'ensemble du serveur](/docs/images/server-overview.png)

La barre **Contrôles du monde** glisse le long de chaque onglet : l'horloge en jeu, la météo, les gamerules courants sous forme de puces à basculer, et "Afficher toutes les règles du monde" pour le reste.

![Contrôles du monde](/docs/images/world-controls.png)

**Surveillance → En direct** affiche le TPS et les millisecondes par tick, une carte de santé et de stabilité avec les crashs (derniers 24h et 7j), les arrêts pour manque de mémoire, et les redémarrages automatiques, et les tailles par monde.

![Surveillance en direct](/docs/images/monitoring-live.png)

## Paramètres du serveur

**Paramètres → Configuration** est la surface de configuration complète : nom, description, MOTD, icône, couleur et tags, ressources, port de jeu, politique de mise à jour, démarrage au démarrage du panneau et redémarrage automatique en cas de crash, toutes les variables d'environnement supportées par l'image du serveur, les paramètres Docker avancés, et l'exportation, la duplication, la reconstruction et la suppression de Blueprint. Les changements qui ne prennent effet qu'une fois le serveur reconstruit sont sauvegardés immédiatement et attendent : un bouton **Appliquer les changements** apparaît dans l'en-tête du serveur, et ils sont également appliqués lors du prochain démarrage du serveur.

**Redémarrage automatique en cas de crash** redémarre un serveur planté, attendant plus longtemps entre chaque tentative (5, 10, puis 20 secondes) et s'arrêtant après 3 tentatives en moins de 10 minutes. Il ignore les crashs que le panneau reconnaît comme un problème de configuration (le EULA, le mauvais Java, un monde d'une version plus récente, un port déjà utilisé, manque de mémoire, une clé CurseForge manquante), car ceux-ci nécessitent une correction préalable. Si une autre action est occupée avec le serveur (une sauvegarde, une restauration, un changement de port), il attend jusqu'à 30 minutes, et il abandonne dès que quelqu'un arrête ou démarre le serveur lui-même.

Les changements de paramètres directs persistent toujours après les redémarrages. Un changement PvP ou de difficulté effectué avec la barre **Contrôles du monde**, un basculement de whitelist dans l'onglet **Joueurs**, ou une modification de `server.properties` dans l'éditeur **Fichiers** supprime la variable d'environnement correspondante (si elle était définie) et marque le serveur pour être reconstruit, de sorte que la valeur sur disque l'emporte au lieu d'être réaffirmée par l'image du conteneur au prochain démarrage.

![Paramètres du serveur](/docs/images/server-settings.png)

**À propos du compteur de mémoire.** "RAM (tas Java)" est fournie à Java comme tas de départ et maximum, et Java remplit un tas qui lui a été donné d'avance dans la première minute, avec ou sans les préréglages de drapeaux Aikar / MeowIce. Ainsi, le compteur de mémoire se stabilise autour de la taille du tas et y reste même lorsque personne ne joue ; le repère sur le compteur indique où se situe le tas sous la limite du conteneur, et la note en dessous le mentionne. Si vous préférez que la mémoire suive l'utilisation réelle, donnez au serveur un tas de départ plus petit avec **Tas initial** dans la carte Ressources sur **Paramètres → Configuration** (ou sous **Options avancées** dans l'assistant), par exemple 512 Mo : sur un tas de 2 Go, cela a réduit l'utilisation au repos de 2,6 Go à environ 1,3 Go dans nos mesures. Java a également besoin de mémoire en dehors du tas (environ 0,5 Go pour du vanilla, 1,5 à 2 Go pour un gros modpack), ce qui est l'objectif de la marge de manœuvre de la limite du conteneur. Voir le README "Deux limites de mémoire" pour les chiffres.

> Les **Paramètres Docker avancés** (nom du conteneur, réseau Docker, mappages de ports supplémentaires, et liaisons de volumes supplémentaires) sont **réservés aux administrateurs**, car une liaison de montage associée à l'accès Docker du panneau équivaut à un accès root sur l'hôte. Voir [Utilisateurs et rôles](/docs/users-and-roles/).

### Changer le port de jeu

La carte **Port de jeu** sur **Paramètres → Configuration** déplace un serveur vers un autre port à tout moment, avec son propre bouton **Enregistrer le port**. **Utiliser le prochain port libre** choisit le plus petit port libre, et la carte vérifie tout port que vous entrez avant de l'enregistrer. RCON suit toujours à 1000 au-dessus du port de jeu (le décalage par défaut). Les administrateurs peuvent choisir n'importe quel port à partir de 1024 ; tous les autres choisissent à partir du premier port de jeu (25565 par défaut) et au-dessus. L'enregistrement applique le changement immédiatement : un serveur arrêté se déplace simplement, et un serveur en cours d'exécution demande d'abord, puis redémarre sur le nouveau port (le monde est sauvegardé d'abord, et les joueurs se reconnectent sur le nouveau port). Si le serveur ne peut pas démarrer sur le nouveau port, il revient à l'ancien. Le changement est refusé tant que d'autres changements attendent **Appliquer les changements**, appliquez donc ceux-ci d'abord. Changer le port nécessite la permission Paramètres sur ce serveur.

![La carte Port de jeu](/docs/images/server-port.png)

![L'invite avant qu'un serveur en cours d'exécution ne redémarre sur son nouveau port](/docs/images/port-restart.png)

## Rapports de crash & analyse mclo.gs

Les rapports de crash (`crash-reports/*.txt` et les fichiers JVM `hs_err_pid*.log`) sont récupérés automatiquement, analysés en un résumé d'une ligne avec l'exception et les mods suspectés, et listés sous **Surveillance → Historique** :

![Carte du rapport de crash](/docs/images/crash-mclogs-card.png)

Chaque carte de rapport offre une visionneuse intégrée (avec des sections pliables et des exceptions mises en évidence), la copie de la trace de la pile, et le téléchargement, plus deux actions [mclo.gs](https://mclo.gs) :

- **Partager sur mclo.gs** publie le rapport comme une pâte publique et copie le lien : exactement ce que les auteurs de mods et les Discords de support demandent. Le lien est mémorisé sur le rapport, donc rien n'est jamais téléchargé deux fois.
- **Analyser** exécute les informations automatisées de mclo.gs sur la pâte : problèmes connus avec des corrections suggérées (dépendances manquantes, incompatibilités de version, conflits de mods courants), affichés directement dans le panneau.

![Informations mclo.gs](/docs/images/crash-insights.png)

Les deux actions sont protégées par une confirmation explicite, car une pâte est publique : les rapports de crash peuvent inclure des noms de joueurs et votre liste complète de mods. Le panneau ne télécharge jamais rien de sa propre initiative.
