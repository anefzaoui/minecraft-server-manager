---
title: 'Blueprints'
description: "Un blueprint capture toute la configuration d'un serveur (type, version, ressources, environnement, épinglage du pack, et optionnellement sa configuration et son monde) en un seul fichier."
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/blueprints.md'
---

[← Retour à l'index des docs](/docs/)

Un **blueprint** capture toute la configuration d'un serveur (type, version, ressources, environnement, épingle de pack, et optionnellement sa configuration et son monde) dans un seul fichier portable à partir duquel vous pouvez créer de nouveaux serveurs.

![Blueprints](/docs/images/blueprints.png)

## Exportation

Depuis un serveur, exportez un blueprint et choisissez ce qu'il faut inclure : la configuration toujours, et optionnellement les fichiers embarqués et le monde. Le résultat est sauvegardé dans votre bibliothèque de blueprints et peut être téléchargé pour être partagé.

## Importation et création à partir d'un blueprint

Importez un fichier blueprint (ou choisissez-en un dans la bibliothèque) pour créer un nouveau serveur pré-configuré exactement comme l'original. C'est le moyen le plus rapide pour :

- Lancer des serveurs identiques (un réseau de serveurs de minijeux, des copies de staging de production).
- Déplacer un serveur entre différents panneaux.
- Conserver un modèle connu et fiable auquel vous pouvez toujours revenir.

Parce qu'un blueprint enregistre l'[épingle de pack](/docs/modpacks/) exacte, un serveur de modpack recréé à partir d'un blueprint installe la même version épinglée, sans mises à jour surprises.
