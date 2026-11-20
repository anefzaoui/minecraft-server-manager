---
title: 'Blueprints'
description: "Les Blueprints sauvegardent la configuration complète d'un serveur Minecraft comme une recette réutilisable pour créer de nouveaux serveurs. Les secrets ne sont jamais inclus."
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/blueprints.md'
---

[← Retour à l'index des docs](/docs/)

Un **blueprint** capture toute la configuration d'un serveur (type, version, ressources, environnement, épingle de modpack, mods personnalisés, et optionnellement sa configuration et son monde) dans un unique fichier portable `.mcserver.zip` à partir duquel vous pouvez créer de nouveaux serveurs. Les secrets (mots de passe, tokens et clés dans l'environnement) ne sont jamais écrits dans un blueprint.

![Blueprints](/docs/images/blueprints.png)

## Exportation

Depuis l'onglet **Paramètres → Configuration** d'un serveur, utilisez **Exporter comme Blueprint** et choisissez ce qu'il faut inclure : la configuration du serveur toujours, ses répertoires de configuration (activés par défaut), et optionnellement les fichiers de mods personnalisés eux-mêmes (un fichier plus gros qui s'installe sans rien télécharger) et le monde actif. Le résultat est sauvegardé dans votre bibliothèque de blueprints et peut être téléchargé pour être partagé.

**Cloner le serveur**, sur la même carte, effectue une exportation et une importation en une seule étape pour créer une copie du serveur, avec ou sans son monde.

## Importation et création à partir d'un blueprint

Importez un fichier blueprint (**Importer un Blueprint** sur la page **Blueprints**) ou choisissez-en un dans la bibliothèque (**Créer un serveur** sur sa carte, ou l'onglet **À partir d'un Blueprint** de l'assistant) pour créer un nouveau serveur pré-configuré exactement comme l'original. Le nouveau serveur obtient ses propres ports et un nouveau mot de passe RCON. Les mods personnalisés qui n'étaient pas intégrés sont à nouveau téléchargés et vérifiés par rapport aux sommes de contrôle enregistrées par le blueprint. La bibliothèque commence également avec deux blueprints de démarrage, un pour Paper et un pour Fabric.

C'est le moyen le plus rapide de :

- Lancer des serveurs identiques (un réseau de serveurs de minijeux, des copies de staging de production).
- Déplacer un serveur entre des panneaux.
- Conserver un modèle connu et fiable sur lequel vous pouvez toujours revenir.

Parce qu'un blueprint enregistre l'[épingle de modpack](/docs/modpacks/) exacte, un serveur de modpack créé à partir d'un blueprint installe la même version épinglée, sans mises à jour surprises.
