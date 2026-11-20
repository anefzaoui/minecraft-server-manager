---
title: 'Documentation'
description: 'Un panneau de contrôle complet et auto-hébergé pour itzg/docker-minecraft-server.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/README.md'
---

Une interface d'administration complète, auto-hébergée, pour [itzg/docker-minecraft-server](https://github.com/itzg/docker-minecraft-server). Créez, exécutez et gérez des serveurs Minecraft depuis votre navigateur. Pas de ligne de commande, pas d'édition manuelle de YAML.

![Tableau de bord](/docs/images/dashboard.png)

## Commencez ici

- **[Premiers pas](/docs/getting-started/)** - configuration initiale, connexion et prise en main.
- **[Le tableau de bord](/docs/dashboard/)** - vue d'ensemble de tous les serveurs, des joueurs et de l'activité.

## Serveurs en cours d'exécution

- **[Création et gestion des serveurs](/docs/servers/)** - l'assistant de création, les types de serveurs, les versions et les paramètres par serveur.
- **[Console et commandes de chat](/docs/console-and-chat/)** - la console en direct et les commandes de chat personnalisées en jeu qui s'exécutent en tant que joueur.
- **[Modpacks](/docs/modpacks/)** - installez les packs CurseForge, Modrinth, FTB et GT New Horizons, toujours épinglés à une version exacte.
- **[Mondes et fichiers](/docs/worlds-and-files/)** - échangez des mondes, gérez des mods et modifiez des fichiers directement dans le navigateur.
- **[Réduction d'un monde](/docs/world-shrink/)** - récupérez de l'espace disque en supprimant les chunks jamais visités, seul ou dans le cadre d'une sauvegarde.
- **[Carte en direct](/docs/live-map/)** - une carte 3D BlueMap en un clic, derrière la connexion du panneau.
- **[Invitations et page de statut](/docs/invites-and-status-page/)** - l'adresse, le texte d'invitation et le modpack client pour les amis, et une page de statut publique.

## Données et automatisation

- **[Chatbot par serveur](/docs/chatbot/)** - conversation locale/compatible OpenAI, diffusion, transcriptions conservées et pouvoirs de jeu limités.
- **[Sauvegardes](/docs/backups/)** - instantanés en un clic, sauvegardes planifiées, nombre à conserver (global ou par serveur) et restauration.
- **[Blueprints](/docs/blueprints/)** - capturez la configuration complète d'un serveur et créez-en de nouveaux à partir de celle-ci.
- **[Planifications](/docs/schedules/)** - redémarrages, sauvegardes et commandes pilotés par cron.
- **[Stockage](/docs/storage/)** - utilisation du disque par serveur et quotas appliqués par le panneau.
- **[Mises à jour](/docs/updates/)** - suivez les nouvelles versions de serveurs, de packs, d'images et de mods, vérifiez quelles versions de Minecraft vos mods prennent en charge et annulez une mise à jour de mod.
- **[Journal d'activité](/docs/activity/)** - une piste d'audit de tout ce qui s'est passé.
- **[Intégrations](/docs/integrations/)** - notifications webhook Discord et la catégorie Alertes.
- **[API publique](/docs/public-api/)** - une API HTTP en lecture seule, authentifiée par jeton, pour récupérer le statut du serveur depuis l'extérieur du panneau.

## Comptes et sécurité

- **[Utilisateurs et rôles](/docs/users-and-roles/)** - administrateur, opérateur et spectateur, ce que chacun peut faire, et les permissions par serveur qui les affinent.
- **[Authentification à deux facteurs](/docs/two-factor-authentication/)** - protégez votre connexion avec une application d'authentification.

## Guides

Non spécifiques à ce panneau : les questions que tout propriétaire de serveur Minecraft rencontre.

- **[Quelle quantité de RAM un serveur nécessite-t-il ?](/docs/guide-server-memory/)** - les deux chiffres à définir, et pourquoi un serveur inactif consomme 12 Go.
- **[Vanilla, Paper, Fabric, Forge, NeoForge, Quilt](/docs/guide-choosing-a-loader/)** - lequel exécuter, et la différence entre plugins/mods derrière ce choix.
- **[Votre serveur ne démarre pas](/docs/guide-server-wont-start/)** - lire le journal, et les quelques causes derrière la plupart des échecs.
- **[Sauvegardes qui se restaurent réellement](/docs/guide-backups/)** - copies cohérentes, quoi d'autre à conserver, et tester une sauvegarde avant d'en avoir besoin.
- **[Déplacer un serveur vers un autre hôte](/docs/guide-moving-a-server/)** - l'ordre qui maintient une faible interruption de service et des inventaires intacts.

## Sous le capot

- **[Architecture](/docs/architecture/)** - comment le panneau est construit.
- **[Le site web](/docs/website/)** - comment minecraft-server-manager.com est construit, traduit et déployé à partir de ce dépôt.

---

> Les captures d'écran dans ces documents sont prises dans le thème sombre du panneau. Le panneau démarre en mode sombre, sauf si votre système d'exploitation préfère le mode clair ; utilisez le sélecteur de thème dans la barre supérieure pour changer.
