---
title: 'Openbare API'
description: 'Een kleine, alleen-lezen HTTP API voor het ophalen van serverstatus van buiten het paneel: a'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/public-api.md'
---

[← Terug naar de documentatie-index](/docs/)

Een kleine, alleen-lezen HTTP API voor het ophalen van de serverstatus buiten het paneel: een
statusdashboard, een uptime-monitor, een Discord-bot, een thuisautomatiseringsregel. Het wordt
verzorgd door het paneel zelf en retourneert dezelfde livegegevens die de eigen pagina's van het paneel
tonen (uit de in-memory cache), dus het bevragen ervan raakt Docker nooit aan.

Het is **uitgeschakeld totdat een beheerder het gebruikt** en **beheerder-gegate**. Niets wordt blootgesteld
totdat er een token bestaat.

## Inschakelen

**Instellingen → Openbare API → Nieuwe sleutel**. Geef het een naam, kies wat het kan zien (alle
servers, of een specifieke subset), en optioneel een vervaldatum. De volledige sleutel (een
Bearer-token) wordt **één keer** getoond in een dialoogvenster; kopieer deze nu, want daarna wordt alleen een kort voorvoegsel
bewaard voor identificatie in de lijst.

![Instellingen Openbare API](/docs/images/settings-public-api.png)

Het aanmaken van de eerste sleutel schakelt de API automatisch in (de schakelaar **Laat externe apps
status lezen** is een pauzeknop: schakel deze uit om te stoppen met serveren zonder sleutels te annuleren). Annuleer een sleutel op elk moment uit dezelfde tabel; clients die deze gebruiken verliezen
onmiddellijk de toegang.

Tokens worden opgeslagen als een SHA-256 hash (nooit in platte tekst), overleven een paneelherstart, en
overleven de servers waarvoor ze zijn gedefinieerd (een verwijderde server wordt simpelweg
uit de resultaten van dat token verwijderd).

## Authenticatie

Stuur het token als een Bearer-referentie:

```
Authorization: Bearer msm_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

Er zijn geen cookies en **geen CORS**: dit is voor server-naar-server en CLI-aanroepers, niet voor browser-apps van een andere oorsprong. Als het paneel achter een reverse proxy staat, zorg er dan voor dat de proxy de `Authorization`-header doorgeeft.

Fouten retourneren `401` met `{ "ok": false, "error": "..." }`. Alles behalve `GET`
(of `HEAD`) retourneert `405`. Onbekende paden retourneren `404`. Wanneer de API is uitgeschakeld, retourneert elke route
`404`.

## Rate limit

Elk token krijgt zijn eigen budget, `RATE_LIMIT_PUBLIC_API_PER_MIN` (standaard `120`
verzoeken/minuut; `0` schakelt de limiter uit). Boven het limiet retourneren `429`. Verzoeken die nooit een geldig token presenteren (ontbrekend, onjuist geformatteerd, ingetrokken of verlopen) worden afzonderlijk per client-IP beperkt tot vijf keer dat aantal, zodat het verkennen het budget niet kan omzeilen door tokens te roteren.

## Eindpunten

### `GET /api/v1/servers`

Elke server waarvoor het token is gedefinieerd.

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

Eén server, hetzelfde object onder een `server`-sleutel. Retourneert `404` voor een onbekende id
**en** voor een server waarvoor het token niet is gedefinieerd (geen bestaan-orakel), en `400`
voor een onjuist geformatteerde id.

## Antwoordvelden

| Veld            | Betekenis                                                                                                        |
| --------------- | ---------------------------------------------------------------------------------------------------------------- |
| `total`         | Hoeveel servers zichtbaar zijn voor dit token (na de filter op scope).                                           |
| `online`        | Hoeveel daarvan in de status `running` zijn.                                                                     |
| `id`            | Stabiele server-id (`srv_...`).                                                                                  |
| `name`          | Weergavenaam.                                                                                                    |
| `type`          | itzg servertype (`PAPER`, `FABRIC`, `AUTO_CURSEFORGE`, ...).                                                     |
| `state`         | `running`, `starting`, `stopped`, of `crashed` - een stabiele samenvatting van de interne status van het paneel. |
| `cpuPct`        | Recente CPU %, of `null` wanneer de server niet draait.                                                          |
| `memoryMb`      | Gebruikt geheugen in MB, of `null`.                                                                              |
| `memoryLimitMb` | Geconfigureerde containergeheugenlimiet in MB, of `null`.                                                        |
| `uptimeSeconds` | Seconden sinds de container is gestart, of `null`.                                                               |
| `players`       | `{ online, max }`, of `null` totdat de server een spelerslijst rapporteert.                                      |

## Voorbeeld

```sh
curl -s https://panel.example.com/api/v1/servers \
  -H "Authorization: Bearer $MSM_TOKEN" | jq
```
