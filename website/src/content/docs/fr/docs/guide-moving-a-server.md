---
title: 'Déplacer un serveur Minecraft vers un autre hôte'
description: 'Déplacer un monde est facile. Déplacer un serveur auquel les joueurs peuvent toujours se connecter, avec leurs inventaires, leurs maisons et leurs permissions intacts, est la partie qui pose problème.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/guide-moving-a-server.md'
---

[← Retour à l'index de la documentation](/docs/)

Déplacer un monde est facile. Déplacer un serveur auquel les joueurs peuvent toujours se connecter, avec leurs inventaires, maisons et permissions intacts, c'est là que les choses tournent mal. L'ordre ci-dessous limite le temps d'arrêt à quelques minutes et conserve une solution de repli si la nouvelle machine déçoit.

## Faites le point d'abord

Notez ces éléments avant de toucher quoi que ce soit. Chacun d'eux a mal terminé une migration lorsqu'il a été supposé plutôt que vérifié :

- **Version et chargeur de Minecraft**, exactement. 1.20.1 NeoForge n'est pas 1.20.1 Forge.
- **La liste des mods ou plugins avec leurs versions.** Le monde ne se chargera pas sans les mods qui l'ont créé.
- **Version de Java**, qui suit la version de Minecraft.
- **`level-name`** depuis `server.properties`. Le dossier du monde n'est souvent pas appelé `world`.
- **Mode en ligne.** Si l'ancien serveur fonctionnait avec `online-mode=false` et que le nouveau fonctionne avec `online-mode=true`, ou inversement, chaque joueur obtient un UUID différent et donc un inventaire tout neuf et vide. C'est l'erreur la plus douloureuse de cette page.
- **Tout ce qui vit en dehors du dossier du serveur**, comme une base de données MySQL d'un plugin.

## Copiez pendant qu'il tourne, puis copiez à nouveau pendant qu'il est arrêté

L'astuce pour un temps d'arrêt court est de faire la copie lente en premier.

1. **Pendant que le serveur tourne**, copiez l'intégralité du répertoire du serveur vers la nouvelle machine. Sur un grand monde, cela peut prendre une heure ; personne ne s'en rend compte, car rien ne s'est arrêté.
2. **Annoncez un redémarrage, puis arrêtez le serveur correctement.** Un arrêt gracieux permet au jeu de vider le monde ; tuer le processus ne le fait pas.
3. **Copiez à nouveau.** Seuls les fichiers qui ont changé sont déplacés cette fois-ci, donc cela prend de quelques secondes à quelques minutes.
4. **Démarrez-le sur la nouvelle machine**, sur un port non public si vous le pouvez, et connectez-vous vous-même. Vérifiez une base que vous connaissez, votre propre inventaire, et que les plugins ou mods se sont chargés sans erreurs.
5. **Ensuite**, dirigez les joueurs vers celui-ci.

`rsync -a --delete` est l'outil habituel pour les étapes 1 et 3. Conservez les permissions et les horodatages : un monde copié par le mauvais utilisateur est un serveur qui ne démarrera pas, et l'erreur ne le dira pas clairement.

## Ne supprimez pas encore l'ancien

Conservez l'ancienne machine, arrêtée mais intacte, pendant au moins quelques jours. C'est le seul véritable moyen de retour arrière. Gardez-la éteinte plutôt que allumée, afin que personne ne rejoigne accidentellement la copie abandonnée et n'y construise pendant une semaine.

## Faites en sorte que l'adresse survive au déménagement

Si les joueurs se connectent à une adresse IP brute, chaque déménagement oblige tous les joueurs à modifier leur liste de serveurs, et certains d'entre eux ne le font jamais.

Utilisez un nom d'hôte que vous contrôlez, pointant vers le serveur. Le déménagement devient alors un changement de DNS, et l'adresse dans le client de chacun reste la même. Diminuez le temps de vie (TTL) de l'enregistrement un jour avant le déménagement afin que le changement se propage rapidement.

Si vous voulez que les joueurs tapent un domaine brut pendant que le serveur tourne sur un port non standard, un enregistrement SRV le permet. C'est le même mécanisme que les hébergeurs commerciaux utilisent pour distribuer `play.something.net`.

## Vérifiez la nouvelle machine avant de lui faire confiance

Trois choses qui diffèrent entre les hôtes et qui posent problème après le déménagement :

- **Le pare-feu.** Votre port de jeu doit être ouvert, et uniquement votre port de jeu. N'exposez pas un panneau de gestion ou une carte à Internet juste parce que cela fonctionnait en localhost.
- **Vitesse d'un seul cœur.** Minecraft se soucie beaucoup plus de la vitesse d'un cœur que de leur nombre. Huit cœurs lents sembleront moins performants que deux cœurs rapides.
- **Disque.** Un monde sur un stockage rotatif ou un volume fortement partagé stuttera lors du chargement des chunks.

## Quitter un panneau géré

Si vous venez d'un hébergeur qui vous a fourni un panneau de contrôle plutôt qu'une machine, trouvez le gestionnaire de téléchargement ou de fichiers, et prenez l'intégralité du répertoire du serveur plutôt que juste le monde. Obtenez les fichiers jar des plugins et des mods eux-mêmes, pas une liste : les versions comptent, et "latest" est un fichier différent le mois prochain.

Vérifiez également que vos sauvegardes vous appartiennent. Une sauvegarde qui n'existe qu'à l'intérieur du panneau que vous quittez n'est pas une sauvegarde que vous possédez.

## Dans Minecraft Server Manager

L'ensemble du panneau est un seul répertoire. Le copier sur une autre machine et démarrer le panneau là-bas amène avec lui chaque serveur, monde, sauvegarde et paramètre, ce qui fait du déménagement du panneau lui-même une copie plutôt qu'une migration.

Pour un seul serveur plutôt que tous, un blueprint capture sa configuration, son ensemble de mods et la version du pack épinglé (et, si vous le cochez, le monde actif) sous la forme d'un seul fichier `.mcserver.zip` qui peut être importé sur un autre panneau pour reconstruire le même serveur. Les mondes peuvent être téléchargés et installés séparément lorsque seul le monde doit être déplacé.

Si le port de jeu qu'un serveur utilisait est déjà occupé sur la nouvelle machine, ou si vous souhaitez tester d'abord sur un port non public, changez-le dans **Paramètres → Configuration** : la carte **Port de jeu** contient **Utiliser le prochain port libre**, un serveur en cours d'exécution demande avant de redémarrer sur le nouveau port, et s'il ne peut pas démarrer là, il revient à l'ancien. Passez-le au port public lorsque vous dirigez les joueurs vers celui-ci.

Connexe : [blueprints](/docs/blueprints/), [sauvegardes qui restaurent réellement](/docs/guide-backups/), [mondes et fichiers](/docs/worlds-and-files/).
