---
title: 'Réduire une carte'
description: "Avec le temps, une carte s'étend : chaque endroit où un joueur a marché, volé ou"
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/world-shrink.md'
---

[← Retour à l'index des docs](/docs/)

Au fil du temps, un monde s'étend : chaque endroit où un joueur a marché, volé ou a été transporté par une perle de l'End laisse des chunks générés sur le disque, même si personne n'y est jamais retourné. **Réduire le monde** supprime les chunks dans lesquels presque personne n'a passé de temps, de sorte que le monde prend moins de place. Minecraft reconstruit une zone supprimée à partir de la graine du monde au moment où quelqu'un y retourne, c'est donc sans danger pour les terres que personne n'utilise, mais tout ce qu'un joueur a _construit_ dans un endroit où il ne s'est à peine tenu serait également supprimé, c'est pourquoi vous devriez d'abord faire une sauvegarde (la sauvegarde est l'annulation).

## Ce qui est considéré comme "rarement visité"

Chaque chunk enregistre le temps que les joueurs ont passé debout dedans (Minecraft appelle cela `InhabitedTime`). Réduire le monde supprime tout chunk ayant moins de **30 secondes** de temps total passé par les joueurs par défaut ; la boîte de dialogue de réduction vous permet de modifier ce seuil (de 1 seconde à 1 heure) et le nombre de chunks autour du point de spawn à conserver (8 par défaut, `0` désactive la protection du spawn).

Ce qui est conservé, toujours :

- La zone autour du **point de spawn** du monde (lue depuis `level.dat`) dans l'overworld. Le Nether, l'End et les dimensions personnalisées n'ont pas de zone de spawn.
- Tout chunk dont le temps de visite n'a pas pu être lu, par exemple un monde sauvegardé avec un format de compression que le panneau ne décode pas (LZ4). L'aperçu et le résultat vous indiquent combien de tels chunks ont été ignorés.

Chaque dimension du monde est couverte : les dossiers frères de style Bukkit (`world_nether`, `world_the_end`) ainsi que la disposition vanilla et Forge/Fabric (`world/DIM-1`, `world/DIM1`, `world/dimensions/<namespace>/<name>`). Lorsqu'un chunk est supprimé, ses entités et ses points d'intérêt de villageois disparaissent avec lui, de sorte qu'un chunk régénéré n'hérite pas de mobs obsolètes, de wagons de mine ou de sites de travail.

## Faire cela depuis l'onglet Mondes

1. Faites une sauvegarde depuis l'onglet **Sauvegardes**. La réduction depuis l'onglet Mondes n'en fait pas une pour vous.
2. Ouvrez **Monde → Mondes**, trouvez le monde et cliquez sur l'icône de réduction.
3. Cliquez sur **Aperçu** pour voir approximativement combien de chunks (et combien de mégaoctets) seraient supprimés. Rien n'est encore modifié ; un aperçu fonctionne pendant que le serveur est en cours d'exécution.
4. Cliquez sur **Réduire le monde**. La réduction modifie directement les fichiers du monde, le serveur doit donc être arrêté : arrêtez-le d'abord, ou cochez l'option pour l'arrêter, le réduire, puis le redémarrer en une seule fois (le serveur est redémarré même si la réduction échoue). La progression s'affiche dans la barre des tâches.

![Réduire le monde](/docs/images/world-shrink.png)

## Faire cela dans le cadre d'une sauvegarde

Dans l'onglet **Sauvegardes**, cochez **"Réduire également le monde après"** avant de cliquer sur **Sauvegarder maintenant**. L'archive de sauvegarde est écrite en premier (cette archive est votre annulation), puis le monde est réduit, mais seulement si le serveur est arrêté. Si le serveur est en cours d'exécution, la sauvegarde s'exécute toujours et la réduction est ignorée avec une note.

Les sauvegardes planifiées ont la même option : dans l'éditeur de planification, choisissez la tâche **Sauvegarde** et cochez **"Réduire le monde après chaque sauvegarde"**. Associez-la à une planification **Arrêter le serveur** quelques minutes plus tôt si vous souhaitez qu'elle s'exécute sans surveillance.
