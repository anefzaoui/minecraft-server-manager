---
title: 'Modpacks'
description: "La page Modpacks (et l'onglet À partir d'un modpack dans l'assistant de création) installe un modpack en tant que serveur, toujours épinglé à une version exacte du pack afin qu'un redémarrage puisse"
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/modpacks.md'
---

[← Retour à l'index de la documentation](/docs/)

La page **Modpacks** (et l'onglet **À partir d'un modpack** dans l'assistant de [création](/docs/servers/)) installe un modpack comme serveur, toujours **épinglé à une version exacte du pack** afin qu'un redémarrage ne puisse jamais mettre à jour le pack silencieusement sans que vous le sachiez.

![Modpacks](/docs/images/modpacks.png)

## Plateformes supportées

- **CurseForge** - recherchez ou collez une URL de pack. Nécessite une clé API CurseForge pour la recherche et les packs privés (ajoutez-la dans Paramètres → Clés API).
- **Modrinth** - recherchez par nom.
- **FTB** - Packs Feed The Beast.
- **GT New Horizons** - le pack expert 1.7.10, installé à partir de l'index de publication de GTNH. GTNH choisit son runtime Java par version de pack (2.8.0+ s'exécute sur **Java 25** via des patchs lwjgl3ify groupés, les versions antérieures sur Java 21 ou 17), et l'assistant augmente la RAM et le disque du serveur à des minimums raisonnables pour cela.
- **Zip personnalisé** - pas un pack publié du tout : téléchargez un **export de modpack CurseForge** (le zip avec `manifest.json` que l'application CurseForge produit pour un ensemble de mods choisi à la main) ou **n'importe quel zip de mods jar**. Le panneau résout le manifeste en masse via l'API CurseForge (ou identifie chaque jar par hash/empreinte/métadonnées), prévisualise ce qui convient, et installe tout en une seule tâche - y compris les configurations `overrides/` du pack si vous l'autorisez. Les mods dont les auteurs n'autorisent pas les téléchargements automatisés sont listés avec un lien vers le navigateur et un emplacement de téléchargement manuel au lieu d'échouer l'installation.

## Comment fonctionne l'épinglage

Lorsque vous choisissez un pack, le panneau résout la version exacte, l'enregistre et l'installe. Sur la page **Mises à jour**, vous serez informé lorsqu'une nouvelle version sera disponible ; la mise à niveau est une action délibérée et protégée avec une sauvegarde avant mise à jour et un retour arrière. Les serveurs à suivi stable ne se voient jamais proposer une bêta.

Les serveurs créés sur de très anciennes versions du panneau (avant 0.9.7) pouvaient être laissés _non épinglés_, ce qui signifie que l'image conteneur installait silencieusement la dernière version du pack à chaque démarrage. Le panneau répare maintenant ceux-ci au démarrage : il verrouille chacun à la version qui est réellement installée (lue à partir des propres enregistrements du panneau ou du manifeste d'installation de l'image, jamais un "dernier" fraîchement résolu) et enregistre un événement. S'il ne peut pas déterminer ce qui est installé, la page Paramètres du serveur affiche un avertissement vous demandant de choisir manuellement la version, et toute tentative de sauvegarde d'une configuration de modpack non épinglée est rejetée catégoriquement.

## Politique de mise à jour

Chaque serveur a une politique de mise à jour dans **Paramètres**, et les trois options signifient ce qu'elles disent :

- **Manuel uniquement** - rien ne change de lui-même, et le serveur est entièrement exclu du badge de mise à jour et de la page Mises à jour. Le mode "laissez-moi tranquille" : idéal pour un pack ajusté manuellement ou importé que vous ne voulez jamais toucher.
- **Notifier** (par défaut) - la vérification quotidienne affiche les mises à jour disponibles sous forme de badge et sur la page Mises à jour ; leur application dépend toujours de votre clic.
- **Mise à jour automatique** - après la vérification quotidienne planifiée, les mises à jour **de pack** en attente sont appliquées via le même chemin protégé qu'une mise à niveau manuelle : sauvegarde avant mise à jour, surveillance de la santé et retour arrière automatique si la nouvelle version échoue au démarrage. Les mises à jour qui déplaceraient le serveur vers une version différente de Minecraft sont toujours ignorées avec un événement à la place - convertir un monde de manière permanente est une décision que le panneau refuse de prendre pour vous. Les boutons manuels "vérifier maintenant" ne font que vérifier ; ils ne déclenchent jamais de mises à jour automatiques.

## Mise à niveau d'un pack

À partir d'un serveur épinglé, vous pouvez mettre à niveau vers une version plus récente en une seule action. Le panneau effectue d'abord une sauvegarde, remplace la version épinglée, recrée le conteneur (résolvant à nouveau Java si la nouvelle version nécessite un runtime différent), et surveille le premier démarrage, avec une fenêtre généreuse pour les gros packs comme GTNH qui téléchargent quelques gigaoctets et construisent un monde avec plusieurs centaines de mods au premier démarrage.
