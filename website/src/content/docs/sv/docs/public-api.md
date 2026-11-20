---
title: 'Publikt API'
description: 'Ett litet, endast läsbart HTTP API för att hämta serverstatus utifrån panelen: en status-dashboard, en upptid-monitor, en Discord-bot, en hem-automationsregel.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/public-api.md'
---

[← Tillbaka till dokumentindex](/docs/)

Ett litet, skrivskyddat HTTP API för att hämta serverstatus utifrån panelen: en
status-dashboard, en upptid-monitor, en Discord-bot, en regel för hemautomatisering. Det
hanteras av panelen själv och returnerar samma live-data som panelens egna sidor
visar (från cacheminnet), så att anropa det berör aldrig Docker.

Det är **avstängt tills en administratör använder det** och **skyddat av administratörsrättigheter**. Ingenting exponeras
förrän en token existerar.

## Aktivera det

**Inställningar → Publikt API → Nyckel**. Ge det ett namn, välj vad det kan se (alla
servrar, eller en specifik delmängd), och eventuellt ett utgångsdatum. Hela nyckeln (en
Bearer-token) visas **en gång**, i en dialogruta; kopiera den nu, eftersom endast en kort prefix
behålls efteråt, för identifiering i listan.

![Inställningar för publikt API](/docs/images/settings-public-api.png)

Skapandet av den första nyckeln slår på API:et automatiskt (reglaget **Låt externa appar
läsa status** är en pausfunktion: stäng av det för att sluta hantera utan att avbryta några nycklar). Avbryt en nyckel från samma tabell när som helst; klienter som använder den förlorar
åtkomst omedelbart.

Tokens lagras som en SHA-256-hash (aldrig i klartext), överlever en panel-
omstart, och lever längre än de servrar de är begränsade till (en borttagen server
tas helt enkelt bort från den tokenens resultat).

## Autentisering

Skicka token som en Bearer-autentisering:

```
Authorization: Bearer msm_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

Det finns inga cookies och **ingen CORS**: detta är för server-till-server- och CLI-
anropare, inte webbläsarappar från en annan ursprung. Om panelen ligger bakom en omvänd proxy,
se till att proxyn vidarebefordrar `Authorization`-huvudet.

Fel returnerar `401` med `{ "ok": false, "error": "..." }`. Allt annat än `GET`
(eller `HEAD`) returnerar `405`. Okända sökvägar returnerar `404`. När API:et är inaktiverat returnerar varje rutt
`404`.

## Begränsning av anropstakt

Varje token får sin egen budget, `RATE_LIMIT_PUBLIC_API_PER_MIN` (standard `120`
anrop/minut; `0` inaktiverar begränsningen). Över gränsen returnerar `429`. Varje anrop, innan dess token ens kontrolleras, räknas också mot ett tak per klient-IP på fem gånger det antalet, så att undersökning med saknade, felaktiga, återkallade eller utgångna tokens inte kan kringgå budgeten genom att rotera dem.

## Slutpunkter

### `GET /api/v1/servers`

Varje server som token är begränsad till.

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

En server, samma objekt under en `server`-nyckel. Returnerar `404` för ett okänt id
**och** för en server som token inte är begränsad till (ingen existens-orakel), och `400`
för ett felaktigt id.

## Svarsfält

| Fält            | Betydelse                                                                                               |
| --------------- | ------------------------------------------------------------------------------------------------------- |
| `total`         | Hur många servrar som är synliga för denna token (efter dess omfångsfilter).                            |
| `online`        | Hur många av dessa som är i tillståndet: `running`.                                                     |
| `id`            | Stabil server-id (`srv_...`).                                                                           |
| `name`          | Visningsnamn.                                                                                           |
| `type`          | itzg servertyp (`PAPER`, `FABRIC`, `AUTO_CURSEFORGE`, ...).                                             |
| `state`         | `running`, `starting`, `stopped`, eller `crashed`: en stabil sammanfattning av panelens interna status. |
| `cpuPct`        | Nyares CPU %, eller `null` när servern inte körs.                                                       |
| `memoryMb`      | Resident minne i MB, eller `null`.                                                                      |
| `memoryLimitMb` | Konfigurerad container-minnesgräns i MB, eller `null`.                                                  |
| `uptimeSeconds` | Sekunder sedan containern startades, eller `null`.                                                      |
| `players`       | `{ online, max }`, eller `null` tills servern rapporterar en spelarlista.                               |

## Exempel

```sh
curl -s https://panel.example.com/api/v1/servers \
  -H "Authorization: Bearer $MSM_TOKEN" | jq
```
