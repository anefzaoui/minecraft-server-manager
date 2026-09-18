---
title: 'Stockage'
description: "La page Stockage montre l'utilisation de votre disque : utilisation par serveur et son évolution dans le temps."
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/storage.md'
---

[← Retour à l'index des docs](/docs/)

La page **Stockage** indique où va votre disque : utilisation par serveur et son évolution dans le temps.

![Stockage](/docs/images/storage.png)

## Les quotas de disque sont appliqués par le panneau

Docker ne peut pas limiter l'utilisation du disque d'un bind mount, c'est donc le panneau qui s'en charge. Un indexeur de taille en arrière-plan parcourt le répertoire de données, met en cache l'empreinte de chaque serveur et applique le quota de disque que vous définissez par serveur. Lorsqu'un serveur approche de son quota (monde + sauvegardes + tout le reste), le panneau arrête la croissance incontrôlée plutôt que de laisser un serveur remplir votre hôte.

Définissez le quota d'un serveur dans ses [paramètres](/docs/servers/). Les serveurs moddés et leurs [sauvegardes](/docs/backups/) peuvent être volumineux, alors laissez-leur de la marge.

## Nettoyage

La vue Stockage vous aide à trouver quoi élaguer (anciennes sauvegardes, mondes inutilisés, ou un serveur qui a considérablement dépassé les attentes) avant de manquer d'espace.
