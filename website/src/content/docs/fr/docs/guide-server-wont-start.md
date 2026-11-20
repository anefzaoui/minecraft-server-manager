---
title: 'Votre serveur Minecraft ne démarre pas'
description: "Un serveur Minecraft qui ne démarre pas, résolu par ordre de probabilité : le journal, la version Java, la mémoire, l'EULA et le port, et les mods."
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/guide-server-wont-start.md'
---

[← Retour à l'index de la documentation](/docs/)

Travaillez cette liste. Elle est ordonnée par la fréquence à laquelle chaque point répond à la question, et les quatre premiers couvrent la plupart des cas.

## 1. Lisez les vingt dernières lignes, pas les premières

Faites défiler jusqu'à la **fin** du journal. Une trace de pile Java est imprimée de l'intérieur vers l'extérieur, donc le haut du mur de texte est la partie la moins intéressante. Ce que vous voulez, c'est la dernière ligne `Caused by:` et ce qui suit. Cette seule ligne nomme généralement le problème.

Deux indices vous indiquent où vous en êtes :

- `Exception in thread "main"` ou un chemin de rapport de crash près de la fin signifie que le jeu lui-même a échoué.
- Le journal s'arrête simplement en plein milieu d'une ligne, sans aucune exception, signifie que quelque chose a tué le processus de l'extérieur. Passez au point 3.

## 2. UnsupportedClassVersionError signifie le mauvais Java

```
java.lang.UnsupportedClassVersionError: net/minecraft/server/Main has been compiled
by a more recent version of the Java Runtime (class file version 65.0)
```

La classe 52 est Java 8, 60 est 16, 61 est 17, 65 est 21, 69 est 25. Le message signifie que le serveur a besoin d'un Java plus récent que celui sur lequel il s'exécute ; l'inverse, un ancien pack sur un nouveau Java, échoue généralement avec une erreur de mixin ou de réflexion à la place.

| Version de Minecraft | Java |
| -------------------- | ---- |
| 1.16.5 et antérieur  | 8    |
| 1.17                 | 16   |
| 1.18 et 1.19         | 17   |
| 1.20 à 1.20.4        | 17   |
| 1.20.5 à 1.21.x      | 21   |
| 26.1 et ultérieur    | 25   |

Les anciens packs ont vraiment besoin de Java 8. Plus récent n'est pas mieux ici.

## 3. Le code de sortie 137 est le noyau, pas un mod

Le journal s'arrête en plein milieu d'une phrase, il n'y a pas de rapport de crash, et le conteneur signale 137. C'est une interruption pour manque de mémoire : le processus a demandé de la mémoire que la machine n'avait pas, il a donc été terminé.

Presque toujours, le tas Java a été défini sur le même nombre que la mémoire de la machine. Le tas a besoin de la mémoire de la machine **moins** la surcharge propre à la JVM, qui est de 0,5 à 1,5 Go sur un serveur moddé. Réduisez le tas, ou augmentez la machine. [Quelle quantité de RAM un serveur a besoin](/docs/guide-server-memory/) contient les chiffres.

## 4. Le EULA et le port

Deux classiques avec des solutions en une ligne :

- `You need to agree to the EULA in order to run the server.` Définissez `eula=true`, dans `eula.txt` ou avec la variable d'environnement que votre configuration utilise.
- `Address already in use` ou `FAILED TO BIND TO PORT`. Quelque chose d'autre utilise le port 25565, souvent une copie précédente du même serveur qui ne s'est jamais complètement arrêté. Trouvez-la et arrêtez-la plutôt que de changer le port, sinon vous vous retrouverez avec deux.

## 5. Un mod manque de sa dépendance

```
Mod X requires mod Y, which is missing
Fabric API is not installed
```

Les mods Fabric ont majoritairement besoin de Fabric API comme fichier séparé. Les mods Forge et NeoForge listent leurs dépendances dans l'erreur elle-même. Installez la version nommée, pas la plus récente : "requires 0.91.x" signifie cette ligne, et 0.92 échouera au même contrôle.

Parfois, la dépendance manquante est le chargeur lui-même :

```
Mod X requires forge 47.4.14 or above
Mod ID: 'forge', Requested by: 'x', Expected range: '[47.4.14,)', Actual version: '47.4.10'
```

La solution est une version plus récente du chargeur, pas un mod différent. "47.4.14 or above" signifie n'importe quelle version à partir de là, et Forge ne publie pas tous les numéros, donc la version à installer peut être la suivante. Sur un modpack, mettez à jour le pack d'abord : un pack dont la version du chargeur est trop ancienne pour ses mods est un bug que son auteur doit corriger.

## 6. Un mod est pour le mauvais chargeur ou la mauvaise version

Un fichier jar pour un chargeur différent ne plante pas poliment. Attendez-vous à une erreur de mixin, un `NoClassDefFoundError`, ou un crash à l'intérieur d'une classe dont vous n'avez jamais entendu parler. Vérifiez la page du jar : le chargeur et la version de Minecraft doivent correspondre exactement. 1.20.1 et 1.20.4 sont des jeux différents en ce qui concerne les mods.

## 7. Le monde provient d'une version plus récente

```
This world was created by a newer version of Minecraft
```

Les mondes se mettent à jour vers l'avant et jamais vers l'arrière. Restaurez la sauvegarde d'avant la mise à jour, ou exécutez la version attendue par le monde. Il n'y a pas de chemin de rétrogradation qui conserve les chunks intacts.

## Quand ça a planté après avoir fonctionné pendant des semaines

Question différente, réponse généralement différente :

- **Ça a planté sous charge**, avec des timings montrant de longues pauses : garbage collection, donc regardez la taille du tas avant les mods.
- **Ça a planté au même endroit dans le monde** : un chunk corrompu ou une entité cassée. Le rapport de crash nomme généralement les coordonnées.
- **Ça a planté juste après une mise à jour** : le mod qui a été mis à jour est le suspect, même si la trace pointe ailleurs. Revenez en arrière et voyez.
- **Ça a planté au redémarrage, alors que ça fonctionnait avant** : vérifiez le disque. Un disque plein produit des erreurs spectaculaires et trompeuses.

## Obtenir de l'aide qui aide vraiment

Postez le **journal complet**, pas la dernière ligne, et dites ce que vous avez changé avant que ça ne casse. Collez-le quelque part conçu pour cela, comme [mclo.gs](https://mclo.gs), plutôt que dans le chat. Incluez la version de Minecraft, le chargeur, le pack et sa version, et la quantité de tas dont dispose le serveur. Un rapport avec ces quatre informations obtient une réponse en une seule fois ; sans elles, cela prend cinq réponses.

## Dans Minecraft Server Manager

Les plantages sont détectés à partir de la sortie du conteneur lui-même, donc un serveur qui meurt à trois heures du matin est enregistré avec son extrait de journal plutôt que retrouvé le lendemain. Les suspects habituels sur cette page (le EULA, le mauvais Java, un monde d'une version plus récente, un port déjà utilisé, la mémoire Java épuisée) sont reconnus dans ce journal et nommés dans l'entrée de l'historique avec quoi faire à leur sujet, et le redémarrage automatique les ignore, car le redémarrage ne les corrigera pas. Les rapports de crash sont analysés à leur arrivée : l'exception est mise en évidence, la pile est rétractable, et les mods qui apparaissent dans la trace sont listés comme suspects.

N'importe quel rapport peut être partagé sur mclo.gs depuis sa carte lorsque vous avez besoin d'aide (après confirmation, car la copie est publique), et le menu **Télécharger** de la console contient tous les fichiers journaux dans un seul zip, donc "poster le journal complet" est un téléchargement plutôt qu'un projet d'archéologie. Une interruption pour manque de mémoire est enregistrée comme telle, ce qui évite l'heure habituelle à blâmer un mod. Si quelque chose d'autre a vraiment besoin du port, la carte **Port du jeu** dans **Paramètres → Configuration** déplace le serveur vers un port libre.

Un chargeur trop ancien est changé depuis l'onglet **Versions** du serveur, ce qui vérifie que la version existe et fait une sauvegarde avant de reconstruire le serveur ([changer la version du chargeur de mod](/docs/updates/#changing-the-mod-loader-version)).

Connexe : [quelle quantité de RAM un serveur a besoin](/docs/guide-server-memory/), [choisir un chargeur](/docs/guide-choosing-a-loader/), [créer et gérer des serveurs](/docs/servers/).
