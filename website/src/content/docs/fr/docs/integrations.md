---
title: 'Intégrations'
description: "Chaque serveur possède ses intégrations dans le groupe Paramètres : Discord, une Page de Statut publique, des Invitations en un clic, et l'onglet optionnel Chatbot (réservé aux administrateurs)."
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/integrations.md'
---

[← Retour à l'index de la documentation](/docs/)

Chaque serveur possède ses intégrations sous le groupe **Paramètres** : **Discord**, une **Page de statut** publique, des **Invitations** en un clic, et l'onglet optionnel **Chatbot** (réservé aux administrateurs). Cette page couvre Discord ; [invitations et page de statut](/docs/invites-and-status-page/) couvre ces deux éléments, et [le chatbot](/docs/chatbot/) a sa propre page.

## Notifications Discord

Le panneau transmet les événements du serveur à un canal Discord via un webhook. Pas de bot, pas d'OAuth.

### Configuration

1. Dans Discord : **Paramètres du serveur → Intégrations → Webhooks → Nouveau Webhook**. Choisissez le canal et copiez l'URL du webhook.
2. Dans le panneau, ouvrez l'onglet **Paramètres → Discord** du serveur, collez l'URL dans **URL du Webhook**, activez la carte **on**, et **Enregistrez**. L'URL est stockée cryptée (dans le même espace de stockage au repos que vos clés API).
3. Utilisez **Envoyer un test** pour confirmer que cela fonctionne.

![Intégration Discord](/docs/images/integrations-discord.png)

Pour remplacer une URL stockée, collez-en une nouvelle et enregistrez ; laissez le champ vide pour conserver l'actuelle. L'URL stockée est affichée masquée (le jeton est caché).

### Ce qui est envoyé

Les notifications sont regroupées en catégories désactivables. Toutes sont activées par défaut.

| Catégorie                      | Événements                                                                      |
| ------------------------------ | ------------------------------------------------------------------------------- |
| **Démarrage / arrêt**          | Serveur démarré, serveur arrêté                                                 |
| **Plantages**                  | Plantage, boucle de plantage détectée, nouveau rapport de plantage              |
| **Sauvegardes**                | Sauvegarde créée, sauvegarde restaurée                                          |
| **Mises à jour**               | Mise à jour appliquée, mise à jour annulée, mise à jour échouée                 |
| **Expulsions / bannissements** | Joueur expulsé, joueur banni                                                    |
| **Alertes**                    | Les éléments qui laissent silencieusement un serveur en panne (voir ci-dessous) |

### La catégorie Alertes

`Alertes` est le canal "quelque chose nécessite une intervention humaine", pour les conditions qui n'étaient auparavant visibles que dans le panneau :

| Événement               | Signification                                                                                                                                    |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `oom`                   | Le conteneur a été arrêté car il manquait de mémoire.                                                                                            |
| `unhealthy`             | Le processus est actif mais la sonde `mc-health` échoue : un serveur en ligne mais mort.                                                         |
| `startup-stalled`       | Démarrage toujours en cours après environ 10 minutes sans "Terminé" dans les logs (avec un diagnostic de ce qu'il faut corriger, lorsque connu). |
| `stop-failed`           | Un arrêt normal n'a pas pris effet et le conteneur est toujours en cours d'exécution.                                                            |
| `schedule-failed`       | Un redémarrage / une sauvegarde / une commande planifiée a échoué.                                                                               |
| `quota-exceeded`        | Le quota de disque en mode strict a été atteint et le serveur a été arrêté.                                                                      |
| `offline-after-restart` | Le serveur était en ligne avant le redémarrage du panneau, ne l'est plus, et ne sera pas redémarré automatiquement.                              |
| `port-change-failed`    | Une modification de port a échoué et le serveur n'a pas pu être remis sur son ancien port, il est donc arrêté.                                   |
| `auto-restart-gave-up`  | Un serveur planté n'a pas été redémarré car une autre action l'a occupé trop longtemps.                                                          |

### Comment fonctionne la livraison

Un pont d'arrière-plan interroge le [journal d'activité](/docs/activity/) toutes les 15 secondes et transmet les lignes mappées. Si un POST de webhook échoue de manière transitoire, cette ligne est retentée lors des interrogations ultérieures au lieu d'être ignorée ; après plusieurs tentatives échouées, la ligne est ignorée, et les échecs de livraison sont enregistrés au plus une fois par heure et par serveur. Après un redémarrage du panneau, le pont envoie les événements qu'il n'avait pas encore livrés, mais jamais plus de deux heures en arrière ; lors de sa toute première exécution, il commence par l'événement le plus récent.
