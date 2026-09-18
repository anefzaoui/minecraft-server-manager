---
title: 'Utilisateurs et rôles'
description: 'Le panneau est multi-utilisateurs.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/users-and-roles.md'
---

[← Retour à l'index des docs](/docs/)

Le panneau est multi-utilisateurs. Gérez les comptes sous **Paramètres → Utilisateurs**.

![Utilisateurs](/docs/images/settings-users.png)

## Les trois rôles

| Rôle         | Ce qu'il peut faire                                                                                                                                           |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **admin**    | Tout : gérer les utilisateurs, les clés API, les fichiers globaux, les remplacements Docker avancés et toutes les actions de serveur.                         |
| **operator** | Lancer et configurer des serveurs (démarrer/arrêter, console, sauvegardes, mondes, mods, la plupart des paramètres), mais pas les zones réservées aux admins. |
| **viewer**   | Lecture seule. Voir les serveurs et leur état, mais sans aucune modification.                                                                                 |

Chaque utilisateur, y compris un spectateur, peut gérer sa propre [authentification à deux facteurs](/docs/two-factor-authentication/), car la protection de son propre compte n'est pas une action de gestion de serveur.

## Réservé aux administrateurs, et pourquoi

Quelques éléments sont délibérément restreints aux administrateurs :

- **Gestion des utilisateurs, clés API et fichiers globaux.**
- **L'[API publique](/docs/public-api/)** - activation de `/api/v1` et création, limitation ou révocation de ses jetons Bearer en lecture seule.
- **Remplacements Docker avancés** - nom de conteneur personnalisé, publications de ports supplémentaires et montages de liaison. Un montage de liaison peut mapper n'importe quel chemin d'hôte dans un conteneur, et combiné avec l'accès Docker du panneau, cela équivaut à un accès root sur l'hôte. Ces champs n'apparaissent que pour les administrateurs.

Les noms de conteneurs personnalisés ne peuvent pas non plus vivre dans l'espace réservé `msm-` du panneau, de sorte qu'un conteneur nommé manuellement ne peut jamais masquer un autre serveur et rediriger un arrêt ou une commande vers la mauvaise instance.

## Gestion des comptes

![Image de profil](/docs/images/profile-picture.png)

Les administrateurs peuvent créer des utilisateurs, modifier les rôles, réinitialiser les mots de passe et supprimer des comptes depuis le tableau des utilisateurs. La colonne **2FA** indique si l'authentification à deux facteurs est activée pour chaque utilisateur ; un administrateur peut **réinitialiser** la 2FA d'un autre utilisateur (en cas de perte de téléphone et de codes de secours), mais jamais désactiver la sienne sans son mot de passe, ce que le flux libre-service gère à la place.

Les tentatives de connexion échouées sont limitées par compte (à la fois un compteur par IP et un compteur global pour le compte) pour ralentir les tentatives de force brute, et la même limite couvre l'étape du code 2FA, de sorte qu'un mot de passe correct ne peut pas réinitialiser le compteur avant la devinette du code. Devant cela se trouve un limiteur de requêtes plus général par IP client sur les points d'accès de connexion / 2FA / configuration, réglable via `RATE_LIMIT_AUTH_PER_15MIN` (par défaut 100 ; derrière un proxy inverse, définissez `TRUST_PROXY` afin qu'il utilise la véritable IP du client).
