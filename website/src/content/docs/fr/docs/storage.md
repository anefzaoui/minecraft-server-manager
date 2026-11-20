---
title: 'Stockage'
description: "Voyez où va l'espace disque, limitez chaque dossier de serveur avec une quota disque, et nettoyez ce dont vous n'avez plus besoin."
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/storage.md'
---

[← Retour à l'index des docs](/docs/)

La page **Stockage** indique où va votre disque : utilisation par catégorie, chaque serveur par rapport à sa limite, les plus gros fichiers, et comment l'utilisation totale évolue lors des analyses récentes. Elle est réservée aux administrateurs.

![Stockage](/docs/images/storage.png)

## Les quotas disque sont appliqués par le panneau

Docker ne peut pas limiter l'utilisation du disque d'un bind mount, c'est donc le panneau qui s'en charge. Un indexeur de taille en arrière-plan parcourt le dossier de données (toutes les 15 minutes, après des modifications, ou lorsque vous appuyez sur **Analyser maintenant**), met en cache l'empreinte de chaque serveur et applique le quota disque que vous définissez par serveur. Une action qui ferait dépasser la limite du dossier d'un serveur (monde, mods, configs, logs, et tout ce qui s'y trouve), comme l'installation d'un mod ou d'un monde, ou le téléversement de fichiers, est bloquée jusqu'à ce que de l'espace soit libéré ou que le quota soit augmenté, plutôt que de laisser un serveur remplir votre hôte.

Définissez le quota d'un serveur dans ses [paramètres](/docs/servers/#server-settings). L'activation de **Arrêter le serveur en cas de dépassement de quota** à cet endroit arrête également un serveur en cours d'exécution une fois que son dossier dépasse de plus de 10 % le quota, et le note dans l'historique du serveur. Les serveurs moddés peuvent être volumineux, alors donnez-leur de l'espace. Les [sauvegardes](/docs/backups/) sont stockées séparément et ne comptent pas dans le quota.

## Nettoyage

La carte **Nettoyage en un clic** libère l'espace que le panneau peut récupérer en toute sécurité : fichiers temporaires plus anciens qu'une heure, fichiers de bibliothèque orphelins, et journaux archivés et rapports de crash plus anciens que 30 jours. Chacun indique combien il libère et ouvre un aperçu avant que quoi que ce soit ne soit supprimé. Les listes **Par catégorie** et **Plus gros fichiers** mènent directement au gestionnaire de fichiers, afin que vous puissiez trouver quoi d'autre élaguer avant de manquer d'espace.
