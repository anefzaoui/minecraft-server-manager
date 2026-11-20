---
title: 'Invitations et page de statut'
description: "Invitez des amis sur un serveur avec l'adresse, la version et un modpack client, et partagez une page de statut publique qui affiche uniquement ce que vous choisissez."
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/invites-and-status-page.md'
---

[← Retour à l'index de la documentation](/docs/)

Deux onglets sous le groupe **Paramètres** d'un serveur aident les joueurs à le trouver et à le rejoindre : **Inviter** enregistre tout ce dont un ami a besoin pour se connecter, et **Page de statut** publie une petite page publique qui indique si le serveur est en ligne. Les deux nécessitent la permission **Paramètres** du serveur ([utilisateurs et rôles](/docs/users-and-roles/#per-server-permissions)).

## Inviter

**Paramètres → Inviter** contient une carte **Inviter des amis** :

- **Adresse à partager** liste les adresses de la machine sur votre réseau local avec le port de jeu du serveur, votre adresse publique lorsque le panneau a pu la détecter (les joueurs extérieurs à votre réseau ne peuvent y accéder qu'en passant par la redirection de port), et **Adresse personnalisée…** pour un domaine ou une adresse que vous avez configurée vous-même, comme `play.example.com:25565`.
- **Texte d'invitation** est un message prêt à être copié-collé avec le nom du serveur, l'adresse que vous avez choisie, ainsi que sa version et son type Minecraft. **Copier le texte d'invitation** le place dans le presse-papiers. Lorsque la liste blanche est activée, le texte demande aux amis leur nom d'utilisateur Minecraft, et la carte vous rappelle d'ajouter chaque ami dans l'onglet **Joueurs** avant qu'il ne rejoigne.
- **Ce dont les amis ont besoin** indique ce qui se passe du côté du joueur : rien d'autre que la bonne version de Minecraft pour un serveur vanilla ou avec plugins (Paper et similaires), ou les mods du serveur pour un serveur moddé.

### Le modpack client

Sur un serveur moddé, la carte propose également **Télécharger le modpack client (.mrpack)**. Les amis l'importent dans Prism Launcher ou l'application Modrinth, qui installe la version de Minecraft et le chargeur de mods du serveur, télécharge les mods, et ajoute le serveur à leur liste multijoueur avec l'adresse que vous avez choisie.

Le fichier est construit à partir des mods que vous avez ajoutés vous-même au serveur (l'overlay de mods personnalisés) et qui proviennent de Modrinth. Les mods provenant d'ailleurs sont listés sur la carte à la place, afin que les amis puissent ajouter ces fichiers manuellement dans leur dossier `mods`. Sur un serveur créé à partir d'un modpack, les amis devraient installer ce pack, à la version sur laquelle le serveur tourne, dans leur lanceur ; l'onglet **Vue d'ensemble** affiche la version.

### Jouer sur Internet

**Jouer sur Internet (redirection de port)** en bas de la carte explique la partie routeur : redirigez le port de jeu du serveur (TCP et UDP) vers la machine qui exécute le panneau, puis partagez votre adresse publique avec le port. Si votre fournisseur d'accès Internet utilise CGNAT, la redirection de port ne peut pas fonctionner, et un service de tunnel (par exemple playit.gg) est la solution. Le panneau n'ouvre pas les ports du routeur par lui-même. Seuls les ports de jeu doivent être exposés sur Internet ; gardez le port du panneau et les ports RCON fermés ([ports en un coup d'œil](https://github.com/anefzaoui/minecraft-server-manager#ports-at-a-glance)).

## Page de statut

**Paramètres → Page de statut** active une page publique pour un serveur, désactivée par défaut :

1. Activez la carte.
2. Choisissez l'**Adresse de la page** : la page se trouvera à `/status/<adresse>` sur votre panneau, et l'adresse est composée de 3 à 40 lettres minuscules, chiffres ou tirets, unique parmi vos serveurs.
3. Appuyez sur **Enregistrer**. **Ouvrir la page** et **Copier le lien** vous donnent ensuite le lien à partager.

Quiconque possède le lien voit le nom du serveur, son MOTD, sa version, s'il est en cours d'exécution, le nombre de joueurs et son temps de disponibilité, et rien d'autre. La page n'a aucun lien vers le panneau et ne nécessite aucune connexion. Elle lit l'état en mémoire du panneau, de sorte que les visiteurs ne provoquent jamais de travail sur le démon Docker.

Désactiver la page conserve son adresse, donc la réactiver restaure le même lien. Pour une page ou un bot personnel, l'API publique ([public API](/docs/public-api/)) renvoie le même type de statut au format JSON.

Connexe : [Notifications Discord](/docs/integrations/), [la carte en direct](/docs/live-map/), [création et gestion de serveurs](/docs/servers/).
