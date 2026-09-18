---
title: 'Planifications'
description: "La page Planifications automatise les tâches récurrentes à l'aide d'expressions cron."
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/schedules.md'
---

[← Retour à l'index des docs](/docs/)

La page **Planifications** automatise les tâches récurrentes avec des expressions cron. Pas de cron externe, pas de scripts.

![Planifications](/docs/images/schedules.png)

## Ce que vous pouvez planifier

- **Redémarrages** - un redémarrage nocturne pour maintenir un serveur en cours d'exécution en bonne santé.
- **Sauvegardes** - des instantanés réguliers (marqués `scheduled` sur la page [Sauvegardes](/docs/backups/)).
- **Commandes** - exécuter n'importe quelle commande du serveur selon un calendrier.
- **Vérifications de mises à jour** - actualiser périodiquement ce qui est obsolète.

Chaque planification cible un serveur spécifique (ou le panneau globalement), s'exécute selon sa propre expression cron et peut être activée ou désactivée sans être supprimée. L'heure de la dernière exécution est affichée pour que vous puissiez confirmer qu'elle s'est déclenchée.
