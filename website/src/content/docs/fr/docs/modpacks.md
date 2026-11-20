---
title: 'Modpacks'
description: 'Installez des modpacks CurseForge, Modrinth, FTB et GT New Horizons en tant que serveurs, toujours épinglés à une version exacte du pack.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/modpacks.md'
---

[← Retour à l'index des documents](/docs/)

La page **Modpacks** (et l'onglet **Depuis un Modpack** dans l'[assistant de création](/docs/servers/)) installe un modpack en tant que serveur, toujours **épinglé à une version exacte du pack** afin qu'un redémarrage ne puisse jamais mettre à jour le pack silencieusement à votre insu.

![Modpacks](/docs/images/modpacks.png)

## Plateformes prises en charge

- **CurseForge** : recherche par nom. Nécessite une clé API CurseForge (à ajouter sous **Paramètres → Clés API**).
- **Modrinth** : recherche par nom.
- **FTB** : packs Feed The Beast, via l'API uniquement (un ID de pack numérique plus un ID de version explicite). Le panneau ne vérifie pas encore les mises à jour des packs FTB.
- **GT New Horizons** : le pack expert 1.7.10, installé à partir de l'index de publication de GTNH. GTNH choisit son environnement d'exécution Java par version de pack (2.8.0+ fonctionne sur **Java 25** via des correctifs lwjgl3ify groupés, les versions plus anciennes sur Java 21 ou 17), et l'assistant augmente la RAM et le disque du serveur à des minimums raisonnables pour celui-ci.
- **Zip personnalisé** : pas un pack publié du tout. Téléchargez un **export de modpack CurseForge** (le zip avec `manifest.json` que l'application CurseForge produit pour un ensemble de mods choisis à la main), un **Modrinth `.mrpack`**, ou **tout zip de jars de mods**. Le panneau résout le manifeste en masse (ou identifie chaque jar par hachage/empreinte/métadonnées), prévisualise ce qui convient, et installe tout en une seule tâche, y compris les configurations `overrides/` du pack si vous le souhaitez. Les mods dont les auteurs interdisent les téléchargements automatisés sont listés avec un lien de navigateur et un emplacement de téléchargement manuel au lieu de faire échouer l'installation.

## Comment fonctionne l'épinglage

Lorsque vous choisissez un pack, le panneau résout la version exacte, l'enregistre et l'installe. Sur la page **Mises à jour**, vous serez informé lorsqu'une version plus récente est disponible (sauf si la [politique de mise à jour](#update-policy) du serveur est **Manuelle uniquement**) ; la mise à niveau est une action délibérée et protégée avec une sauvegarde et une restauration avant la mise à jour. Les serveurs de suivi stable ne se voient jamais proposer de version bêta. L'onglet **Versions** d'un serveur répond à l'autre moitié de la question : quelles futures versions de Minecraft les mods qu'il contient peuvent suivre ([mises à jour](/docs/updates/#minecraft-version-compatibility)).

La version du chargeur de mods est également fournie avec le pack : le serveur installe la version de Forge, NeoForge ou Fabric déclarée par le pack. Si un pack Forge ou Fabric CurseForge en déclare une trop ancienne pour ses propres mods, l'onglet **Versions** peut la remplacer jusqu'à ce que le pack soit corrigé ; une mise à jour du pack supprime la surcharge, car la nouvelle version déclare la sienne ([changer la version du chargeur de mods](/docs/updates/#changing-the-mod-loader-version)).

Les serveurs créés sur de très anciennes versions du panneau (avant la 0.9.7) pouvaient être laissés _non épinglés_, ce qui signifiait que l'image du conteneur installait silencieusement la version la plus récente du pack à chaque démarrage. Le panneau les répare désormais au démarrage : il verrouille chacun à la version réellement installée (lue à partir des propres enregistrements du panneau ou du manifeste d'installation de l'image, jamais une "dernière" fraîchement résolue) et enregistre un événement. S'il ne peut pas déterminer ce qui est installé, la page Paramètres du serveur affiche un avertissement avec un bouton **Choisir une version…** (packs CurseForge, Modrinth et GTNH) qui ouvre le [sélecteur de version](#changing-the-pack-version), et toute tentative d'enregistrer une configuration de modpack non épinglée est rejetée purement et simplement.

## Politique de mise à jour

Chaque serveur dispose d'une carte **Politique de mise à jour** sur son onglet **Paramètres → Configuration**, et les trois options signifient ce qu'elles disent :

- **Manuelle uniquement** (par défaut) : rien ne change jamais de lui-même, et le serveur est entièrement exclu du badge de mise à jour et de la page Mises à jour. Le mode "laissez-moi tranquille" : idéal pour un pack réglé à la main ou importé que vous ne voulez jamais toucher. Il ne verrouille pas la version : [**Changer de version…**](#changing-the-pack-version) fonctionne sous toutes les politiques. Pour être informé des nouvelles versions et les appliquer en un clic, choisissez **Me notifier**.
- **Me notifier** : la vérification quotidienne affiche les mises à jour disponibles sous forme de badge et sur la page Mises à jour ; leur application est toujours à votre clic.
- **Mise à jour automatique** : après la vérification quotidienne programmée, les mises à jour de **pack** en attente sont appliquées via le même chemin sécurisé qu'une mise à niveau manuelle : sauvegarde avant la mise à jour, surveillance de la santé et restauration automatique si la nouvelle version ne démarre pas. Les mises à jour qui déplaceraient le serveur vers une version différente de Minecraft sont toujours ignorées avec un événement : la conversion permanente d'un monde est une décision que le panneau refuse de prendre pour vous. Les boutons manuels **Vérifier maintenant** ne font que vérifier ; ils ne déclenchent jamais de mises à jour automatiques.

## Mettre à niveau un pack

À partir d'un serveur épinglé, vous pouvez passer à une version plus récente en une seule action. Le panneau effectue d'abord une sauvegarde, échange la version épinglée, reconstruit le serveur (re-résolvant Java si la nouvelle version nécessite un environnement d'exécution différent), et surveille le premier démarrage, avec une fenêtre généreuse pour les gros packs comme GTNH qui téléchargent quelques gigaoctets et construisent un monde de plusieurs centaines de mods au premier démarrage.

## Changer la version du pack

Pour exécuter une version spécifique, plus récente ou plus ancienne, utilisez **Changer de version…** sur la carte du pack de l'onglet **Aperçu** du serveur. Sur la page **Modpacks**, l'ouverture de la carte d'un pack installé offre le même choix : sélectionnez une version dans le menu déroulant et cliquez sur **Passer à cette version**. Les deux nécessitent la permission **Contenu** du serveur, et les deux sont disponibles pour les packs CurseForge, Modrinth et GTNH (les packs FTB n'ont pas encore de liste de versions). La liste affiche les 25 versions les plus récentes pour CurseForge et Modrinth, et toutes les versions de GTNH.

Le changement passe par le même chemin sécurisé qu'une mise à niveau : une sauvegarde avant la mise à jour, la nouvelle épingle, une reconstruction et un premier démarrage surveillé, avec une restauration en un clic si le serveur ne démarre pas correctement. Vos mods personnalisés sont conservés, ainsi que les mods du pack que vous avez désactivés, ainsi que les autres paramètres d'installation du pack (mods forcés, fichiers à ignorer, projets supplémentaires). L'installation d'un pack différent réinitialise ces paramètres, car ils n'ont de sens que pour le pack pour lequel ils ont été créés.

Chaque version est listée avec la version de Minecraft qu'elle exécute, comparée à la version avec laquelle votre monde a été sauvegardé pour la dernière fois :

- **Même version de Minecraft** : basculez après une confirmation normale. Revenir à une version plus ancienne du pack peut supprimer des blocs et des objets des mods que cette version n'a pas, donc la sauvegarde reste dans l'onglet Sauvegardes de toute façon.
- **Version plus récente de Minecraft** : autorisé après une confirmation qui avertit que le monde est converti pour de bon. La sauvegarde effectuée en premier est le seul moyen de revenir à l'ancien monde.
- **Version plus ancienne de Minecraft** : indisponible. Minecraft ne peut pas charger un monde sur une version plus ancienne que celle qui l'a sauvegardé pour la dernière fois, donc le panneau refuse plutôt que de laisser un serveur qui plante au démarrage.
