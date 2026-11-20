---
title: "Journal d'activité"
description: "La page d'activité est la piste d'audit complète : un enregistrement chronologique et consultable de tout ce qui s'est passé dans le panneau."
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/activity.md'
---

[← Retour à l'index des docs](/docs/)

La page **Activité** est la piste d'audit complète : un enregistrement chronologique et consultable de tout ce qui s'est passé dans le panneau. Filtrez-la par serveur ou par type d'événement, recherchez dans les résumés et exportez ce que vous avez filtré en CSV ou JSON. Les entrées qui ont capturé un journal (un crash, par exemple) l'ouvrent sur place.

![Activité](/docs/images/activity.png)

## Ce qui est enregistré

- **Authentification** : connexions (y compris si l'authentification à deux facteurs ou un code de secours a été utilisé), blocages de compte, changements de mot de passe, et activation, désactivation ou réinitialisation de l'authentification à deux facteurs.
- **Cycle de vie du serveur** : créations, démarrages, arrêts, redémarrages, crashs, redémarrages automatiques et événements de manque de mémoire.
- **Alertes** : démarrages bloqués, échecs d'arrêt, planifications échouées, arrêts dus à des quotas, conteneurs non sains, hors ligne après redémarrage.
- **Données** : sauvegardes créées et restaurées, plans exportés, installations et mises à niveau de packs, modifications de mods et de mondes, et modifications de fichiers.
- **Joueurs** : expulsions, bannissements, changements de liste blanche et d'opérateur, et notes de joueurs.
- **Configuration** : changements de commandes de chat, changements d'utilisateurs et de rôles, changements de permissions par serveur, changements de ports de jeu et modifications de paramètres.

Chaque entrée enregistre qui l'a effectuée (un nom d'utilisateur, ou le panneau/planificateur pour les actions automatisées), à quel serveur elle se rapporte et quand. Le [tableau de bord](/docs/dashboard/) affiche les entrées les plus récentes ; cette page est l'historique complet. Les opérateurs et les spectateurs ne voient que les entrées des serveurs qu'ils peuvent consulter (plus celles globales du panneau), et les changements de permissions par serveur ne sont montrés qu'aux administrateurs. Les événements de cycle de vie et d'alerte peuvent également être transmis à Discord (voir [Intégrations](/docs/integrations/)).

Étant donné qu'il capture les événements liés à la sécurité (connexions, changements d'authentification à deux facteurs, changements de rôles et de permissions), le journal d'activité est également votre premier recours si quelque chose semble suspect concernant un compte.
