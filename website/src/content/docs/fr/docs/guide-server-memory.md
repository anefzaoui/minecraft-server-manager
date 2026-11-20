---
title: 'Quelle quantité de RAM un serveur Minecraft nécessite-t-il ?'
description: 'Quelle quantité de RAM un serveur Minecraft nécessite pour du vanilla, Paper, des mods légers et de gros modpacks, et quelle quantité laisser pour la machine.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/guide-server-memory.md'
---

[← Retour à l'index de la documentation](/docs/)

Réponse courte, pour un serveur sur lequel on va réellement jouer :

| Ce que vous exécutez                         | Tas Java (heap) | Donnez à la machine |
| -------------------------------------------- | --------------- | ------------------- |
| Vanilla ou Paper, jusqu'à 10 joueurs         | 2 Go            | 4 Go                |
| Paper avec plugins, 10 à 30 joueurs          | 4 Go            | 6 Go                |
| Un pack de mods léger, 40 à 80 mods          | 4 Go            | 6 Go                |
| Un gros pack "kitchen-sink", 150 à 300 mods  | 6 à 8 Go        | 10 Go               |
| GregTech New Horizons et monstres similaires | 8 à 12 Go       | 16 Go               |

Deux nombres, pas un. C'est la partie que la plupart des guides omettent, et c'est la raison pour laquelle les gens achètent un serveur de 4 Go, donnent 4 Go à Java, puis le regardent mourir.

## Le tas (heap) et la machine sont des nombres différents

Le tas Java (`-Xmx`) est la quantité de mémoire que le jeu lui-même peut utiliser pour le monde, les entités et les données des mods. La machine, ou le conteneur, doit contenir ce tas **plus** tout ce dont Java a besoin : métadonnées de classe, piles de threads, comptabilité du garbage collector, tampons réseau et la JVM elle-même. Ce surcoût est d'environ 0,5 à 1,5 Go pour un serveur moddé.

Si le tas est égal à la mémoire de la machine, le noyau tue le serveur dès que Java atteint ce surcoût. Dans Docker, cela se manifeste par le code de sortie 137, et dans les logs par rien du tout : le processus disparaît simplement en plein milieu d'une phrase. Les gens blâment généralement un mod.

Une règle sûre : **tas plus 25 %, et au moins un gigaoctet de réserve.** Un tas de 8 Go nécessite une machine de 10 Go.

## Plus de RAM ne signifie pas plus de performance

Minecraft est limité par un seul thread dans la plupart de ses opérations. Donner 16 Go à un pack de 40 mods ne rend pas la génération des chunks plus rapide ; cela rend chaque pause de garbage collection plus longue, car il y a plus à parcourir. Un serveur qui saccade toutes les trente secondes est souvent un serveur avec un tas trop grand, pas trop petit.

Augmentez le tas lorsque vous voyez ceci, et pas autrement :

- `java.lang.OutOfMemoryError: Java heap space` dans le log.
- Des messages répétés "Can't keep up! Is the server overloaded?" avec des pauses de garbage collection dans les timings.
- L'utilisation de la mémoire qui monte jusqu'au plafond et y reste bloquée pendant des heures.

## Pourquoi votre serveur affiche 12 Go utilisés alors que personne n'est en ligne

Parce que vous le lui avez dit. Deux paramètres par défaut conspirent :

1. L'image Docker courante définit le tas de départ égal au maximum, donc `-Xms` et `-Xmx` sont tous deux votre nombre. Java le réclame d'emblée plutôt que de le faire croître.
2. L'ensemble populaire de flags Aikar inclut `-XX:+AlwaysPreTouch`, qui parcourt chaque page de ce tas au démarrage afin que les pages soient réellement allouées. C'est délibéré : cela échange un démarrage plus lent et un chiffre inactif élevé contre moins de pauses plus tard.

Mesuré sur Paper 1.21.1 avec un tas de 2 Go dans un conteneur de 4 Go, échantillonné pendant trois minutes après le chargement complet du monde :

| Configuration                                | Mémoire résidente |
| -------------------------------------------- | ----------------- |
| Pas de flags                                 | 2.60 GiB          |
| Flags Aikar                                  | 2.59 GiB          |
| Flags Aikar sans `AlwaysPreTouch`            | 1.95 GiB          |
| Flags Aikar avec un tas de départ de 512 Mo  | 1.38 GiB          |
| Pas de flags avec un tas de départ de 512 Mo | 1.25 GiB          |

Ainsi, un serveur "utilisant" 12 Go au repos est généralement un tas de 12 Go qui a été pré-touché, pas une fuite. Votre surveillance le lit correctement ; le nombre ne signifie juste pas ce qu'il semble indiquer.

Si vous voulez un chiffre de repos honnête, définissez le tas de départ plus bas que le maximum. Vous le payez avec quelques collections supplémentaires au début. Si vous préférez des temps d'image stables, laissez-le tranquille et arrêtez de regarder le graphique.

## Les joueurs comptent moins que vous ne le pensez

Doubler de 10 à 20 joueurs coûte beaucoup moins cher qu'ajouter cinquante mods. Les joueurs ajoutent principalement des entités et des chunks chargés, qui évoluent doucement. Les mods ajoutent des données de classe, des registres, des fonctionnalités de génération de monde et leurs propres caches, ce qui n'est pas le cas. La taille pour le pack d'abord, puis ajoutez environ 100 à 200 Mo par joueur régulier sur un serveur moddé.

La distance d'affichage est l'autre levier important. Passer de 12 à 8 chunks peut économiser un gigaoctet sur un serveur chargé et est à peine perceptible en jeu.

## Dans Minecraft Server Manager

Chaque serveur a deux champs distincts, **Tas Java** et **Limite de mémoire du conteneur**, précisément parce qu'il s'agit de questions différentes. L'assistant de création définit la limite du conteneur 50 % au-dessus du tas pour vous, et le panneau refuse d'enregistrer un serveur dont la limite du conteneur n'est pas supérieure à son tas, car cette combinaison se termine par le code de sortie 137 plutôt que par un message d'erreur.

Le compteur de mémoire d'un serveur affiche ce que le conteneur utilise réellement, avec une note lorsque le tas a été réclamé d'emblée, de sorte qu'un tas pré-touché ne soit pas lu comme incontrôlable. Un serveur que le noyau a arrêté pour cause de mémoire est enregistré comme tel dans l'historique, plutôt que comme un crash mystérieux.

Connexe : [création et gestion des serveurs](/docs/servers/),
[rapports de crash](/docs/servers/#crash-reports--mclogs-analysis), [stockage et quotas](/docs/storage/).
