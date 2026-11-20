---
title: 'Sauvegardes de serveur Minecraft qui se restaurent réellement'
description: 'Comment réaliser des sauvegardes de serveur Minecraft qui se restaurent réellement : copies cohérentes, conservées ailleurs et testées au moins une fois.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/guide-backups.md'
---

[← Retour à l'index des docs](/docs/)

La plupart des serveurs ont des sauvegardes. Beaucoup moins ont des sauvegardes qui fonctionnent, et la différence n'est jamais découverte que lors du pire jour. Trois choses les distinguent : la copie est cohérente, elle se trouve ailleurs, et quelqu'un l'a restaurée au moins une fois.

## Copier le monde pendant qu'il n'est pas écrit

Un serveur en cours d'exécution écrit continuellement des fichiers de région. Copiez-les en cours d'écriture et vous obtiendrez un fichier qui est à moitié ancien et à moitié nouveau, qui soit ne se charge pas, soit se charge avec un trou dans le sol là où la base de quelqu'un se trouvait. Rien ne vous avertit, car la copie a réussi.

Il y a deux bonnes façons de faire une copie :

1. **Arrêter le serveur**, copier, puis le redémarrer. Simple, honnête et impopulaire en raison de l'interruption de service.
2. **Demander au jeu d'arrêter d'écrire d'abord.** Exécutez `save-off`, puis `save-all flush`, attendez que cela se termine, copiez, puis `save-on`. Le monde est complet et silencieux pendant la durée de la copie.

Ne sautez jamais directement à la copie. Un instantané au niveau du système de fichiers ou du volume n'est valable que s'il est véritablement atomique, et un `cp -r` pendant que les joueurs placent des blocs ne l'est pas.

## Sauvegarder plus que le monde

Restaurer le monde seul vous donne le terrain et fait perdre le serveur. Vous voulez aussi :

- `server.properties`, et tout ce qui définit les règles.
- Les fichiers JAR des mods ou plugins, aux versions exactes qui étaient en cours d'exécution. Un monde ne se chargera pas sans les mods qui ont créé ses blocs.
- Les données des joueurs, y compris `whitelist.json`, `ops.json` et les dossiers des statistiques et des succès.
- La version du pack, s'il provient d'un pack. L'écrire compte.

La vérification de bon sens la plus rapide pour toute sauvegarde : pourriez-vous reconstruire ce serveur sur une machine vierge à partir de l'archive seule ? Si la réponse nécessite une phrase commençant par "et ensuite je réinstallerais", ce n'est pas une sauvegarde complète.

## Une copie sur le même disque n'est pas une sauvegarde

Une sauvegarde qui se trouve sur la machine qu'elle protège ne couvre qu'une seule défaillance : vous avez supprimé quelque chose. Elle ne couvre pas la panne du disque, la suspension du compte par le fournisseur, ou une erreur qui supprime tout le répertoire.

Restez simple plutôt que parfait :

- Une copie locale, pour le cas courant, qui est quelqu'un qui cause des dégâts ou une mauvaise mise à jour.
- Une copie ailleurs. Une autre machine, un stockage objet, ou un NAS domestique qui tire les données chaque nuit via SSH.
- Assez d'historique pour survivre à un problème que vous n'avez pas remarqué immédiatement. La corruption est souvent découverte des jours plus tard, et si vous conservez trois jours de sauvegardes, vous avez déjà écrasé la bonne.

Sept copies quotidiennes plus quatre hebdomadaires couvrent presque tous les incidents réels et ne coûtent que très peu d'espace.

## Testez une restauration avant d'en avoir besoin

Choisissez une sauvegarde, restaurez-la sur un serveur de spare, et rejoignez. C'est tout le test, cela prend quinze minutes, et cela attrape tous les échecs classiques : l'archive qui manque le dossier des mods, un monde qui nécessite une version que vous n'exécutez plus, des permissions qui rendent les fichiers illisibles, un téléchargement tronqué.

Faites-le une fois lorsque vous configurez les sauvegardes, et une fois de plus après tout changement majeur sur le serveur.

## Taille, et comment la maintenir raisonnable

Les mondes grandissent parce que les joueurs explorent. Un monde où quelqu'un a volé sur dix mille blocs en ligne droite transporte tous les chunks le long de cette ligne pour toujours, et la plupart de ces chunks ne seront jamais revisités.

Trois leviers, par ordre de ce qu'ils rapportent le plus :

1. **Élaguez les chunks non visités.** Les outils qui élaguent par date de dernière modification suppriment généralement une grande partie d'un monde très parcouru sans effet visible en jeu.
2. **Compressez correctement.** Les fichiers de région se compressent bien ; les archives de ceux-ci ne bénéficient de rien d'exotique.
3. **Ne conservez pas chaque copie horaire pendant un an.** La rétention prime sur la compression.

## Dans Minecraft Server Manager

Les sauvegardes suivent le chemin `save-off`, flush, copie, `save-on`, et un arrêt ou redémarrage demandé en milieu de sauvegarde est refusé jusqu'à ce que la copie soit terminée plutôt que de la concurrencer. L'archive couvre tout le répertoire du serveur, donc les mods, la configuration et les données des joueurs voyagent avec le monde.

Les sauvegardes peuvent s'exécuter selon un calendrier en parallèle des redémarrages et des commandes, et chaque nouveau serveur démarre avec un calendrier de sauvegarde quotidien. Les décomptes de rétention comptent chaque type séparément, de sorte que les dix copies planifiées qui s'accumulent d'elles-mêmes ne peuvent pas évincer celle que vous avez prise à la main avant un changement risqué, et des limites d'âge et de taille s'appliquent en plus. Les administrateurs modifient tout cela sur la page des Paramètres, ou par serveur sur son onglet Sauvegardes. La restauration prend d'abord une nouvelle sauvegarde, donc une restauration au mauvais moment est elle-même annulable. Un monde peut être réduit seul ou dans le cadre d'une sauvegarde, ce qui est le levier le plus important pour la taille.

L'ensemble du panneau, y compris chaque sauvegarde, vit sous un seul répertoire. Copier ce répertoire ailleurs est la moitié de l'histoire hors machine, et c'est délibérément la seule chose que vous ayez à copier.

Connexe : [sauvegardes dans le panneau](/docs/backups/), [planifications](/docs/schedules/),
[réduction d'un monde](/docs/world-shrink/), [déplacement d'un serveur vers un autre hôte](/docs/guide-moving-a-server/).
