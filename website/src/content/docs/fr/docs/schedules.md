---
title: 'Planifications'
description: 'La page Planifications automatise les tâches récurrentes avec des expressions cron. Pas de cron externe, pas de scripts.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/schedules.md'
---

[← Retour à l'index des docs](/docs/)

La page **Planifications** automatise les tâches récurrentes avec des expressions cron. Pas de cron externe, pas de scripts.

![Planifications](/docs/images/schedules.png)

## Ce que vous pouvez planifier

- **Redémarrages** : un redémarrage nocturne pour maintenir un serveur en cours d'exécution en bonne santé.
- **Arrêts et démarrages** : arrêter un serveur pendant la nuit et le redémarrer le matin.
- **Sauvegardes** : des instantanés réguliers (marqués `scheduled` sur la page [Sauvegardes](/docs/backups/)). Une planification de sauvegarde peut également réduire la taille du monde après chaque sauvegarde ([réduction d'un monde](/docs/world-shrink/)). Chaque nouveau serveur obtient automatiquement une planification de sauvegarde quotidienne.
- **Commandes** : exécuter n'importe quelle commande serveur selon un calendrier.
- **Vérifications de mises à jour** : rafraîchir périodiquement ce qui est obsolète. La vérification planifiée est également ce qui applique les mises à jour pour les serveurs configurés pour [Mise à jour automatique](/docs/modpacks/#update-policy).

Chaque planification cible un serveur spécifique (ou le panneau globalement), s'exécute selon sa propre expression cron, et peut être activée ou désactivée sans être supprimée. L'éditeur prévisualise les prochaines heures d'exécution pendant que vous tapez, les heures cron suivent le fuseau horaire du panneau (défini dans **Paramètres**), et le tableau affiche la prochaine exécution de chaque planification. Chaque exécution est enregistrée comme un événement d'historique, tout comme une exécution échouée.

Le panneau initialise également ses propres planifications de maintenance au premier démarrage, que vous pouvez reprogrammer ou désactiver : une vérification quotidienne des mises à jour, une réanalyse du stockage toutes les six heures, une suppression quotidienne des anciens fichiers temporaires, un balayage de l'expiration des bannissements toutes les 15 minutes (levée des bannissements temporaires expirés), et un remplissage nocturne des métadonnées de contenu (remplissage des noms de mods et icônes manquants).

## Quand le serveur est occupé

Une sauvegarde ou un démarrage planifié qui trouve son serveur au milieu d'une autre action (une restauration, un nettoyage de sauvegarde, un changement de port) attend et réessaie chaque minute jusqu'à ce que cette action soit terminée, pendant 30 minutes maximum. Un démarrage en attente est annulé si quelqu'un démarre ou arrête le serveur entre-temps. Un redémarrage ou un arrêt planifié n'est pas retenté : il est ignoré et s'exécute à nouveau à sa prochaine heure prévue.
