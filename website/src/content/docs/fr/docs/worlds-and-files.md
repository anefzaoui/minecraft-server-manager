---
title: 'Mondes et fichiers'
description: 'La page Mondes gère les données des mondes de vos serveurs : changez le monde actif, téléchargez un monde ou téléchargez-en un.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/worlds-and-files.md'
---

[← Retour à l'index des docs](/docs/)

## Mondes

La page **Mondes** gère les données des mondes sur vos serveurs : changez le monde actif, téléchargez un monde ou téléchargez-en un.

![Mondes](/docs/images/worlds.png)

## Le gestionnaire de fichiers

Sous la section **Monde** d'un serveur, l'onglet **Fichiers** est un gestionnaire de fichiers complet dans le navigateur pour le répertoire de données de ce serveur. Listez, lisez, modifiez, créez, renommez, déplacez, copiez, supprimez et téléchargez des fichiers : tout ce que vous feriez normalement via SSH, depuis le navigateur.

![Gestionnaire de fichiers](/docs/images/server-files.png)

Les fichiers texte s'ouvrent dans un éditeur avec une limite de 2 Mo ; les fichiers plus volumineux peuvent être téléchargés. Les téléchargements acceptent plusieurs fichiers à la fois.

### Rester dans le bac à sable

Chaque opération sur les fichiers est confinée au répertoire de données propre au serveur. Le panneau résout chaque chemin et refuse tout ce qui tenterait de s'en échapper : traversée de `..`, chemins absolus, et même les liens symboliques qui pointent en dehors du répertoire (y compris ceux qui sont pendants et qui n'existent pas encore). Un mod ou un plugin ne peut pas planter un lien pour tromper le gestionnaire de fichiers afin qu'il lise ou écrive ailleurs sur l'hôte.

## Mods

Pour les serveurs moddés, l'onglet **Mods** (son propre groupe dans la barre latérale du serveur) gère l'ensemble des mods : parcourez et ajoutez des mods, et voyez ce qui est installé. Les mises à jour de mods et de packs apparaissent sur la page [Mises à jour](/docs/updates/).

### Ajout de mods

![Mods](/docs/images/mods.png)

Quatre façons d'ajouter, toutes depuis la barre d'outils de l'onglet Mods :

- **Rechercher des mods** - recherchez sur **Modrinth ou CurseForge** (la puce CurseForge apparaît une fois qu'une clé API est stockée dans Paramètres → Clés API), et sur les serveurs de plugins également **Hangar** (le propre registre de plugins de PaperMC) et **SpigotMC** (via le proxy CDN de Spiget) - tous deux sans clé. Tout est filtré selon le chargeur et la version de Minecraft du serveur ; les serveurs Quilt voient automatiquement les builds tagués Fabric, car Quilt exécute les mods Fabric. Les résultats déjà présents sur le serveur affichent un badge **Installé**. Si un auteur CurseForge interdit les téléchargements automatisés - ou si une ressource SpigotMC est hébergée hors site - le panneau l'indique clairement et propose un chemin **Ouvrir la page** + **Télécharger le jar** au lieu d'échouer en cours d'installation.

  ![Recherche Hangar](/docs/images/mods-search-hangar.png)

- **Importer zip** - un bouton, trois formes, détection automatique :
  - Un **Modpack Modrinth (`.mrpack`)** : chaque fichier épinglé est canonisé vers son projet Modrinth via une recherche de hachage (ainsi les mods importés conservent leurs vrais noms, icônes, et restent vérifiables pour les mises à jour ; les fichiers que Modrinth ne connaît pas s'installent depuis l'URL propre au pack), vérifié contre les sommes de contrôle sha512 du pack lors du téléchargement, et prévisualisé avec des verdicts d'ajustement. Les fichiers client uniquement sont ignorés visiblement, et les deux arbres de remplacement (`overrides/`, puis `server-overrides/` - la copie spécifique au serveur l'emporte) peuvent être appliqués.

    ![Importation mrpack](/docs/images/mrpack-import.png)

  - Une **exportation de modpack CurseForge** (le zip que l'application CurseForge produit, avec `manifest.json`) : chaque mod épinglé est résolu en masse, prévisualisé avec des avertissements (chargeur/MC incorrect pour ce serveur, fichiers plus disponibles sur CurseForge, mods nécessitant un téléchargement manuel), et installé avec une progression réelle. Les `overrides/` du pack (configs, scripts) peuvent également être appliqués en option - tout fichier qui serait écrasé est d'abord sauvegardé dans `.import-backups/<timestamp>/` à l'intérieur du dossier du serveur.
  - Un **zip simple de jars** que vous avez collectés vous-même : chaque jar est identifié (correspondance de hachage Modrinth → empreinte CurseForge → métadonnées propres au jar) et jugé par rapport au serveur - _convient / chargeur incorrect / version MC incorrecte / déjà installé / non identifié_ - afin que vous choisissiez ce qui appartient réellement avant toute installation.
- **Ajouter par lien** - collez presque n'importe quoi : pages de projet Modrinth, CurseForge, Hangar, ou SpigotMC, une URL de dépôt ou de release GitHub (un simple `propriétaire/repo` fonctionne aussi - les installations GitHub préfèrent la dernière release stable et ignorent les fichiers annexes `-sources`/`-javadoc`), un slug Modrinth nu, ou toute URL directe de `.jar`. Le panneau résout le bon build pour le chargeur et la version MC du serveur.

  ![Ajouter par lien](/docs/images/mods-add-by-link.png)

- **Télécharger jar** (depuis le fallback de recherche ou le résolveur de téléchargements en attente) - les jars téléchargés sont identifiés de la même manière, ainsi ils conservent leur vrai nom, version, icône, et deviennent vérifiables pour les mises à jour.

Chaque installation depuis un registre est **vérifiée par somme de contrôle pendant le téléchargement** : le flux est comparé au digest le plus fort que le registre publie (sha512 → sha256 → sha1 → md5) et une non-concordance interrompt le processus avant que quoi que ce soit n'atterrisse sur le serveur.

Un zip complet (`.mrpack` inclus) peut également **créer un serveur** : dans l'onglet _Depuis le modpack_ de l'assistant, téléchargez-le et le manifeste du pack (ou un vote majoritaire parmi les jars identifiés) remplira le chargeur, la version de Minecraft et le build du chargeur.
