---
title: 'Carte en direct'
description: "Activez une carte 3D en direct BlueMap du monde d'un serveur en un clic, servie uniquement via la connexion du panneau."
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/live-map.md'
---

[← Retour à l'index des docs](/docs/)

L'onglet **Monde → Carte** d'un serveur affiche une carte 3D en direct et zoomable de son monde, dessinée par [BlueMap](https://bluemap.bluecolored.de/) (gratuit et open source), avec les positions des joueurs et toutes les dimensions. Le panneau l'installe, le configure et le sert ; vous n'avez jamais à ouvrir un port ou à modifier un fichier de configuration pour cela.

## Activation

1. Ouvrez le serveur, puis **Monde → Carte**.
2. Appuyez sur **Activer la carte en direct**. Le panneau installe la version de BlueMap qui correspond au chargeur et à la version de Minecraft du serveur depuis Modrinth, accepte le téléchargement des ressources de BlueMap pour vous, et lui attribue un port libre.
3. Redémarrez le serveur (le changement s'applique au prochain démarrage, et le serveur est marqué comme attendant un redémarrage).

BlueMap effectue le rendu en arrière-plan, donc une nouvelle carte prend quelques minutes pour dessiner ses premières tuiles. Jusqu'alors, l'onglet indique que la carte n'est pas encore prête et vérifie à nouveau par elle-même. Une fois qu'elle est prête, **Plein écran** ouvre la carte dans son propre onglet de navigateur.

Cela fonctionne sur les serveurs avec un chargeur de mods (Fabric, Quilt, Forge, NeoForge) et sur les serveurs de plugins (Paper, Purpur et le reste de la famille Paper, Spigot), y compris les serveurs de modpacks. Les serveurs Vanilla n'ont pas de build BlueMap, et l'onglet le signale.

## Qui peut la voir

La carte est servie uniquement via le panneau, derrière sa connexion : toute personne pouvant voir le serveur dans le panneau peut ouvrir sa carte, et personne d'autre. Le port de BlueMap lui-même n'est jamais destiné à être ouvert sur Internet ([ports en un coup d'œil](https://github.com/anefzaoui/minecraft-server-manager#ports-at-a-glance)). L'activation ou la désactivation de la carte nécessite l'autorisation **Paramètres** du serveur ([utilisateurs et rôles](/docs/users-and-roles/#per-server-permissions)).

Lorsque le panneau lui-même s'exécute dans Docker, il atteint BlueMap à l'intérieur du conteneur du serveur ; le [README](https://github.com/anefzaoui/minecraft-server-manager#installation) explique les détails pour les configurations de proxy inverse.

## Désactivation

**Désactiver la carte** supprime le jar BlueMap que le panneau a installé et libère son port, à nouveau à partir du prochain redémarrage. Le monde lui-même n'est pas touché ; les tuiles de carte rendues restent dans le dossier du serveur jusqu'à ce que vous les supprimiez dans l'onglet **Fichiers**.

Associé : [mondes et fichiers](/docs/worlds-and-files/), [invitations et page de statut](/docs/invites-and-status-page/).
