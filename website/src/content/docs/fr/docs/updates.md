---
title: 'Mises à jour'
description: "La page Mises à jour suit ce qui est obsolète sur l'ensemble de votre flotte en un seul endroit :"
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/updates.md'
---

[← Retour à l'index des docs](/docs/)

La page **Mises à jour** suit ce qui est obsolète sur l'ensemble de votre parc en un seul endroit :

- Versions de **Modpack** ([modpacks](/docs/modpacks/)) par rapport à Modrinth / CurseForge / l'index de publication GTNH.
- **Contenu personnalisé** que vous avez ajouté vous-même - mods, datapacks, resource packs, plugins - chacun par rapport à sa source : Modrinth, CurseForge, Hangar, SpigotMC (Spiget), ou GitHub Releases. Les recherches GitHub utilisent la revalidation ETag, donc les vérifications quotidiennes touchent à peine sa limite de débit.
- Obsolescence de l'**image Docker** : l'ID de l'image de chaque conteneur en cours d'exécution par rapport à un tag fraîchement extrait (dédupliqué sur les serveurs utilisant le même tag), proposé comme une mise à niveau ne nécessitant qu'une recréation.
- **Épingles de version autonomes** : pour un serveur sans pack géré, une épingle `mc_version` explicite par rapport au manifeste de Mojang, et une variable d'environnement explicite pour le build du chargeur (`PAPER_BUILD`, `FORGE_VERSION`, et similaires) par rapport au registre du chargeur. Les builds Paper proviennent de l'actuelle **Fill v3 API** de PaperMC (l'ancien point de terminaison v2 a cessé de recevoir les nouvelles versions de Minecraft).

![Mises à jour](/docs/images/updates.png)

## Comment ça marche

Le panneau vérifie les versions épinglées de chaque serveur par rapport à la source en amont et liste tout ce qui a une nouvelle version. Un compte correspondant apparaît également sur la vignette "Mises à jour disponibles" du [tableau de bord](/docs/dashboard/).

Les vérifications s'exécutent à la demande et peuvent être planifiées ([Planifications](/docs/schedules/)). La **politique** de mise à jour est par serveur : vous décidez si le panneau vous informe simplement, ou si tout reste manuel.

## Application d'une mise à jour

Les mises à jour ne sont jamais silencieuses. Lorsque vous choisissez de mettre à niveau un pack, le panneau :

1. Effectue une **sauvegarde avant mise à jour** (elle est donc réversible ; les 10 dernières sauvegardes avant mise à jour par serveur sont conservées).
2. Épingle la nouvelle version exacte.
3. Recrée le conteneur, en résolvant à nouveau le runtime Java si nécessaire.
4. Surveille le premier démarrage, avec un budget de temps par plateforme.

S'il ne démarre pas sainement, vous revenez à la sauvegarde avant mise à jour. Un serveur en suivi stable ne se voit jamais proposer une bêta, et le lien du journal des modifications pointe vers la vraie différence par version là où la source en fournit une. Une mise à jour échouée déclenche également une [alerte](/docs/integrations/) Discord si l'intégration est configurée.
