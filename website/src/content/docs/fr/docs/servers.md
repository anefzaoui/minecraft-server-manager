---
title: 'Création et gestion de serveurs'
description: "Cliquez sur Créer un serveur (barre supérieure) ou sur la carte Créer un serveur pour ouvrir l'assistant."
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/servers.md'
---

[← Retour à l'index des documents](/docs/)

## Créer un serveur

Cliquez sur **Créer un serveur** (barre supérieure) ou sur la carte **Créer un serveur** pour ouvrir l'assistant.

![Créer un serveur](/docs/images/create-wizard.png)

L'assistant pré-remplit les champs mémoire, CPU et quota disque à partir des **Paramètres par défaut pour les nouveaux serveurs** de la page Paramètres, qu'un administrateur peut modifier à tout moment.

![Paramètres par défaut pour les nouveaux serveurs](/docs/images/settings-defaults.png)

Vous choisissez :

- Un **nom** (et une icône, une couleur d'accentuation et des étiquettes optionnelles pour organiser votre parc).
- Un **type de serveur** - vanilla, Paper, Fabric, Forge, NeoForge, et plus encore, chacun mappé à l'image itzg appropriée en coulisses.
- Une **version de Minecraft** - `LATEST`, un snapshot, ou une version spécifique.
- Les **ressources** - RAM (tas), limite de mémoire du conteneur, CPU et un quota disque.

Vous préférez un modpack ? L'onglet **À partir d'un modpack** installe à la place un pack CurseForge, Modrinth, FTB ou GT New Horizons (voir [Modpacks](/docs/modpacks/)), ou prend un **zip personnalisé que vous téléchargez** : une exportation de modpack CurseForge (`manifest.json`) ou n'importe quel zip de fichiers jar de mods. Le manifeste (ou un vote majoritaire parmi les fichiers jar identifiés) remplit le chargeur et la version de Minecraft, et chaque mod s'installe en une seule tâche. Vous pouvez également commencer à partir d'un [Blueprint](/docs/blueprints/) sauvegardé.

Le panneau choisit automatiquement un runtime Java approprié pour votre version, télécharge l'image, crée le conteneur et (facultativement) le démarre, le tout à partir d'un seul formulaire.

## La liste des serveurs

La page **Serveurs** liste l'ensemble de votre parc avec son statut et des statistiques rapides.

![Liste des serveurs](/docs/images/servers-list.png)

## Un serveur unique

![Joueurs](/docs/images/players.png)

L'ouverture d'un serveur vous donne un espace de travail à onglets :

- **Vue d'ensemble** - statut, statistiques en direct, temps de fonctionnement et contrôles principaux de démarrage / arrêt / redémarrage.
- **Console** - le flux de journalisation en direct et l'entrée de commandes, ainsi que le chat en jeu ([détails](/docs/console-and-chat/)).
- **Joueurs** - qui est en ligne, ainsi que l'inventaire, les statistiques et les [commandes de chat](/docs/console-and-chat/).
- **Mods** - la liste des mods installés, le [navigateur de mods](/docs/modpacks/) et les mises à jour de contenu.
- **Monde** - [mondes, la carte en direct et le gestionnaire de fichiers](/docs/worlds-and-files/).
- **Sauvegardes** - [instantanés et restauration](/docs/backups/) pour ce serveur.
- **Surveillance** - historique par serveur et métriques en direct, y compris les rapports de crash (voir ci-dessous).
- **Paramètres** - tout sur le fonctionnement du serveur, ainsi que les [intégrations](/docs/integrations/) (Discord, page de statut, invitations, chatbot).

![Vue d'ensemble du serveur](/docs/images/server-overview.png)

La barre latérale **Contrôles du monde** accompagne chaque onglet : l'horloge du jeu, la météo, les gamerules courants sous forme de puces à basculer, et "Afficher toutes les règles du monde" pour le reste.

![Contrôles du monde](/docs/images/world-controls.png)

**Surveillance → En direct** affiche le TPS et les millisecondes par tick, une carte de santé et de stabilité avec les 24 dernières heures / 7 jours de crashs et redémarrages, et les tailles par monde.

![Surveillance en direct](/docs/images/monitoring-live.png)

## Paramètres du serveur

L'onglet **Paramètres** est la surface de configuration complète : renommage, ressources, politique de mise à jour, démarrage / redémarrage automatique, variables d'environnement et remplacements Docker avancés. Les champs qui modifient le fonctionnement du conteneur sont clairement marqués comme nécessitant un redémarrage.

![Paramètres du serveur](/docs/images/server-settings.png)

**À propos du compteur de mémoire.** La "RAM (tas Java)" est transmise à Java comme son tas de départ et son tas maximum, et Java remplit un tas qui lui a été donné d'avance dans la première minute, avec ou sans les préréglages de drapeaux Aikar / MeowIce. Ainsi, le compteur de mémoire s'établit à environ la taille du tas et y reste même lorsque personne ne joue ; le repère sur le compteur indique où se situe le tas sous la limite du conteneur, et la note en dessous le précise. Si vous préférez que la mémoire suive l'utilisation réelle, définissez un **Tas initial** plus petit (avancé) : sur un tas de 2 Go, cela a réduit l'utilisation au repos de 2,6 Go à environ 1,3 Go dans nos mesures. Java a également besoin de mémoire en dehors du tas (environ 0,5 Go sur vanilla, 1,5 à 2 Go sur un modpack volumineux), ce qui est la marge de manœuvre de la limite du conteneur. Voir le README "Deux limites de mémoire" pour les chiffres.

> Les champs de remplacement Docker avancés (nom de conteneur personnalisé, port supplémentaire et montages de liaison, et remplacements bruts) sont **réservés aux administrateurs**, car un montage de liaison associé à l'accès Docker du panneau équivaut à un accès root sur l'hôte. Voir [Utilisateurs et rôles](/docs/users-and-roles/).

## Rapports de crash & analyse mclo.gs

Les rapports de crash (`crash-reports/*.txt` et les fichiers JVM `hs_err_pid*.log`) sont automatiquement récupérés, analysés en un résumé d'une ligne avec l'exception et les mods suspectés, et listés sous **Surveillance → Historique** :

![Carte du rapport de crash](/docs/images/crash-mclogs-card.png)

Chaque carte de rapport offre une visionneuse intégrée (avec des sections pliables et des exceptions mises en évidence), la copie de la trace de pile, et le téléchargement, ainsi que deux actions [mclo.gs](https://mclo.gs) :

- **Partager sur mclo.gs** publie le rapport sous forme de pâte publique et copie le lien - exactement ce que demandent les auteurs de mods et les Discords de support. Le lien est mémorisé sur le rapport, donc rien n'est jamais téléchargé deux fois.
- **Analyser** exécute les informations automatisées de mclo.gs sur la pâte : problèmes connus avec des solutions suggérées (dépendances manquantes, incompatibilités de version, conflits de mods courants), affichés directement dans le panneau.

![Informations mclo.gs](/docs/images/crash-insights.png)

Les deux actions sont précédées d'une confirmation explicite, car une pâte est publique : les rapports de crash peuvent inclure des noms de joueurs et votre liste complète de mods. Le panneau ne télécharge jamais rien de lui-même.
