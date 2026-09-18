---
title: 'Offentlig API'
description: 'En lille, skrivebeskyttet HTTP API til at hente serverstatus udefra panelet: a'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/public-api.md'
---

[← Tilbage til dokumentindeks](/docs/)

En lille, skrivebeskyttet HTTP API til at hente serverstatus udefra panelet: et
statusdashboard, en oppetidsmonitor, en Discord-bot, en hjemmeautomatiseringsregel. Den
betjenes af panelet selv og returnerer de samme live-data, som panelets egne sider
viser (fra cachen i hukommelsen), så forespørgsler til den aldrig rører Docker.

Den er **slået fra, indtil en administrator bruger den** og **administrator-beskyttet**. Intet eksponeres,
før en token eksisterer.

## Aktivering

**Indstillinger → Offentlig API → Ny nøgle**. Giv den et navn, vælg hvad den kan se (alle
servere eller et specifikt undersæt), og valgfrit en udløbsdato. Den fulde nøgle (en
Bearer-token) vises **én gang** i en dialog; kopier den nu, for kun et kort præfiks
beholdes derefter til identifikation i listen.

![Offentlig API-indstillinger](/docs/images/settings-public-api.png)

Oprettelse af den første nøgle aktiverer API'en automatisk (kontakten **Lad eksterne apps
læse status** er en pausekontrol: slå den fra for at stoppe betjening uden at annullere nogen nøgler). Annuller en nøgle fra den samme tabel til enhver tid; klienter, der bruger den, mister
adgangen øjeblikkeligt.

Tokens gemmes som en SHA-256 hash (aldrig i klartekst), overlever en panelgenstart
og lever længere end de servere, de er omfattet af (en slettet server falder simpelthen
ud af den tokens resultater).

## Godkendelse

Send tokenen som en Bearer-legitimationsoplysning:

```
Authorization: Bearer msm_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

Der er ingen cookies og **ingen CORS**: dette er til server-til-server og CLI-kaldere,
ikke browserapps fra en anden oprindelse. Hvis panelet er bag en reverse proxy,
skal du sørge for, at proxyen videresender `Authorization`-headeren.

Fejl returnerer `401` med `{ "ok": false, "error": "..." }`. Alt andet end `GET`
(eller `HEAD`) returnerer `405`. Ukendte stier returnerer `404`. Når API'en er deaktiveret, returnerer enhver rute
`404`.

## Rate limit

Hver token får sit eget budget, `RATE_LIMIT_PUBLIC_API_PER_MIN` (standard `120`
forespørgsler/minut; `0` deaktiverer begrænseren). Over grænsen returnerer `429`. Forespørgsler, der
aldrig præsenterer en gyldig token (mangler, forkert format, tilbagekaldt eller udløbet), begrænses separat
pr. klient-IP til fem gange det antal, så probing ikke kan omgå budgettet ved at rotere
tokens.

## Endpoints

### `GET /api/v1/servers`

Hver server, som tokenen er omfattet af.

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

Én server, samme objekt under en `server`-nøgle. Returnerer `404` for et ukendt id
**og** for en server, som tokenen ikke er omfattet af (ingen eksistens-orakel), og `400`
for et forkert formateret id.

## Svarfelter

| Felt            | Betydning                                                                                           |
| --------------- | --------------------------------------------------------------------------------------------------- |
| `total`         | Hvor mange servere der er synlige for denne token (efter dens omfang-filter).                       |
| `online`        | Hvor mange af disse der er i tilstanden: `running`.                                                 |
| `id`            | Stabil server-id (`srv_...`).                                                                       |
| `name`          | Visningsnavn.                                                                                       |
| `type`          | itzg servertype (`PAPER`, `FABRIC`, `AUTO_CURSEFORGE`, ...).                                        |
| `state`         | `running`, `starting`, `stopped` eller `crashed` - en stabil oversigt over panelets interne status. |
| `cpuPct`        | Nuværende CPU %, eller `null`, når serveren ikke kører.                                             |
| `memoryMb`      | Resident hukommelse i MB, eller `null`.                                                             |
| `memoryLimitMb` | Konfigureret containerhukommelsesgrænse i MB, eller `null`.                                         |
| `uptimeSeconds` | Sekunder siden containeren startede, eller `null`.                                                  |
| `players`       | `{ online, max }`, eller `null`, indtil serveren rapporterer en spilliste.                          |

## Eksempel

```sh
curl -s https://panel.example.com/api/v1/servers \
  -H "Authorization: Bearer $MSM_TOKEN" | jq
```
