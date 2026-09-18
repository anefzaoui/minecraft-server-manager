---
title: 'Console et commandes de chat'
description: "L'onglet Console diffuse le journal du serveur en temps réel et vous fournit une boîte de commande pour envoyer n'importe quelle commande du serveur."
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/console-and-chat.md'
---

[← Retour à l'index des docs](/docs/)

## La console en direct

L'onglet **Console** diffuse le journal du serveur en temps réel et vous fournit une boîte de commande pour envoyer n'importe quelle commande serveur. Pas besoin de `docker exec`, ni de SSH. Les sorties reviennent en ligne, avec les couleurs et tout le reste.

![Console](/docs/images/server-console.png)

La console est également l'endroit où le panneau lit l'état du serveur : il surveille le journal pour classifier la phase de démarrage ("Chargement des mods", "Génération du monde", "Finalisation du démarrage") et appelle `list` pour suivre qui est en ligne, afin que le tableau de bord et les cartes serveur reflètent toujours la réalité.

Ce sondage ouvre une connexion RCON de courte durée à chaque cycle, ce qui est enregistré dans les journaux du serveur comme une paire `Thread RCON Client … started` / `shutting down` toutes les ~20 secondes, et (sur les serveurs dont le cœur ou les plugins le répètent) une ligne `Rcon issued server command: …` pour chaque lecture seule - `list` pour le nombre de joueurs, plus `time query …` et `gamerule <name>` pendant que la page Contrôles du Monde est ouverte. Le commutateur **Masquer le bruit RCON** au-dessus du journal filtre ces lignes (ainsi que les lignes de démarrage de l'écouteur RCON). Il est activé par défaut et mémorisé par navigateur ; désactivez-le pour voir le flux brut.

Les commandes envoyées depuis le panneau peuvent être annoncées en jeu sous une étiquette par serveur, afin que les joueurs sachent qu'un opérateur a agi plutôt qu'une console mystérieuse.

## Commandes de chat

Les commandes de chat permettent aux joueurs de déclencher des actions du panneau en tapant une commande préfixée dans le chat du jeu, par exemple `!spawn` pour une téléportation aléatoire. La détection est basée sur le journal et l'exécution passe par le serveur, donc **aucun mod n'est requis**.

![Commandes de chat](/docs/images/chat-commands.png)

Chaque commande a :

- Un **déclencheur** (par exemple, `spawn`) et un **préfixe** (`!` par défaut).
- Une **action** : téléportation aléatoire, téléportation vers une structure, téléportation vers un biome, ou exécution de commandes console brutes.
- Un **niveau de permission** : tout le monde, joueurs sur liste blanche, ou opérateurs uniquement.
- Un **temps de recharge**, et des messages personnalisables en attente / succès / échec avec des espaces réservés comme `{distance}`.

### Une note sur la sécurité

Les commandes qui peuvent détruire un serveur (`stop`, `op`, `ban`, `whitelist`, et leurs semblables) ne sont autorisées que sur des déclencheurs **réservés aux opérateurs**. Le panneau vérifie cela même lorsqu'elles sont imbriquées dans une chaîne `execute … run …`, de sorte qu'un déclencheur de faible permission ne peut pas introduire une commande dangereuse. Le texte ordinaire du chat qui mentionne simplement ces mots (comme un message `say`) n'est pas affecté.
