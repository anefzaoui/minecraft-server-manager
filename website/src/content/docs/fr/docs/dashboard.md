---
title: 'Le tableau de bord'
description: "Le tableau de bord est votre base : chaque serveur, son état en direct et un flux continu de ce qui s'est passé."
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/dashboard.md'
---

[← Retour à l'index des docs](/docs/)

Le tableau de bord est votre base : chaque serveur, son état en direct, et un flux continu de ce qui s'est passé.

![Tableau de bord](/docs/images/dashboard.png)

## Les tuiles de résumé

Tout en haut :

- **Serveurs en ligne** : combien de vos serveurs fonctionnent actuellement, sur le total.
- **Joueurs connectés** : le nombre total de joueurs sur tous les serveurs en cours d'exécution.
- **Mises à jour disponibles** : combien de serveurs, packs ou mods ont une nouvelle version ([voir Mises à jour](/docs/updates/)).
- **Docker** : si le panneau peut atteindre le démon Docker, et sa version.

Une deuxième ligne ajoute la **Mémoire allouée** (et combien est utilisée), le **Stockage utilisé** sur tous les dossiers de données des serveurs, la **Santé · 24h** (plantages, arrêts par manque de mémoire, et redémarrages automatiques du dernier jour), et les **Mises à jour** réparties entre les mods et les mises à jour au niveau du serveur. En dessous, **Serveurs par état** compte vos serveurs dans chaque état, et l'**Aperçu des ressources** représente la part de chaque serveur en mémoire et CPU.

## Cartes de serveur

Chaque serveur s'affiche sous forme de carte avec son état (En cours d'exécution, Démarrage, Arrêté, Planté, et des états intermédiaires comme Non sain ou Bloqué), le type et la version de Minecraft, son port de jeu, et ses tags. Chaque carte affiche l'utilisation des **joueurs** et du **disque** par rapport à la quota ; les serveurs en cours d'exécution affichent également le **CPU** et la **mémoire** en direct, mis à jour en continu.

Cliquez sur une carte pour ouvrir ce serveur. La carte vide **Créer un serveur** et le bouton **Créer un serveur** en haut de la page lancent tous deux l'assistant de [création](/docs/servers/).

Vous pouvez rechercher vos serveurs (par nom, type, version ou tag), les trier par état, nom, taille, dernière mise en marche ou date de création, et basculer entre les vues en grille et en liste avec le sélecteur à droite.

## Activité récente

Le flux en bas affiche les entrées les plus récentes du journal d'audit lisible par l'homme du panneau : connexions, sauvegardes, exportations de plans, vérifications de mises à jour, modifications des commandes de chat, démarrages et arrêts de serveurs, et plus encore. Chaque entrée est taguée avec le serveur auquel elle appartient (ou le panneau lui-même) et il y a combien de temps elle s'est produite. **Tout afficher** ouvre l'historique complet sur la page [Activité](/docs/activity/).
