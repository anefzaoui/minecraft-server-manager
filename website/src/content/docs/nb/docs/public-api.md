---
title: 'Offentlig API'
description: 'Et lite, kun-lesbart HTTP API for å hente serverstatus utenfra panelet: et statusdashbord, en oppetidsmonitor, en Discord-bot, en hjemmeautomatiseringsregel.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/public-api.md'
---

[← Tilbake til dokumentindeks](/docs/)

Et lite, skrivebeskyttet HTTP API for å hente serverstatus utenfra panelet: et
statusdashbord, en oppetidsmonitor, en Discord-bot, en regel for hjemmeautomatisering. Det betjenes
av panelet selv og returnerer de samme sanntidsdataene som panelets egne sider
viser (fra hurtigbufferen i minnet), så polling av det berører aldri Docker.

Det er **avslått til en administrator bruker det** og **administratorstyrt**. Ingenting eksponeres
før en token eksisterer.

## Aktivering

**Innstillinger → Offentlig API → Ny nøkkel**. Gi den et navn, velg hva den kan se (alle
servere, eller en spesifikk delmengde), og eventuelt en utløpsdato. Hele nøkkelen (en
Bearer-token) vises **én gang**, i en dialog; kopier den nå, fordi bare en kort prefiks
beholdes etterpå, for identifikasjon i listen.

![Innstillinger for offentlig API](/docs/images/settings-public-api.png)

Oppretting av den første nøkkelen slår på API-et automatisk (bryteren **La eksterne apper
lese status** er en pausekontroll: slå den av for å stoppe servering uten å kansellere noen nøkler). Kanseller en nøkkel fra samme tabell når som helst; klienter som bruker den mister
tilgang umiddelbart.

Tokener lagres som en SHA-256 hash (aldri i klartekst), overlever en panel-
omstart, og overlever serverne de er omfanget til (en slettet server bare
faller ut av den tokenens resultater).

## Autentisering

Send tokenen som en Bearer-legitimasjon:

```
Authorization: Bearer msm_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

Det er ingen informasjonskapsler og **ingen CORS**: dette er for server-til-server og CLI-
kallere, ikke nettleserapper fra en annen opprinnelse. Hvis panelet er bak en omvendt proxy,
sørg for at proxyen videresender `Authorization`-headeren.

Feil returnerer `401` med `{ "ok": false, "error": "..." }`. Alt annet enn `GET`
(eller `HEAD`) returnerer `405`. Ukjente stier returnerer `404`. Når API-et er deaktivert, returnerer hver rute
`404`.

## Rate limit

Hver token får sitt eget budsjett, `RATE_LIMIT_PUBLIC_API_PER_MIN` (standard `120`
forespørsler/minutt; `0` deaktiverer limiteren). Over grensen returnerer `429`. Hver forespørsel, før tokenen dens engang er sjekket, teller også mot et per-klient-IP-tak på fem ganger det tallet, så prøving med manglende, feilformede, tilbakekalte eller utløpte tokener kan ikke omgå budsjettet
ved å rotere dem.

## Endepunkter

### `GET /api/v1/servers`

Hver server tokenen er omfanget til.

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

Én server, samme objekt under en `server`-nøkkel. Returnerer `404` for en ukjent id
**og** for en server tokenen ikke er omfanget til (ingen eksistensorakel), og `400`
for en feilformet id.

## Svarfelter

| Felt            | Betydning                                                                                             |
| --------------- | ----------------------------------------------------------------------------------------------------- |
| `total`         | Hvor mange servere som er synlige for denne tokenen (etter dens omfangsfilter).                       |
| `online`        | Hvor mange av disse som er i tilstand: `running`.                                                     |
| `id`            | Stabil server-id (`srv_...`).                                                                         |
| `name`          | Vist navn.                                                                                            |
| `type`          | itzg servertype (`PAPER`, `FABRIC`, `AUTO_CURSEFORGE`, ...).                                          |
| `state`         | `running`, `starting`, `stopped`, eller `crashed`: en stabil oppsummering av panelets interne status. |
| `cpuPct`        | Nåværende CPU %, eller `null` når serveren ikke kjører.                                               |
| `memoryMb`      | Bosatt minne i MB, eller `null`.                                                                      |
| `memoryLimitMb` | Konfigurert minnegrense for container i MB, eller `null`.                                             |
| `uptimeSeconds` | Sekunder siden containeren startet, eller `null`.                                                     |
| `players`       | `{ online, max }`, eller `null` til serveren rapporterer en spilliste.                                |

## Eksempel

```sh
curl -s https://panel.example.com/api/v1/servers \
  -H "Authorization: Bearer $MSM_TOKEN" | jq
```
