---
title: 'Le tableau de bord'
description: "Le tableau de bord est votre base : chaque serveur, son état en direct et un flux continu de ce qui s'est passé."
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/dashboard.md'
---

[← Retour à l'index des docs](/docs/)

Le tableau de bord est votre base : chaque serveur, son état en direct, et un flux continu de ce qui s'est passé.

![Tableau de bord](/docs/images/dashboard.png)

## Les tuiles de résumé

En haut :

- **Serveurs en ligne** - combien de vos serveurs sont actuellement en cours d'exécution.
- **Joueurs connectés** - le nombre total de joueurs sur tous les serveurs en cours d'exécution.
- **Mises à jour disponibles** - combien de serveurs, de packs ou de mods ont une nouvelle version ([voir Mises à jour](/docs/updates/)).
- **Docker** - si le panneau peut atteindre le démon Docker, et sa version.

## Cartes de serveur

Chaque serveur s'affiche sous forme de carte avec son état (En cours d'exécution, Démarrage, Arrêté, Planté), le type et la version de Minecraft, et son port de jeu. Pour les serveurs en cours d'exécution, vous obtenez également l'utilisation en direct des **joueurs**, du **CPU**, de la **mémoire** et du **disque**, mise à jour en continu.

Cliquez sur une carte pour ouvrir ce serveur. La carte vide **Créer un serveur** et le bouton **Créer un serveur** dans la barre supérieure lancent tous deux l'[assistant de création](/docs/servers/).

Vous pouvez rechercher et trier vos serveurs, et basculer entre les vues en grille et en liste avec le sélecteur à droite.

## Activité récente

Le flux en bas est une piste d'audit en direct et lisible par l'homme : connexions, sauvegardes, exportations de blueprints, vérifications de mises à jour, changements de commandes de chat, démarrages et arrêts de serveurs, et plus encore. Chaque entrée est taguée avec le serveur auquel elle appartient (ou le panneau lui-même) et il y a combien de temps elle s'est produite. L'historique complet se trouve sur la page [Activité](/docs/activity/).
