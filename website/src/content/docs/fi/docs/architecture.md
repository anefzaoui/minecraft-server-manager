---
title: 'Arkkitehtuuri'
description: 'Minecraft Server Manager on yhden prosessin, palvelimella renderöity Node.js-sovellus.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/architecture.md'
---

[← Takaisin dokumenttien hakemistoon](/docs/)

Minecraft Server Manager on yksiprosessinen, palvelinrenderöity Node.js-sovellus. Se hallinnoi
Minecraft-palvelimia, jotka ajetaan Docker-säiliöinä käyttäen
[itzg/docker-minecraft-server](https://github.com/itzg/docker-minecraft-server) -kuvaa, kommunikoiden
Docker-demonin kanssa sen API:n kautta (ei koskaan suorittamalla `docker` CLI:tä).

## Suorituskyvyn muoto

- **Express + Handlebars** renderöivät sivut palvelinpuolella. SPA:ta ei ole; `public/js/`-kansiossa
  oleva selain-JS on käsin kirjoitettua progressiivista parannusta. esbuild-vaihe (`pnpm run build:js`)
  paketoi ja minifioi sen `public/dist/js/`-kansioon; sovellus tarjoilee tämän paketin, kun se on
  olemassa, ja raa'an lähdekoodin muuten, joten kehitysajona ilman buildia toimii silti.
- **`node:sqlite`** (sisäänrakennettu Nodeen; paneeli vaatii Node ≥ 24) on tietokanta - synkroninen,
  ei natiivisia moduuleja, WAL-tila. Pieni versioitu migraatioiden suorittaja soveltaa
  `src/db/migrations/*`-tiedostoja käynnistyksen yhteydessä. Valmistellut lausekkeet on välimuistissa
  `src/db/index.js`-tiedostossa, avaimena SQL-teksti.
- **`ws`** välittää live-konsoli- ja tilastovirrat. Molemmat ovat **välitettyjä**: yksi ylävirta
  `docker logs --follow` (tai `docker stats`) per palvelin, demuxattuna kerran ja jaettuna jokaiseen
  yhdistettyyn välilehteen, sen sijaan että yksi ylävirta per katsoja. Konsolien välittäjä pitää pienen
  toistopuskurin myöhään liittyville välilehdille ja pudottaa tilaajan, jonka socket putoaa liian
  kauas jälkeenpäin, sen sijaan että hidastaisi jaettua virtaa.
- **dockerode** on ainoa tapa, jolla sovellus puhuu Dockerille. Päätepiste tunnistetaan automaattisesti
  alustan mukaan (Windows-nimetty putki vs. unix-socket).
- **Kaikki pysyvä tila sijaitsee yhden hakemiston alla** (`$DATA_DIR`, oletus `./data`). Tuon
  hakemiston kopiointi siirtää koko paneelin.

## Kerrostus

Riippuvuudet virtaavat yhteen suuntaan:

```
                 ┌─────────────────────────────┐
   HTTP  ───────▶│  web/routes/*  (+ middleware)│   jäsentää ja validoi syötteen, muotoilee vastaukset
                 └──────────────┬──────────────┘
                                │
                 ┌──────────────▼──────────────┐
                 │         services/*          │   domainilogiikka (varsinaiset ominaisuudet)
                 └───┬─────────┬─────────┬─────┘
                     │         │         │
        ┌────────────▼──┐ ┌────▼────┐ ┌──▼──────────┐
        │   docker/*    │ │  db/*   │ │  storage/*  │   infrastruktuuri
        └───────────────┘ └─────────┘ └─────────────┘
```

- **`web/routes/`** - yksi reititin per domain (`servers`, `players`, `worlds`, `crashes`, `blueprints`,
  `files`, …), liitetty `web/app.js`-tiedostoon. Reitittimet validoivat zodilla, kutsuvat palvelua ja
  palauttavat JSON:n tai renderöivät näkymän. Liiketoimintalogiikka ei kuulu tänne. Kaksi reititintä on
  liitetty **julkiseen vyöhykkeeseen**, ennen `requireAuth`-toimintoa: `routes/status.js` (valinnainen
  per-palvelin HTML-tilasivut) ja `routes/apiV1.js` (`/api/v1`, vain luku -oikeuksinen JSON API,
  autentikoitu ylläpitäjän myöntämällä Bearer-tokenilla `services/apiTokens.js`-tiedostosta, pois
  päältä ellei asetettu Asetuksissa; katso `docs/public-api.md`).
- **`services/`** - sovelluksen ydin. Jokainen palvelu omistaa yhden domainin ja voi riippua
  infrastruktuurista ja muista palveluista.
- **`docker/`** - dockerode-kääreet: `connect` (päätepisteen tunnistus + daemonin tila), `containers`
  (luo/käynnistä/pysäytä/luo uudelleen sidotuilla mountteilla, muisti/CPU-rajoituksilla ja
  labelilla), `logs`, `stats`, `images` ja `watcher`, joka muuntaa Docker-tapahtumat historiaksi +
  kaatumisten havaitsemiseksi.
- **`db/`** - SQLite-kääre ja migraatioiden suorittaja.
- **`storage/`** - `./data`-käynnistys, **polun suojaus** (`safeJoin`, tiedostojen turvallisuuden
  selkäranka) ja taustalla oleva kokoindeksoija + kiintiöiden valvonta.

Poikkileikkaavat:

- **`config/`** - ympäristökonfiguraatio plus **kenttäluettelo**: totuuden ainoa lähde
  palvelinasetuksille. Jokainen itzg-ympäristömuuttuja on luetteloitu (label, ohje, tyyppi, yksikkö,
  oletus, validointi, osio, vaara-liput). Velho, asetuslomakkeet ja zod-validointi johdetaan kaikki
  siitä, joten uuden asetuksen paljastaminen on datamuutos, ei uutta käyttöliittymäputkea.
- **`events/`** - `recordEvent()` on ainoa sisääntulopiste historiallokiin; elinkaaren tapahtumat
  kaappaavat myös säiliön lokin otteita `data/logs/<id>/events/`-kansioon.
- **`ws/`** - autentikoidut konsoli- + tilastot WebSocketsit (istuntotunniste vahvistettu päivityksessä,
  `Origin` tarkistettu estämään sivustojen väliset kaappaukset), välitetty per palvelin (katso
  "Suorituskyvyn muoto").
- **`logger.js` + `instrument.js`** - `require('./logger')(label)` palauttaa moduulikohtaisen
  [Pino](https://getpino.io) -lokintunnistimen; taso `LOG_LEVEL`-muuttujasta, `makeFailureThrottle()`
  pitää jatkuvasti epäonnistuvan taustasilmukan yhtenä lokirivinä plus "palautettu" rivi.
  `src/utils/logSanitize.js` poistaa salasanatiedot sisältävät avaimet ja webhook-tokenit
  rakenteellisesta metadatasta; `src/config/logLevel.js` on jaettu tasojen sallittujen luettelo
  (pidetään erillään, jotta vältetään vaatimusketju `config`-tiedoston kanssa). `src/instrument.js` on
  lepäävä Sentry-sauma, ladattu ensimmäisenä `src/server.js`-tiedostossa. `src/web/middleware/requestLog.js`
  kirjoittaa yhden pääsylokin rivin per pyyntö (ohittaen `/healthz` ja staattiset resurssit). ESLint
  valvoo `no-console`-sääntöä `src/**`-kansiossa, poikkeuksina `preflight.js`, `instrument.js` ja
  `config/index.js` (ne suoritetaan ennen lokintunnistimen olemassaoloa).
- **Nopeusrajoitus** - `src/web/middleware/rateLimit.js` asettaa `express-rate-limit`-toiminnon
  `/api`-etuliitteen eteen (`RATE_LIMIT_API_PER_MIN`, oletus 1200) ja kirjautumis- / 2FA- /
  asetus-POST-pyynnöt (`RATE_LIMIT_AUTH_PER_15MIN`, oletus 10); `0` poistaa rajoittimen käytöstä. Se
  käyttää avaimena `req.ip`, joten `TRUST_PROXY` on tärkeä välityspalvelimen takana. `/api/v1`-osoitteella
  on oma per-token-rajoittimensa (`RATE_LIMIT_PUBLIC_API_PER_MIN`, oletus 120), avaimena Bearer-tokenin
  tiiviste IP-varalla. Erillinen per-tili pehmeä laskuri
  `src/web/middleware/auth.js`-tiedostossa käsittelee kirjautumislukituksen (per-IP ja tili-globaali,
  hajoava).

## Keskeiset domain-käyttäytymismallit

- **Modipaketit ovat aina kiinnitettyjä.** Kuva päivittää automaattisesti kiinnittämättömät paketit
  joka käynnistyksen yhteydessä, joten paneeli ratkaisee "uusimman" konkreettiseksi versiotunnukseksi
  asennushetkellä ja kiinnittää sen. Päivitykset ovat eksplisiittinen orkestroitu virta (`updates/`):
  esikatselu → päivityksen esivarmuuskopiointi → sulava pysäytys → uudelleenkiinnitys →
  uudelleenluonti → tilanvalvonta → yhden klikkauksen palautus.
- **Mukautettu mod-overlay** on paneelin hallinnoima: käyttäjän lisäämät modit laskeutuvat
  deduplikoidulle kirjastolle ja linkitetään kovasti palvelimeen, joten ne selviävät pakettipäivityksistä.
  Poistaminen on luokkatietoista.
- **Portit** allokoidaan perusjärjestelmästä (peli `PORT_GAME_START`-portista ylöspäin, RCON = peli +
  `PORT_RCON_OFFSET`, Bedrock `PORT_BEDROCK_START`-portista), tutkitaan saatavuuden varalta ja
  varataan tietokannasta.
- **Levykiintiöt** valvotaan paneelin toimesta, koska Docker ei voi rajoittaa sidottujen mounttien
  käyttöä: indeksoija välimuistittaa hakemistokohtaiset koot ja levynkasvuoperaatiot perustuvat niihin.
- **Salaisuudet** (RCON-salasanat, API-avaimet, TOTP-salaisuudet, Discord-webhook-URL) salataan
  levossa AES-256-GCM:llä käyttäen erillistä satunnaista avainta osoitteessa
  `$DATA_DIR/.secret-key` (tila `0600`, automaattisesti generoitu). Se on riippumaton `SESSION_SECRET`:stä;
  `SESSION_SECRET`-johdettu avain säilytetään vain purkuun käytettävänä varavaihtoehtona arvoille, jotka
  on kirjoitettu ennen erillisen avaimen olemassaoloa, ja
  `src/services/secretsMigration.js` salaa ne uudelleen erillisen avaimen alle kerran käynnistyksen
  yhteydessä. `.secret-key`, joka on olemassa mutta ei jäsenny, on vakava käynnistysvirhe (sitä ei
  koskaan generoida hiljaa uudelleen päälle). Blueprintit poistavat kaikki salaisuudet viennin
  yhteydessä.

## Data- ja siirtomuodot

- **`data/panel.db`** - SQLite-tietokanta. Varmuuskopioidaan päivittäin `VACUUM INTO` -komennolla
  `data/backups/_panel/`-kansioon (pidetään 14 uusinta); `PRAGMA integrity_check` suoritetaan
  käynnistyksen yhteydessä.
- **`data/.session-secret`** - automaattisesti generoitu evästeiden allekirjoitusavain, luodaan
  ensimmäisellä ajokerralla, jos `SESSION_SECRET` on asetettu. Sen poistaminen vaihtaa avaimen
  (mikä mitätöi istunnot).
- **`data/.secret-key`** - erillinen 32-tavuinen levyn salausavain (tila `0600`), luodaan automaattisesti
  ensimmäisellä ajokerralla. Riippumaton `SESSION_SECRET`:stä; sen poistaminen tekee jokaisesta
  tallentuneesta salasanasta purkamattoman, joten se kuuluu varmuuskopioihisi.
- **Blueprintit (`.mcserver.zip`)** - zip-tiedosto, jossa `manifest.json` kuvaa konfiguraatiota,
  resursseja, kiinnitettyä pakettiviittausta, overlay-manifestia (lähde-URL:t + sha256), valittuja
  konfiguraatiotiedostoja ja valinnaisesti maailman. Tuonti lataa uudelleen ja tarkistaa jokaisen modin
  tiivisteen ja määrittää uudet portit.
- **Paneelin luomat Docker-säiliöt** nimetään ja merkitään, jotta katselija löytää ne;
  paneeli omistaa niiden koko elinkaaren.

## Käynnistysjärjestys

1. `require('./instrument')` (Sentry-sauma) ennen kaikkea muuta, sitten `require('./preflight')`
   selkeän virheen saamiseksi tukemattomasta Node-versiosta.
2. Lataa konfiguraatio; varmista/generoi `.session-secret` **ja** `.secret-key`.
3. `ensureDataRoot()` - luo `./data`-rakenteen, tyhjentää `tmp/`.
4. Suorita tietokannan migraatiot, sitten `PRAGMA integrity_check` (kirjaa äänekkäästi, osoittaa
   `data/backups/_panel`-kansioon virheen sattuessa).
5. Salaa uudelleen kaikki vanhat `SESSION_SECRET`-avaimella salatut salaisuudet `.secret-key`-avaimella
   (`secretsMigration`).
6. Siemenöi aloitusblueprintit (suojattu).
7. Käynnistä HTTP + WS-palvelin. Paljastetussa sidoksessa, tulosta ensimmäisen ajon `/setup` PIN-koodi.
8. Asenna käynnistyksen jälkeinen suorituskyvyn valvonta (ottaa kiinni käsittelemättömät viat;
   `MSM_EXIT_ON_FATAL=1` tekee kovan poistumisen valvotuille käyttöönotoille).
9. Käynnistä taustapalvelut: WS-välittäjä, tallennusindeksoija, kaatumis- ja inventaarionvalvojat,
   aikatauluttaja, Discord-tapahtumasilta ja **päivittäinen huoltoajastin** (poistaa vanhat analytiikkarivit
   - varmuuskopioi `panel.db`).
10. Alusta Docker **taustalla**. Käyttöliittymä on täysin käytettävissä, vaikka daemon olisi alhaalla;
    Docker-ominaisuudet syttyvät, kun se tulee saavutettavaksi. Kun yhteys on muodostettu,
    `refreshStatuses({ boot })` sovittaa välimuistissa olevat tilat, lähettää kertaluonteisen
    `offline-after-restart`-tapahtuman palvelimelle, joka oli päällä ennen paneelin uudelleenkäynnistystä
    eikä sitä tuoda takaisin, ja käynnistyssilmukka käynnistää `auto_start`-palvelimet sekä palauttaa
    kaatuneina löydetyt `auto_restart`-palvelimet uloskirjautumisen aikana (ottaen huomioon kaatumis-silmukan
    peruutuksen).

> Instrumentointi ennen esitarkistusta on tarkoituksellinen kompromissi: se antaa tulevalle Sentry-johdotukselle
> mahdollisuuden korjata suorituskyky ensin, hinnalla hieman vähemmän ystävällinen viesti todella vanhalla Node-versiolla.

## Build-putki

`pnpm run build` = `build:css` (Tailwind → `public/css/app.css`) + `build:js` (esbuild →
`public/dist/js/`, ESM koodin jakamisella). `postinstall` suorittaa **vain CSS-buildin**.
`public/css/app.css` ja `public/dist/` ovat gitignoreen lisättyjä build-artefakteja; Dockerfile-build-vaihe
suorittaa täyden `pnpm run build` -komennon ja kopioi `public/`-kansion ajonaikaiseen kuvaan. Staattiset
resurssit tarjoillaan `immutable`/pitkällä välimuistilla sormenjälkitiedostoille, lyhyellä välimuistilla
CSS/JS-tiedostoille ja `no-cache`-asetuksella HTML:lle ja `/api`-osoitteelle.
