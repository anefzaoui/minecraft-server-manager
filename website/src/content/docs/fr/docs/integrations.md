---
title: 'Intégrations'
description: "Chaque serveur héberge ses intégrations sous le groupe Paramètres : Discord, une Page de Statut publique, des Invitations en un clic et l'onglet optionnel Chatbot."
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/integrations.md'
---

[← Retour à l'index des docs](/docs/)

Chaque serveur intègre ses propres fonctionnalités sous le groupe **Paramètres** : **Discord**, une **Page de statut** publique, des **Invitations** en un clic et l'onglet optionnel **Chatbot**. Cette page couvre Discord (les autres disposent de leur propre documentation et d'aides à la configuration dans le panneau).

## Notifications Discord

Le panneau transmet les événements du serveur à un canal Discord via un webhook. Pas de bot, pas d'OAuth.

### Configuration

1. Dans Discord : **Paramètres du serveur → Intégrations → Webhooks → Nouveau Webhook**. Choisissez le canal et copiez l'URL du webhook.
2. Dans le panneau, ouvrez l'onglet **Paramètres → Discord** du serveur, collez l'URL dans **URL du Webhook**, activez la carte, et **Enregistrez**. L'URL est stockée de manière chiffrée (dans le même espace de stockage au repos que vos clés API).
3. Utilisez **Envoyer un test** pour confirmer que cela fonctionne.

![Intégration Discord](/docs/images/integrations-discord.png)

Pour remplacer une URL stockée, collez-en une nouvelle et enregistrez ; laissez le champ vide pour conserver l'actuelle. L'URL stockée est affichée masquée (le token est caché).

### Ce qui est envoyé

Les notifications sont regroupées en catégories désactivables. Toutes sont activées par défaut.

| Catégorie                      | Événements                                                                   |
| ------------------------------ | ---------------------------------------------------------------------------- |
| **Démarrage / arrêt**          | Serveur démarré, serveur arrêté                                              |
| **Plantages**                  | Plantage, boucle de plantage détectée, nouveau rapport de plantage           |
| **Sauvegardes**                | Sauvegarde créée, sauvegarde restaurée                                       |
| **Mises à jour**               | Mise à jour appliquée, mise à jour annulée, mise à jour échouée              |
| **Expulsions / bannissements** | Joueur expulsé, joueur banni                                                 |
| **Alertes**                    | Les éléments qui laissent un serveur silencieusement cassé (voir ci-dessous) |

### La catégorie Alertes

`Alertes` est le canal "quelque chose nécessite une intervention humaine", pour les conditions qui n'étaient auparavant visibles que dans le panneau :

| Événement               | Signification                                                                                                                              |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `oom`                   | Le conteneur a été arrêté pour manque de mémoire.                                                                                          |
| `unhealthy`             | Le processus est actif mais la sonde `mc-health` échoue : un serveur vivant mais mort.                                                     |
| `startup-stalled`       | Démarrage toujours en cours après environ 10 minutes sans "Terminé" dans les logs (avec un diagnostic de ce qui ne va pas, lorsque connu). |
| `stop-failed`           | Un arrêt normal n'a pas pris effet et le conteneur est toujours en cours d'exécution.                                                      |
| `schedule-failed`       | Un redémarrage / une sauvegarde / une commande planifiée a échoué.                                                                         |
| `quota-exceeded`        | Le quota disque en mode strict a été dépassé et le serveur a été arrêté.                                                                   |
| `offline-after-restart` | Le serveur était actif avant le redémarrage du panneau, ne l'est plus, et ne sera pas redémarré automatiquement.                           |
| `crash-report`          | Un nouveau rapport de plantage a été capturé et analysé.                                                                                   |
| `update-failed`         | Une mise à jour surveillée n'a pas abouti à un état sain.                                                                                  |

### Comment fonctionne la livraison

Un pont d'arrière-plan interroge le [journal d'activité](/docs/activity/) toutes les 15 secondes et transmet les lignes mappées. Si un POST de webhook échoue de manière transitoire, cette ligne est retentée lors des interrogations ultérieures plutôt que d'être perdue ; un webhook définitivement inaccessible est mis en sourdine (une ligne de log par heure) après quelques tentatives. Le pont ne rejoue jamais les événements antérieurs au démarrage du panneau.
