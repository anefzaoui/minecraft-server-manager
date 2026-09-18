---
title: 'Julkinen API'
description: 'Pieni, vain lukuoikeudellinen HTTP API palvelimen tilan hakemiseen paneelin ulkopuolelta: a'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/public-api.md'
---

[← Takaisin dokumenttien hakemistoon](/docs/)

Pieni, vain lukuoikeudellinen HTTP API palvelimen tilan hakemiseen paneelin ulkopuolelta: tilapaneeli, käytettävyysmonitori, Discord-botti, kotiautomaatiosääntö. Paneeli itse tarjoilee sitä ja palauttaa samat reaaliaikaiset tiedot, joita paneelin omat sivut näyttävät (muistissa olevasta välimuistista), joten sen kysely ei koskaan kosketa Dockeria.

Se on **pois päältä, kunnes ylläpitäjä ottaa sen käyttöön** ja **ylläpitäjän valtuuttama**. Mitään ei paljasteta ennen kuin token on olemassa.

## Käyttöönotto

**Asetukset → Julkinen API → Uusi avain**. Anna sille nimi, valitse mitä se voi nähdä (kaikki palvelimet tai tietty alijoukko) ja valinnaisesti vanhenemispäivä. Koko avain (Bearer-token) näytetään **kerran** dialogissa; kopioi se nyt, koska sen jälkeen säilytetään vain lyhyt etuliite tunnistamista varten listassa.

![Julkisen API:n asetukset](/docs/images/settings-public-api.png)

Ensimmäisen avaimen luominen käynnistää API:n automaattisesti (**Anna ulkoisten sovellusten lukea tila** -kytkin on tauko-ohjain: kytke se pois päältä lopettaaksesi tarjoilun peruuttamatta mitään avaimia). Peruuta avain samasta taulukosta milloin tahansa; sitä käyttävät asiakkaat menettävät pääsyn välittömästi.

Tokenit tallennetaan SHA-256-tiivisteenä (ei koskaan selväkielisenä), ne säilyvät paneelin uudelleenkäynnistyksen yli ja elävät pidempään kuin palvelimet, joihin ne on rajattu (poistettu palvelin yksinkertaisesti putoaa pois kyseisen tokenin tuloksista).

## Todennus

Lähetä token Bearer-toteemina:

```
Authorization: Bearer msm_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

Evästeitä ei ole ja **ei CORS**: tämä on palvelinten välisille ja CLI-kutsujille, ei selainsovelluksille toisesta alkuperästä. Jos paneeli on käänteisen välityspalvelimen takana, varmista, että välityspalvelin välittää `Authorization`-otsakkeen.

Epäonnistumiset palauttavat `401` ja `{ "ok": false, "error": "..." }`. Mikä tahansa muu kuin `GET` (tai `HEAD`) palauttaa `405`. Tuntemattomat polut palauttavat `404`. Kun API on poistettu käytöstä, jokainen reitti palauttaa `404`.

## Nopeusrajoitus

Jokaisella tokenilla on oma budjettinsa, `RATE_LIMIT_PUBLIC_API_PER_MIN` (oletus `120` pyyntöä/minuutti; `0` poistaa rajoittimen käytöstä). Yli budjetin palauttaa `429`. Pyynnöt, jotka eivät koskaan esitä kelvollista tokenia (puuttuva, virheellinen, peruutettu tai vanhentunut), rajataan erikseen asiakkaan IP-osoitteen mukaan viisinkertaiseksi tähän lukuun, joten etsintä ei voi ohittaa budjettia vaihtamalla tokeneita.

## Päätepisteet

### `GET /api/v1/servers`

Jokainen palvelin, johon token on rajattu.

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

Yksi palvelin, sama objekti `server`-avaimen alla. Palauttaa `404` tuntemattomalle id:lle **sekä** palvelimelle, johon token ei ole rajattu (ei olemassaolon oraakkelia), ja `400` virheelliselle id:lle.

## Vastauskentät

| Kenttä          | Merkitys                                                                                       |
| --------------- | ---------------------------------------------------------------------------------------------- |
| `total`         | Kuinka monta palvelinta on näkyvissä tälle tokenille (sen rajaussuodattimen jälkeen).          |
| `online`        | Kuinka moni niistä on tilassa: `running`.                                                      |
| `id`            | Vakaa palvelimen id (`srv_...`).                                                               |
| `name`          | Näyttönimi.                                                                                    |
| `type`          | itzg-palvelintyyppi (`PAPER`, `FABRIC`, `AUTO_CURSEFORGE`, ...).                               |
| `state`         | `running`, `starting`, `stopped` tai `crashed` - vakaa yhteenveto paneelin sisäisestä tilasta. |
| `cpuPct`        | Viimeaikainen CPU %, tai `null`, kun palvelin ei ole käynnissä.                                |
| `memoryMb`      | Käytössä oleva muisti megatavuina, tai `null`.                                                 |
| `memoryLimitMb` | Määritetty säiliön muistiraja megatavuina, tai `null`.                                         |
| `uptimeSeconds` | Sekunteja säiliön käynnistymisestä, tai `null`.                                                |
| `players`       | `{ online, max }`, tai `null`, kunnes palvelin raportoi pelaajaluettelon.                      |

## Esimerkki

```sh
curl -s https://panel.example.com/api/v1/servers \
  -H "Authorization: Bearer $MSM_TOKEN" | jq
```
