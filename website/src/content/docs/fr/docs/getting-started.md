---
title: 'Premiers pas'
description: 'La première fois que vous ouvrez le panneau, il vous demande de créer un compte administrateur.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/getting-started.md'
---

[← Retour à l'index de la documentation](/docs/)

## Configuration initiale

La première fois que vous ouvrez le panneau, il vous demande de créer un compte administrateur. C'est le seul compte qui existe jusqu'à ce que vous en ajoutiez d'autres, et il a un contrôle total.

Choisissez un nom d'utilisateur et un mot de passe d'au moins 8 caractères. C'est tout : vous êtes connecté et dirigé directement vers le tableau de bord.

> **Les installations exposées sont protégées par un code PIN.** Si vous démarrez le panneau lié à une adresse non-boucle (`PANEL_HOST` autre que `127.0.0.1`), la page de configuration demande également un **code PIN à 6 chiffres**. Le panneau l'affiche dans sa console au démarrage. Entrez-le avec votre nom d'utilisateur et votre mot de passe. Cela empêche un étranger qui atteint le port en premier de revendiquer le compte administrateur. Le code PIN disparaît une fois que le compte administrateur existe.

## Connexion

Après la configuration, le panneau est protégé par un écran de connexion. Entrez votre nom d'utilisateur et votre mot de passe pour continuer.

![Connexion](/docs/images/login.png)

Si [l'authentification à deux facteurs](/docs/two-factor-authentication/) est activée sur votre compte, un code à 6 chiffres de votre application d'authentification vous sera demandé juste après votre mot de passe.

## Se repérer

Tout se trouve dans la barre latérale gauche :

- **Tableau de bord** - tous les serveurs en un coup d'œil ([détails](/docs/dashboard/)).
- **Serveurs**, **Modpacks**, **Mondes**, **Blueprints** - créez et gérez les serveurs et leur contenu.
- **Mises à jour**, **Sauvegardes**, **Planifications**, **Stockage**, **Activité** - le côté opérationnel : ce qui est obsolète, vos instantanés, l'automatisation, l'utilisation du disque et le journal d'audit.
- **Paramètres** (en bas) : utilisateurs, clés API et configuration du panneau.

La barre supérieure contient le bouton **Créer un serveur**, un **sélecteur de thème** (sombre/clair) et votre **menu de compte**, où vous pouvez gérer [l'authentification à deux facteurs](/docs/two-factor-authentication/) ou vous déconnecter.

## Sur un téléphone ou une tablette

Chaque page est conçue d'abord pour un écran étroit et s'élargit ensuite : la barre latérale se cache derrière le bouton de menu, les tableaux de données s'empilent en cartes, les barres d'outils s'enroulent et le rail de contrôle du monde se réduit à une carte que vous ouvrez lorsque vous en avez besoin. Les boutons et les puces ont une taille de cible tactile réelle. Rien n'est exclusif aux ordinateurs de bureau.

<p align="center">
  <img src="/docs/images/mobile/dashboard.png" alt="Tableau de bord sur un téléphone" width="180">
  <img src="/docs/images/mobile/server-overview.png" alt="Vue d'ensemble du serveur sur un téléphone" width="180">
  <img src="/docs/images/mobile/server-console.png" alt="Console sur un téléphone" width="180">
  <img src="/docs/images/mobile/mods.png" alt="Onglet Mods sur un téléphone" width="180">
  <img src="/docs/images/mobile/settings.png" alt="Paramètres sur un téléphone" width="180">
</p>

## Ce dont vous avez besoin

Le panneau communique avec Docker pour exécuter des serveurs, il a donc besoin d'un accès à un démon Docker (Docker Desktop ou une socket Docker Engine). Lorsque Docker est accessible, la tuile Docker du tableau de bord affiche **Connecté** et sa version. Sinon, le panneau continue de fonctionner. Vous ne pouvez simplement pas démarrer de serveurs tant que le démon n'est pas actif.

## Prochaines étapes

- [Créez votre premier serveur →](/docs/servers/)
- [Sécurisez votre compte avec la 2FA →](/docs/two-factor-authentication/)
