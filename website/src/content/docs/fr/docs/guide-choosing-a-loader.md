---
title: 'Vanilla, Paper, Fabric, Forge, NeoForge, Quilt : lequel choisir ?'
description: 'Vanilla, Paper, Fabric, Forge, NeoForge ou Quilt : quel type de serveur Minecraft exécuter, en fonction de ce que vos joueurs installent.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/guide-choosing-a-loader.md'
---

[← Retour à l'index de la documentation](/docs/)

Choisissez en fonction de ce que vous voulez que les joueurs installent, pas de ce qui semble le plus rapide.

| Vous voulez                                         | Lancez ceci        | Les joueurs installent |
| --------------------------------------------------- | ------------------ | ---------------------- |
| Survie entre amis, rien d'inhabituel                | Vanilla            | Rien                   |
| Un serveur public avec grades, claims et modération | Paper              | Rien                   |
| Un modpack spécifique de CurseForge ou Modrinth     | Ce qui est indiqué | Le pack                |
| Un modpack moderne que vous créez vous-même         | Fabric ou NeoForge | Les mêmes mods         |
| Un ancien pack de l'ère 1.7 à 1.12                  | Forge              | Les mêmes mods         |

C'est la décision pour la plupart des gens. Le reste de cette page explique pourquoi.

## Les plugins et les mods ne sont pas la même chose

C'est la distinction sur laquelle tout le reste repose.

Les **plugins** ne s'exécutent que sur le serveur. Paper, Spigot et Bukkit les chargent. Les joueurs se connectent avec un client ordinaire non modifié et ne s'en rendent jamais compte. Tout ce qui concerne fondamentalement les règles, les permissions, les économies, les claims, les minigames ou la modération est un plugin, et c'est pourquoi presque tous les serveurs publics exécutent Paper.

Les **mods** modifient le jeu lui-même : nouveaux blocs, nouvelles dimensions, nouvelles machines. Le client doit charger les mêmes mods que le serveur, sinon il ne peut pas comprendre ce que le serveur lui dit. Quiconque rejoint un serveur moddé installe d'abord le pack.

Un serveur ne peut pas être significativement les deux. Des projets hybrides existent qui ajoutent une API de plugin à un chargeur de mods, et ils fonctionnent jusqu'à ce qu'ils ne le fassent plus, généralement au pire moment. Si vous avez besoin des deux, exécutez un proxy avec un serveur moddé et un serveur de plugins derrière lui plutôt qu'un seul hybride.

## Le côté plugin

**Paper** est la réponse par défaut. C'est un fork de Spigot avec des années de travail sur les performances et un fichier de configuration pour presque tous les comportements qui ont jamais agacé un administrateur. Les plugins Vanilla de l'ère Bukkit fonctionnent encore pour la plupart.

**Purpur** est un fork de Paper avec encore plus de réglages, y compris ceux liés au gameplay. Prenez-le si vous voulez ces interrupteurs spécifiques ; sinon, Paper.

**Vanilla** vaut la peine d'être exécuté lorsque l'objectif est le jeu inchangé. Il est plus lent avec de nombreux joueurs et n'a pas de système de permissions, donc la modération est manuelle.

Paper modifie certains comportements vanilla par défaut au nom des performances. Si un engin de redstone d'une vidéo ne fonctionne pas sur votre serveur, c'est généralement la raison, et c'est généralement un réglage.

## Le côté mod

**Fabric** est léger, se met à jour vers une nouvelle version de Minecraft en quelques jours et intègre la plupart des mods de performance modernes. Presque tous les mods Fabric nécessitent également le Fabric API, qui est un téléchargement séparé. Si votre objectif est un serveur rapide avec une poignée de mods de confort, c'est celui-ci.

**NeoForge** est là où l'ancien écosystème Forge fait maintenant son travail pour les versions actuelles. Il s'est séparé de Forge pendant la 1.20.1, et la plupart des gros packs construits pour la 1.20.2 et les versions ultérieures le ciblent. Si vous démarrez un nouveau pack lourd aujourd'hui, c'est celui-ci.

**Forge** détient toujours le passé. Tout ce qui vient des ères 1.7.10, 1.12.2 et 1.16.5, ce qui représente une grande partie des packs appréciés, est Forge et le restera toujours. Gardez-le pour ceux-là.

**Quilt** est un fork de Fabric qui exécute la plupart des mods Fabric. Il existe pour de bonnes raisons, mais si vous n'avez aucune raison spécifique de le choisir, choisissez Fabric.

Les mods pour un chargeur ne fonctionnent pas sur un autre. Une page de mod qui dit Fabric signifie Fabric.

## Si vous installez un pack, le pack décide

Ne choisissez pas. Le pack indique son chargeur et sa version exacte de Minecraft, et les deux doivent correspondre. "Assez proche" n'existe pas ici : un pack pour 1.20.1 ne fonctionne pas sur 1.20.4, et un pack 1.20.1 NeoForge ne fonctionne pas sur 1.20.1 Forge.

Installez le pack par son ID ou son lien plutôt qu'en sélectionnant manuellement les mods, et épinglez la version. Les packs sont mis à jour, et une mise à jour qui vous tombe dessus en milieu de saison est la cause de la corruption des mondes.

## Quelle version de Java

L'exigence de Minecraft évolue avec le jeu, et l'exécution de la mauvaise version produit une `UnsupportedClassVersionError` peu utile plutôt qu'un message clair.

| Version de Minecraft | Java |
| -------------------- | ---- |
| 1.16.5 et antérieur  | 8    |
| 1.17                 | 16   |
| 1.18 et 1.19         | 17   |
| 1.20 à 1.20.4        | 17   |
| 1.20.5 à 1.21.x      | 21   |
| 26.1 et ultérieur    | 25   |

Les anciens packs ont vraiment besoin de Java 8 ; c'est l'un des rares endroits en informatique où la dernière version est la mauvaise.

## Dans Minecraft Server Manager

L'assistant de création vous demande ce que vous voulez exécuter et choisit la version de Java dans le tableau ci-dessus, de sorte que l'incompatibilité n'arrive jamais par accident. Vanilla, Paper et Purpur se trouvent dans l'onglet **Vanilla** ; l'onglet **À partir de mods** accepte Fabric, Forge, NeoForge ou Quilt, avec la version de Minecraft et une version du chargeur (la dernière, ou une que vous épinglez). L'installation d'un pack depuis CurseForge, Modrinth ou GT New Horizons l'épingle à une version exacte. La mise à niveau ne se produit que lorsque vous l'appliquez (ou après la vérification quotidienne, si la politique de mise à jour du serveur est **Mise à jour automatique**), effectue toujours une sauvegarde au préalable et peut être annulée.

Le navigateur de mods sait quel chargeur un serveur exécute et filtre ce qu'il propose en conséquence, de sorte qu'un jar Fabric ne puisse pas atterrir par erreur sur un serveur NeoForge.

Connexe : [création et gestion de serveurs](/docs/servers/), [modpacks](/docs/modpacks/),
[combien de RAM un serveur a besoin](/docs/guide-server-memory/).
