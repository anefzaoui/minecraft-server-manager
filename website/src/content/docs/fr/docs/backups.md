---
title: 'Sauvegardes'
description: 'La page Sauvegardes affiche chaque instantané de votre parc, avec sa taille, sa raison et son ancienneté.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/backups.md'
---

[← Retour à l'index des docs](/docs/)

La page **Sauvegardes** répertorie tous les instantanés de votre parc, avec leur taille, leur raison et leur ancienneté.

![Sauvegardes](/docs/images/backups.png)

## Créer une sauvegarde

Depuis l'onglet **Sauvegardes** d'un serveur (ou via une [planification](/docs/schedules/)), vous pouvez créer un instantané de l'intégralité du répertoire du serveur en un clic. Le panneau met d'abord le monde en veille (`save-off` → `save-all`), compresse les données, puis réactive la sauvegarde (`save-on`), garantissant ainsi la cohérence des sauvegardes, même sur un serveur en cours d'exécution. La compression s'effectue dans un thread d'arrière-plan afin de ne pas bloquer le panneau. Chaque sauvegarde peut être accompagnée d'une note.

Chaque archive est **vérifiée en intégrité** au moment de sa création : le panneau rouvre l'archive zip et lit son contenu. Une archive corrompue ou impossible à ouvrir est supprimée et l'opération de sauvegarde échoue immédiatement, plutôt que le problème ne se manifeste des mois plus tard lorsqu'une restauration est le seul recours pour éviter une perte de données. Une archive vide (un serveur qui n'a jamais démarré) est autorisée mais signalée dans l'événement.

Cochez **"Réduire également le monde après"** (sur l'onglet Sauvegardes, ou dans une planification de sauvegarde) pour supprimer les chunks rarement visités une fois l'archive sauvegardée en toute sécurité (voir **[Réduire un monde](/docs/world-shrink/)**). La réduction ne s'exécute que lorsque le serveur est arrêté ; sur un serveur en cours d'exécution, la sauvegarde a lieu et la réduction est ignorée.

![Sauvegardes de serveur](/docs/images/server-backups.png)

## Raisons des sauvegardes

Les sauvegardes sont étiquetées en fonction de la raison pour laquelle elles ont été créées :

- **manuelle** - vous avez cliqué sur le bouton.
- **planifiée** - créée par une [planification](/docs/schedules/). Chaque nouveau serveur reçoit également automatiquement une sauvegarde planifiée quotidienne (entre 02h00 et 05h59), assurant ainsi une couverture automatique dès le premier jour, pas seulement avant les mises à jour.
- **pré-mise à jour** - effectuée automatiquement avant une mise à niveau de pack, rendant ainsi une mise à niveau toujours réversible.
- **pré-restauration** - effectuée automatiquement juste avant une restauration ou une réinitialisation du monde, comme filet de sécurité au cas où la restauration ne serait pas celle que vous attendiez.

## Rétention

La rétention est limitée **par serveur, par raison** : les plus récentes de chaque groupe sont conservées, les plus anciennes sont automatiquement supprimées après chaque sauvegarde réussie :

| Raison           | Conservées |
| ---------------- | ---------- |
| planifiée        | 10         |
| pré-mise à jour  | 10         |
| manuelle         | 20         |
| pré-restauration | 5          |

`pré-restauration` dispose de son propre petit espace dédié afin qu'une sauvegarde de sécurité automatique ne puisse jamais évincer une sauvegarde `manuelle` que vous avez délibérément conservée.

Deux plafonds optionnels s'appliquent en plus des décomptes par raison, tous deux désactivés par défaut : un **âge maximum** (les sauvegardes plus anciennes que N jours sont supprimées, quelle que soit leur raison) et une **taille totale maximale** par serveur (les sauvegardes les plus anciennes sont supprimées jusqu'à ce que le total corresponde, en commençant par les sauvegardes `pré-restauration`). La sauvegarde la plus récente d'un serveur n'est jamais supprimée par l'un ou l'autre plafond. Toutes ces options peuvent être modifiées globalement sur la page Paramètres, et remplacées par serveur sur son onglet Sauvegardes.

Les sauvegardes peuvent être **renommées** depuis la liste des sauvegardes (bouton renommer sur chaque ligne). L'archive sur disque et l'enregistrement du panneau évoluent ensemble, de sorte que le téléchargement, la restauration et la rétention continuent de fonctionner avec le nouveau nom.

![Renommer une sauvegarde](/docs/images/backup-rename.png)

> La rétention est automatiquement limitée, mais les grosses archives moddées comptent toujours dans le [quota de stockage](/docs/storage/) d'un serveur, alors gardez un œil sur le total pour les gros packs.

## Restauration

La restauration d'une sauvegarde arrête le serveur (vérifiant que le conteneur s'est bien arrêté avant de toucher aux fichiers), effectue une sauvegarde de sécurité `pré-restauration`, remplace **l'intégralité du répertoire du serveur** par l'instantané, et le laisse arrêté pour que vous puissiez le redémarrer. Comme les mises à niveau de pack effectuent toujours une sauvegarde `pré-mise à jour` au préalable, vous pouvez toujours annuler une mise à niveau défectueuse.

## La base de données du panneau elle-même

Les sauvegardes de serveur ne couvrent que les répertoires de monde par serveur. La base de données du panneau elle-même (`panel.db`, contenant les utilisateurs, les rôles, les secrets 2FA, les planifications, les épingles de pack et l'historique) est sauvegardée séparément lors de la minuterie de maintenance quotidienne :

- `VACUUM INTO` écrit une copie cohérente et défragmentée dans `data/backups/_panel/` ; les **14** plus récentes sont conservées.
- Au démarrage, le panneau exécute `PRAGMA integrity_check` et enregistre bruyamment en cas d'échec, vous indiquant `data/backups/_panel` pour la copie valide la plus récente.

Sauvegardez l'intégralité de l'arborescence `data/` (elle contient également `.secret-key`, la clé de chiffrement au repos) et vous aurez sauvegardé le tout.
