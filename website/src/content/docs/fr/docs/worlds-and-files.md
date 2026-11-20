---
title: 'Mondes et fichiers'
description: "La bibliothèque de mondes, les téléchargements et échanges de mondes, l'onglet mods et plugins, et le gestionnaire de fichiers dans le navigateur."
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/worlds-and-files.md'
---

[← Retour à l'index de la documentation](/docs/)

## Mondes

La page **Mondes** est la bibliothèque de mondes : tous les mondes sauvegardés en un seul endroit. **Importer un monde** prend une archive `.zip` ou `.tar` et trouve automatiquement le monde à l'intérieur, **Sauvegarder dans la bibliothèque** crée un instantané du monde d'un serveur en cours d'exécution (cela fonctionne pendant que le serveur tourne), et chaque monde de la bibliothèque peut être téléchargé ou installé sur n'importe quel serveur avec **Installer sur…**. L'installation remplace le monde du serveur (le serveur doit être arrêté et son monde actuel est sauvegardé au préalable) ou l'ajoute en parallèle, pour une activation ultérieure. Une vérification de compatibilité s'exécute avant chaque installation.

L'onglet **Monde → Mondes** d'un serveur liste les mondes présents sur ce serveur. À partir de là, vous pouvez activer un autre monde (serveur arrêté), télécharger, dupliquer, renommer ou [réduire](/docs/world-shrink/) un monde, le copier sur un autre serveur, supprimer un monde inactif et réinitialiser le monde actif avec une graine (seed) nouvelle, conservée ou personnalisée (une sauvegarde de sécurité est proposée au préalable). La même bibliothèque se trouve ci-dessous, avec **Installer ici**.

![Mondes](/docs/images/worlds.png)

## Le gestionnaire de fichiers

Sous la section **Monde** d'un serveur, l'onglet **Fichiers** est un gestionnaire de fichiers complet dans le navigateur pour le répertoire de données de ce serveur. Listez, lisez, modifiez, renommez, déplacez, copiez, supprimez et téléchargez des fichiers, créez des dossiers et recherchez le texte des fichiers sous un dossier avec **Rechercher dans les fichiers** : tout ce que vous feriez normalement via SSH, depuis le navigateur.

![Gestionnaire de fichiers](/docs/images/server-files.png)

Les fichiers texte s'ouvrent dans un éditeur avec une limite de 8 Mo ; les fichiers plus volumineux peuvent être téléchargés. Les téléversements acceptent jusqu'à 20 fichiers à la fois.

### Rester dans le bac à sable

Chaque opération sur les fichiers est confinée au répertoire de données propre au serveur. Le panneau résout chaque chemin et refuse tout ce qui tenterait de s'en échapper : traversée de `..`, chemins absolus, et même les liens symboliques qui pointent en dehors du répertoire (y compris ceux qui sont pendants et n'existent pas encore). Un mod ou un plugin ne peut pas planter un lien pour tromper le gestionnaire de fichiers afin qu'il lise ou écrive ailleurs sur l'hôte.

## Mods

Pour les serveurs moddés et à plugins, l'onglet **Mods** (son propre groupe dans la barre latérale du serveur) gère l'ensemble des mods : parcourez et ajoutez des mods, et voyez ce qui est installé. Depuis la ligne de chaque mod installé, vous pouvez le mettre à jour (ou ignorer cette mise à jour), le [rétablir](/docs/updates/#undoing-a-mod-update), le désactiver ou le supprimer, et **Tout mettre à jour** applique toutes les mises à jour disponibles avec un seul redémarrage. Les mises à jour de mods et de packs apparaissent également sur la page [Mises à jour](/docs/updates/).

### Ajout de mods

![Mods](/docs/images/mods.png)

Quatre chemins d'accès, tous depuis la barre d'outils de l'onglet Mods :

- **Rechercher des mods** : recherchez sur **Modrinth ou CurseForge** (la puce CurseForge apparaît une fois qu'une clé API est stockée sous **Paramètres → Clés API**), et sur les serveurs à plugins également **Hangar** (le registre de plugins de PaperMC) et **SpigotMC** (via le proxy CDN de Spiget), tous deux sans clé. Un onglet **Datapacks** recherche les datapacks de Modrinth. Tout est filtré selon le chargeur (loader) et la version de Minecraft du serveur (une case à cocher affiche également les versions non listées comme compatibles, à vos risques et périls) ; les serveurs Quilt voient automatiquement les versions taguées fabric, car Quilt exécute les mods Fabric. Les résultats déjà présents sur le serveur affichent un badge **Installé**. Si un auteur CurseForge interdit les téléchargements automatisés (ou qu'une ressource SpigotMC est hébergée hors site), le panneau le signale clairement et propose un chemin **Ouvrir CurseForge** (ou **Ouvrir SpigotMC**) + **Importer Jar** au lieu d'échouer en cours d'installation.

  ![Recherche Hangar](/docs/images/mods-search-hangar.png)

- **Importer Zip** : un bouton, trois formes, détection automatique :
  - Un **modpack Modrinth (`.mrpack`)** : chaque fichier épinglé est canonisé pour retourner à son projet Modrinth via une recherche de hachage (ainsi les mods importés conservent leurs vrais noms, icônes, et restent vérifiables pour les mises à jour ; les fichiers que Modrinth ne connaît pas s'installent depuis l'URL propre au pack), vérifié par rapport aux sommes de contrôle sha512 du pack lors du téléchargement, et prévisualisé avec des verdicts d'ajustement. Les fichiers client uniquement sont ignorés visiblement, et les deux arbres de substitution (`overrides/`, puis `server-overrides/`; la copie spécifique au serveur l'emporte) peuvent être appliqués.

    ![Importation mrpack](/docs/images/mrpack-import.png)

  - Une **exportation de modpack CurseForge** (le zip que l'application CurseForge produit, avec `manifest.json`) : chaque mod épinglé est résolu en masse, prévisualisé avec des avertissements (chargeur/MC incorrect pour ce serveur, fichiers plus disponibles sur CurseForge, mods nécessitant un téléchargement manuel), et installé avec une progression réelle. Les `overrides/` du pack (configs, scripts) peuvent également être appliqués en option ; tout fichier qui serait écrasé est sauvegardé au préalable dans `.import-backups/<timestamp>/` à l'intérieur du dossier du serveur.
  - Un **zip de jars brut** que vous avez collecté vous-même : chaque jar est identifié (correspondance de hachage Modrinth → empreinte CurseForge → métadonnées propres au jar) et jugé par rapport au serveur (_convient / chargeur incorrect / version MC incorrecte / déjà installé / non identifié_), afin que vous choisissiez ce qui appartient réellement avant toute installation.
- **Ajouter par URL** : collez presque n'importe quoi : pages de projet Modrinth, CurseForge, Hangar, ou SpigotMC, une URL de dépôt ou de sortie GitHub (un simple `propriétaire/dépôt` fonctionne aussi ; les installations GitHub privilégient la dernière version stable et ignorent les fichiers annexes `-sources`/`-javadoc`), un slug Modrinth brut, ou toute URL directe de `.jar`. Le panneau résout la bonne version pour le chargeur et la version MC du serveur.

  ![Ajouter par lien](/docs/images/mods-add-by-link.png)

- **Importer Jar** (depuis le fallback de recherche ou le résolveur de téléchargements en attente) : les jars importés sont identifiés de la même manière, ainsi ils conservent leur vrai nom, version, icône, et deviennent vérifiables pour les mises à jour.

Chaque installation depuis un registre est **vérifiée par somme de contrôle pendant le téléchargement** : le flux est comparé au digest le plus fort publié par le registre (sha512 → sha256 → sha1 → md5) et une non-concordance interrompt le processus avant que quoi que ce soit n'atterrisse sur le serveur.

Un zip complet (`.mrpack` inclus) peut également **créer un serveur** : dans l'onglet **À partir d'un Modpack** de l'assistant, téléchargez-le et le manifeste du pack (ou un vote majoritaire parmi les jars identifiés) remplira le chargeur, la version Minecraft et la version du chargeur.
