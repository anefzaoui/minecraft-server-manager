---
title: "Journal d'activité"
description: "La page d'activité est la piste d'audit complète : un enregistrement chronologique et consultable de tout ce qui s'est passé dans le panneau."
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/activity.md'
---

[← Retour à l'index des docs](/docs/)

La page **Activité** est le journal d'audit complet : un enregistrement chronologique et consultable de tout ce qui s'est passé dans le panneau.

![Activité](/docs/images/activity.png)

## Ce qui est enregistré

- **Authentification** - connexions (y compris si l'authentification à deux facteurs ou un code de secours a été utilisé), et activation, désactivation ou réinitialisation de l'authentification à deux facteurs.
- **Cycle de vie du serveur** - créations, démarrages, arrêts, redémarrages, plantages et événements de manque de mémoire.
- **Alertes** - démarrages bloqués, échecs d'arrêt, planifications échouées, arrêts dus à des quotas, conteneurs non sains, hors ligne après redémarrage.
- **Données** - sauvegardes créées et restaurées, modèles exportés, installations et mises à niveau de packs.
- **Configuration** - modifications des commandes de chat, changements de rôles et modifications des paramètres.

Chaque entrée enregistre qui l'a effectuée (un nom d'utilisateur, ou le panneau/planificateur pour les actions automatisées), à quel serveur elle se rapporte et quand. Le [tableau de bord](/docs/dashboard/) affiche les entrées les plus récentes ; cette page est l'historique complet. Les événements de cycle de vie et d'alerte peuvent également être transférés vers Discord (voir [Intégrations](/docs/integrations/)).

Parce qu'il capture les événements pertinents pour la sécurité (connexions, changements de 2FA, changements de rôles), le journal d'activité est également votre premier arrêt si quelque chose semble suspect concernant un compte.
