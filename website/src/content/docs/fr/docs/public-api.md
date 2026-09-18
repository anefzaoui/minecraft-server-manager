---
title: 'API publique'
description: "Une petite API HTTP en lecture seule pour récupérer l'état du serveur depuis l'extérieur du panneau : a"
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/public-api.md'
---

[← Retour à l'index de la documentation](/docs/)

Une petite API HTTP en lecture seule pour récupérer l'état des serveurs depuis l'extérieur du panneau : un tableau de bord d'état, un moniteur de disponibilité, un bot Discord, une règle d'automatisation domestique. Elle est servie par le panneau lui-même et renvoie les mêmes données en direct que celles affichées par les pages du panneau (depuis le cache en mémoire), de sorte que son interrogation ne touche jamais Docker.

Elle est **désactivée jusqu'à ce qu'un administrateur l'utilise** et est **protégée par un administrateur**. Rien n'est exposé tant qu'un jeton n'existe pas.

## Activation

**Paramètres → API publique → Nouvelle clé**. Donnez-lui un nom, choisissez ce qu'elle peut voir (tous les serveurs, ou un sous-ensemble spécifique), et éventuellement une date d'expiration. La clé complète (un jeton Bearer) est affichée **une seule fois**, dans une boîte de dialogue ; copiez-la maintenant, car seul un court préfixe est conservé par la suite, pour identification dans la liste.

![Paramètres de l'API publique](/docs/images/settings-public-api.png)

La création de la première clé active automatiquement l'API (le commutateur **Laisser les applications externes lire l'état** est un contrôle de pause : désactivez-le pour arrêter de servir sans annuler de clés). Annulez une clé à tout moment depuis le même tableau ; les clients qui l'utilisent perdent immédiatement l'accès.

Les jetons sont stockés sous forme de hachage SHA-256 (jamais en clair), survivent à un redémarrage du panneau et survivent aux serveurs auxquels ils sont associés (un serveur supprimé disparaît simplement des résultats de ce jeton).

## Authentification

Envoyez le jeton comme identifiant Bearer :

```
Authorization: Bearer msm_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

Il n'y a pas de cookies et **pas de CORS** : ceci est destiné aux appels serveur à serveur et en ligne de commande, pas aux applications de navigateur d'une autre origine. Si le panneau est derrière un proxy inverse, assurez-vous que le proxy transmet l'en-tête `Authorization`.

Les échecs renvoient `401` avec `{ "ok": false, "error": "..." }`. Tout ce qui n'est pas `GET` (ou `HEAD`) renvoie `405`. Les chemins inconnus renvoient `404`. Lorsque l'API est désactivée, toutes les routes renvoient `404`.

## Limite de débit

Chaque jeton dispose de son propre budget, `RATE_LIMIT_PUBLIC_API_PER_MIN` (par défaut `120` requêtes/minute ; `0` désactive le limiteur). Le dépassement renvoie `429`. Les requêtes qui ne présentent jamais de jeton valide (manquant, malformé, révoqué ou expiré) sont limitées séparément par adresse IP client à cinq fois ce nombre, de sorte que le sondage ne peut pas contourner le budget en faisant tourner les jetons.

## Points d'accès

### `GET /api/v1/servers`

Tous les serveurs auxquels le jeton est associé.

```json
{
  "ok": true,
  "total": 1,
  "online": 1,
  "servers": [
    {
      "id": "srv_ab12cd34",
      "name": "SMP",
      "type": "PAPER",
      "state": "running",
      "cpuPct": 18.4,
      "memoryMb": 2048,
      "memoryLimitMb": 4096,
      "uptimeSeconds": 11722,
      "players": { "online": 3, "max": 20 }
    }
  ]
}
```

### `GET /api/v1/servers/:id`

Un serveur, le même objet sous une clé `server`. Renvoie `404` pour un id inconnu **et** pour un serveur auquel le jeton n'est pas associé (pas d'oracle d'existence), et `400` pour un id malformé.

## Champs de réponse

| Champ           | Signification                                                                                   |
| --------------- | ----------------------------------------------------------------------------------------------- |
| `total`         | Nombre de serveurs visibles par ce jeton (après son filtre de portée).                          |
| `online`        | Nombre de ces serveurs dans l'état : `running`.                                                 |
| `id`            | Identifiant stable du serveur (`srv_...`).                                                      |
| `name`          | Nom d'affichage.                                                                                |
| `type`          | Type de serveur itzg (`PAPER`, `FABRIC`, `AUTO_CURSEFORGE`, ...).                               |
| `state`         | `running`, `starting`, `stopped`, ou `crashed` - un résumé stable de l'état interne du panneau. |
| `cpuPct`        | Pourcentage CPU récent, ou `null` lorsque le serveur n'est pas en cours d'exécution.            |
| `memoryMb`      | Mémoire résidente en Mo, ou `null`.                                                             |
| `memoryLimitMb` | Limite de mémoire du conteneur configurée en Mo, ou `null`.                                     |
| `uptimeSeconds` | Secondes depuis le démarrage du conteneur, ou `null`.                                           |
| `players`       | `{ online, max }`, ou `null` jusqu'à ce que le serveur signale une liste de joueurs.            |

## Exemple

```sh
curl -s https://panel.example.com/api/v1/servers \
  -H "Authorization: Bearer $MSM_TOKEN" | jq
```
