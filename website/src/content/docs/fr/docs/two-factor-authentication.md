---
title: 'Authentification à deux facteurs'
description: "L'authentification à deux facteurs (2FA) ajoute une deuxième étape à la connexion : après votre mot de passe, vous saisissez un court code provenant d'une application d'authentification sur votre téléphone."
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/two-factor-authentication.md'
---

[← Retour à l'index des docs](/docs/)

L'authentification à deux facteurs (2FA) ajoute une deuxième étape à la connexion : après votre mot de passe, vous saisissez un court code provenant d'une application d'authentification sur votre téléphone. Même si quelqu'un découvre votre mot de passe, il ne pourra pas accéder à votre compte sans votre appareil.

Elle fonctionne avec n'importe quel authentificateur TOTP standard (Google Authenticator, Authy, 1Password, Microsoft Authenticator, etc.), et elle est disponible pour **tous** les comptes, pas seulement les administrateurs. La protection de votre propre connexion n'est pas une action de gestion de serveur, donc les spectateurs et les opérateurs peuvent également l'activer.

## Activation de la 2FA

Ouvrez le menu du compte (votre initial, en haut à droite) et choisissez **Authentification à deux facteurs**.

![Menu du compte](/docs/images/2fa-user-menu.png)

Une boîte de dialogue d'inscription s'affichera :

![Inscription](/docs/images/2fa-enroll.png)

1. **Scannez le QR code** avec votre application d'authentification, ou appuyez sur **Copier** et saisissez la clé manuelle.
2. Tapez le **code à 6 chiffres** que votre application affiche maintenant.
3. **Confirmez votre mot de passe.** L'activation de la 2FA re-vérifie votre mot de passe, ainsi une session ouverte par inadvertance ne pourra pas l'activer avec l'appareil de quelqu'un d'autre.
4. Cliquez sur **Activer**.

### Sauvegardez vos codes de secours

Dès que la 2FA est activée, le panneau affiche un ensemble de **codes de secours** à usage unique.

![Codes de secours](/docs/images/2fa-backup-codes.png)

Chaque code fonctionne **une seule fois**, pour vous connecter si vous perdez l'accès à votre application d'authentification. Sauvegardez-les en lieu sûr (un gestionnaire de mots de passe est idéal) car ils ne seront plus affichés. Vous pouvez régénérer un nouvel ensemble à tout moment (ce qui invalidera les anciens).

## Connexion avec la 2FA

Désormais, la connexion comporte une deuxième étape. Après votre nom d'utilisateur et votre mot de passe, le panneau vous demande votre code :

![Connexion 2FA](/docs/images/2fa-login-challenge.png)

Entrez le code actuel à 6 chiffres de votre application (ou l'un de vos codes de secours) et vous êtes connecté. Tant que vous n'avez pas terminé cette étape, la session n'est **pas** connectée : elle ne peut accéder à aucune page ni API.

## Gestion ou désactivation de la 2FA

Ouvrez la même entrée **Authentification à deux facteurs** dans le menu du compte lorsqu'elle est activée. Après avoir confirmé votre mot de passe, vous pouvez :

- **Régénérer les codes de secours** - génère un nouvel ensemble et retire les anciens.
- **Désactiver la 2FA** - la supprime de votre compte.

Les deux actions re-vérifient d'abord votre mot de passe actuel.

## Vous avez perdu votre téléphone _et_ vos codes de secours ?

Un **administrateur** peut réinitialiser la 2FA d'un autre utilisateur depuis **Paramètres → Utilisateurs** (le bouton **Réinitialiser** dans la colonne 2FA). Cela efface la 2FA pour le compte afin que l'utilisateur puisse se connecter avec son seul mot de passe et la reconfigurer. Les administrateurs ne peuvent pas réinitialiser leur propre 2FA sans mot de passe. Ils passent par la désactivation normale, protégée par mot de passe, afin qu'une session administrateur piratée ne puisse pas supprimer son propre second facteur.

## Bon à savoir

- Les codes sont basés sur le temps et changent toutes les 30 secondes ; le panneau accepte une légère dérive de l'horloge et récupère silencieusement si l'horloge du serveur est corrigée ultérieurement.
- Un code ne peut pas être rejoué - une fois utilisé pour se connecter, ce même code ne fonctionnera plus dans sa fenêtre de validité.
- Les codes erronés sont limités en taux. Le limiteur est **partagé** avec l'étape du mot de passe (un blocage par compte plus un limiteur par IP `RATE_LIMIT_AUTH_PER_15MIN`), donc entrer un mot de passe correct ne peut pas réinitialiser le compteur juste avant de deviner le code à 6 chiffres.
- Les modifications de la 2FA (activation, désactivation, réinitialisation, utilisation de codes de secours) sont toutes enregistrées dans le [Journal d'activité](/docs/activity/).
