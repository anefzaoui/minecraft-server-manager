---
title: 'Arkkitehtuuri'
description: 'Minecraft Server Manager on yhden prosessin, palvelimella renderöity Node.js-sovellus.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/architecture.md'
---

[← Takaisin dokumenttien hakemistoon](/docs/)

Minecraft Server Manager on yksiprosessinen, palvelinpuolella renderöity Node.js-sovellus. Se hallinnoi
Minecraft-palvelimia, jotka ajetaan Docker-säiliöissä käyttäen
[itzg/docker-minecraft-server](https://github.com/itzg/docker-minecraft-server) -kuvaa, ja kommunikoi
Docker-demonin kanssa sen API:n kautta (ei koskaan suorittamalla `docker` CLI:tä).

## Suorituskyky

- **Express + Handlebars** renderöivät sivut palvelinpuolella. Ei SPA:ta; `public/js/`-kansiossa oleva selain-JS
  on käsin kirjoitettua progressiivista parannusta. esbuild-vaihe (`pnpm run build:js`) niputtaa ja
  minifioi sen `public/dist/js/`-kansioon; sovellus tarjoilee tämän niputuksen, jos se on olemassa, ja raa'an
  lähteen muuten, joten kehitysversio ilman rakennusta toimii silti.
- **`node:sqlite`** (sisäänrakennettu Nodeen; paneeli vaatii Node ≥ 24) on tietokanta - synkroninen,
  ei natiivisia moduuleja, WAL-tila. Pieni versioitu migraatiotyökalu suorittaa `src/db/migrations/*`-tiedostot
  käynnistyksen yhteydessä. Valmistellut lausekkeet välimuistetaan `src/db/index.js`-tiedostossa SQL-tekstin perusteella.
- **`ws`** välittää reaaliaikaiset konsoli- ja tilastovirrat. Molemmat ovat **välitettyjä**: yksi ylävirran
  `docker logs --follow` (tai `docker stats`) per palvelin, demultipleksoituna kerran ja jaettuna jokaiseen
  yhteydessä olevaan välilehteen, sen sijaan että yksi ylävirta per katsoja. Konsolivälittäjä pitää pienen toisto-puskurin
  myöhässä liittyville välilehdille ja pudottaa tilaajan, jonka yhteys on liian kaukana jäljessä, sen sijaan että
  hidastaisi jaettua virtaa.
- **dockerode** on ainoa tapa, jolla sovellus puhuu Dockerille. Päätepiste tunnistetaan automaattisesti alustan mukaan
  (Windows named pipe vs. unix socket).
- **Kaikki pysyvä tila sijaitsee yhden kansion alla** (`$DATA_DIR`, oletus `./data`). Kopioimalla kyseisen
  kansion koko paneeli siirtyy.

## Kerrokset

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

- **`web/routes/`** - yksi reititin per domain (`players`, `worlds`, `crashes`, `blueprints`, `files`, …).
  `web/app.js` liittää ylätason reitittimet (`api.js`, sessio-JSON API, joka sisältää myös ydinpalvelimen reitit ja liittää palvelinkohtaiset domain-reitittimet; `index.js`, sivut; `auth`, `account`,
  `tasks`, …). Reitittimet validoivat zodilla, kutsuvat palvelua ja palauttavat JSON:ia
  tai renderöivät näkymän. Liiketoimintalogiikka ei kuulu tänne. Kaksi reititintä liitetään **julkiseen vyöhykkeeseen**, `requireAuth`:n eteen: `routes/status.js` (valinnainen palvelinkohtaiset HTML-tilastosivut) ja
  `routes/apiV1.js` (`/api/v1`, vain luku -käyttöinen JSON API, jonka todentaa ylläpitäjän myöntämä Bearer-token
  `services/apiTokens.js`:stä, pois päältä ellei asetuksissa ole käytössä; katso `docs/public-api.md`).
- **`services/`** - sovelluksen ydin. Jokainen palvelu omistaa yhden domainin ja voi riippua
  infrastruktuurista ja muista palveluista.
- **`docker/`** - dockerode-kääreet: `connect` (päätepisteen tunnistus + daemonin tila), `containers`
  (luonti/käynnistys/pysäytys/uudelleenluonti sidontakansioilla, muisti/CPU-rajat ja tunnisteet), `logs`, `stats`,
  `images`, `networks` (isäntäverkon löytäminen), `hostPath` (uudelleenjuurtaa sidontapolut `DATA_DIR_HOST`:n alle), ja `watcher`, joka muuttaa Docker-tapahtumat historiaksi + kaatumisen tunnistukseksi.
- **`db/`** - SQLite-kääre ja migraatiotyökalu.
- **`storage/`** - `./data`-kansion alustus, **polkusuojain** (`safeJoin`, tiedostoturvallisuuden selkäranka), ja taustalla oleva kokoindeksöinti + kiintiöiden valvonta.

Poikkileikkaavat:

- **`config/`** - ympäristökonfiguraatio sekä **kenttäluettelo**: totuuden ainoa lähde palvelinasetuksille. Jokainen itzg-ympäristömuuttuja on luetteloitu (otsikko, ohje, tyyppi, yksikkö, oletusarvo,
  validointi, osio, vaara-liput). Velho, asetuslomakkeet ja zod-validointi johdetaan kaikki siitä, joten uuden asetuksen paljastaminen on datamuutos, ei uutta käyttöliittymäputkea.
- **`events/`** - `recordEvent()` on ainoa syöte historiallokiin; elinkaaritapahtumat tallentavat myös säiliön lokin osia `data/logs/<id>/events/`-kansioon.
- **`ws/`** - todennetut konsoli- + tilasto-WebSocketit (sessiotunniste todennettu päivityksessä, `Origin` tarkistettu sivustojen välisen sieppauksen estämiseksi), välitetty per palvelin (katso "Suorituskyky").
- **`logger.js` + `instrument.js`** - `require('./logger')(label)` palauttaa moduulikohtaisen
  [Pino](https://getpino.io) -lokintatyökalun; taso `LOG_LEVEL`:stä, `makeFailureThrottle()` pitää jatkuvasti epäonnistuvan taustasilmukan yhtenä lokirivinä plus "palautettu" rivinä.
  `src/utils/logSanitize.js` poistaa salasanat ja webhook-tokenit strukturoidusta metadatasta; `src/config/logLevel.js` on jaettu tasojen sallittujen luettelo (pidetään erillään syklisen riippuvuuden välttämiseksi `config`:n kanssa). `src/instrument.js` on uinuva Sentry-sauma, ladattu ensin
  `src/server.js`:ssä. `src/web/middleware/requestLog.js` kirjoittaa yhden pääsylokin rivin per pyyntö
  (ohittaen `/healthz` ja staattiset resurssit). ESLint valvoo `no-console`-sääntöä `src/**`-kansiossa,
  `preflight.js`, `instrument.js` ja `config/index.js` ovat poikkeuksia (ne suoritetaan ennen lokintatyökalun olemassaoloa).
- **Nopeusrajoitus** - `src/web/middleware/rateLimit.js` asettaa `express-rate-limit`-työkalun `/api`-rajapinnan eteen
  (`RATE_LIMIT_API_PER_MIN`, oletus 1200) ja kirjautumis- / 2FA- / asennus-POST-pyynnöt
  (`RATE_LIMIT_AUTH_PER_15MIN`, oletus 100); `0` poistaa rajoittimen käytöstä. Se käyttää avaimena `req.ip`, joten
  `TRUST_PROXY` on tärkeä välityspalvelimen takana. `/api/v1`-rajapinnalla on omat rajoittimensa: asiakaskohtainen IP-raja
  (viisi kertaa tokenin budjetti) joka suoritetaan ennen tokenin todentamista, sitten tokenikohtainen budjetti (`RATE_LIMIT_PUBLIC_API_PER_MIN`, oletus 120) avaimena todennetun tokenin id:n perusteella. Erillinen asiakaskohtainen pehmeä laskuri
  `src/web/middleware/auth.js`:ssä käsittelee kirjautumislukituksen (per IP ja koko asiakastili, hajoava).
- **Valtuutus**: kaksi tasoa. Globaali rooli (`requireAuth` → `requireRole` / `requireWrite` `src/web/middleware/auth.js`:ssä) rajoittaa paneelinlaajuisia toimintoja ja on oletusarvo jokaisella palvelimella. Palvelinkohtaiset käyttöoikeudet (`src/services/permissions.js`, yhdeksän kykyä tallennettuna JSON-listana per
  `(käyttäjä, palvelin)` `user_server_permissions`-tauluun) tarkentavat tätä oletusarvoa yhdelle palvelimelle; jokainen
  `/api/servers/:id`-reitti, alireitittimen liitos, sivu, WebSocket ja laivastonlaajuinen listaus kulkee `src/web/middleware/serverAccess.js`:n läpi
  (`serverScope`, liitetty API:n ja sivureitittimen `/servers/:id`-etuliitteeseen, piilottaa palvelimen ilman `view`-oikeutta 404-virheenä; `requireCap(cap)` nimeää reitin tarvitseman kyvyn). Kirjoitukset, jotka nimeävät palvelimensa rungossa (aikataulut, maailman poiminta ja asennus, blueprint-vienti) avataan katsojille `requireWrite`:llä vain kyseiselle palvelimelle, ja jokainen tällainen reitti tarkistaa kyvyn itse. `test/permissions-routes.test.js` käy läpi live-reitittimien pinot ja epäonnistuu, jos palvelinkohtaisella kirjoitusreitillä, liitoksella tai sivulla ei ole porttia.

## Keskeiset domain-käyttäytymiset

- **Modpackit ovat aina kiinnitettyjä.** Kuva päivittää automaattisesti kiinnittämättömät paketit jokaisella uudelleenkäynnistyksellä, joten paneeli ratkaisee "uusimman" konkreettiseksi versiotunnisteeksi asennushetkellä ja kiinnittää sen. Päivitykset ovat eksplisiittinen orkestroitu virta (`updates/`): esikatselu → ennen päivitystä varmuuskopiointi → sulava pysäytys → uudelleenkiinnitys → uudelleenluonti → tilanvalvonta → yhden klikkauksen palautus.
- **Mukautettu mod-päällyste** on paneelin hallinnoima: käyttäjän lisäämät modit laskeutuvat deduplikoituun kirjastoon ja linkitetään kovasti palvelimeen, joten ne selviävät pakettipäivityksistä. Poistaminen on luokkatietoista. Koska kirjasto säilyttää jokaisen lataamansa rakennuksen, päivitys tallentaa korvatun rakennuksen
  (`server_content.previous_*`) ja sen voi palauttaa pelkästään paikallisista tiedostoista. Pakettimodin poistaminen kirjoittaa paketin poissulkemisympäristömuuttujan sen sijaan; `packs.applyPack` välittää sen ja loput paketin virityksestä (`PACK_TUNING_KEYS`) saman paketin versiopäivityksen yli ja pudottaa sen, kun paketti vaihtuu.
- **Minecraft-version päivitys on ansaittava.** `services/compat.js` skannaa palvelimen modit - ratkaistu paneelin asentamista riveistä, sitten CurseForge-paketin manifestista, sitten sisällön tiivisteen perusteella Modrinth/CurseForgeen - ja rakentaa (lataaja, Minecraft-versio) tukimatriisin per projekti CurseForgesta (`latestFilesIndexes` (200 projektia per pyyntö) ja Modrinthin projektikohtainen versioluettelo (yksi pyyntö per projekti, mikä pitää lataajan ja version parina). Päivitystarkastin tarjoaa vain uusimman version, jota JOKAINEN modi tukee, ja ei tarjoa mitään, kun vastausta ei voidä määrittää: ei skannausta, skannausta eri versiolle tai lataajalle, sellaista joka ei koskaan valmistunut, tai jar-tiedostoa, jota kumpikaan rekisteri ei tunnista. Skannaukset ovat vain manuaalisia, ja niiden edistyminen ja osittaiset tulokset sijaitsevat `version_compat`-tiedostossa (ei muistissa olevassa `services/tasks.js`:ssä), joten päivitys tai paneelin uudelleenkäynnistys jatkuu sen sijaan, että jäisi pyörivään kuvakkeeseen; `reconcileScans()` merkitsee skannaukset, jotka ovat orpoja sammutuksen vuoksi, seuraavalla käynnistyksellä.
- **Modilataajan versio on kiinnitys, kuten kaikki muukin.** `services/loaderPin.js` lukee asennetun rakennuksen kuvan omasta asennusmanifestista (`.forge-manifest.json` ja vastaavat) ja kirjoittaa kiinnityksen: lataajan itzg-muuttuja tavallisella palvelimella (`FORGE_VERSION`, …), tai
  `CF_MOD_LOADER_VERSION` Forge- tai Fabric CurseForge-paketissa, joka ohittaa paketin ilmoittaman version. Kuvan CurseForge-asentaja ohittaa tämän ohituksen NeoForgea varten, ja Modrinth- ja FTB-paketeilla ei ole sitä, joten niiden lataaja seuraa pakettia. `packs.applyPack` poistaa kaikki `CF_`-muuttujat paketin päivityksen tai palautuksen yhteydessä, mikä pudottaa ohituksen loput mukana. Tyypitetty rakennus tarkistetaan ensin rekisterin täydellistä luetteloa vastaan (`services/loaderVersions.js`; Forgen tiedot tulevat sen maven-metadatasta, joka ohittaa numerot; puuttuva tarkistetaan uudelleen kerran itse rekisteriä vastaan), sitten muutos on varmuuskopio → kiinnitys (ympäristön yli sellaisena kuin se on varmuuskopion jälkeen) → uudelleenrakennus.
- **Portit** allokoidaan perusjärjestelmästä (peli `PORT_GAME_START`:sta ylöspäin, RCON = peli +
  `PORT_RCON_OFFSET`, Bedrock `PORT_BEDROCK_START`:sta), tutkitaan saatavuutta ja varataan tietokannasta. "Varattu" on kaikkien palvelinten vaatimusten yhdistelmä (reaaliaikaiset portit, plus odottava pari alla),
  jokainen isäntäportti, jonka Docker-säiliö julkaisee (`containers.publishedHostPorts`: käynnissä olevien säiliöiden reaaliaikaiset sidokset plus jokaisen pysäytetyn säiliön määritellyt, koska paneelin oman säiliön sisäinen OS-sidontatutkimus näkee vain kyseisen säiliön verkkotilan), ja OS-tutkimus. Docker-osa välimuistetaan 3 sekunnin ajan ja rajataan: luettelo, joka ei vastaa 2,5 sekunnissa, pudottaa vain Docker-osan, ja hidas tarkastus maksaa vain kyseisen säiliön portit. Palvelimen luonnit ja
  `servers.changeGamePort` valitsevat portit yhden serialisointiketjun kautta, joka kattaa vain valinnan ja sen vaatimuksen (rivin kirjoitus luonnille, muistissa oleva varaus porttimuutokselle);
  BlueMapin porttivalitsin ja lisäporttiohjeet eivät ole siinä eivätkä
  konsultoi Dockeria. Porttimuutos olemassa olevassa palvelimessa (`servers.changeGamePort`, palvelimen op-lukon alla) toteutetaan kerralla, koska Docker korjaa porttisidokset säiliön luonnin yhteydessä:
  uusi pari (RCON aina peli + `PORT_RCON_OFFSET`) tarkistetaan ja varataan muistissa
  (`ports.reserve`, sekä vanha että uusi pari, joita kaikki muut valinnat kunnioittavat) porttilukon alla. Se evätään (409 `PENDING_CHANGES`), kun muut asetukset odottavat uudelleenrakennusta, joten se rakentaa uudelleen vain säiliön, joka on jo ajettu, uudessa portissa; ja ajettua palvelinta muutetaan vain, kun pyyntö sanoo `restart: true` (muuten 409 `NEEDS_CONFIRM`). Kuva vedetään ja mukautettu säiliön nimi tarkistetaan ennen kuin mitään kosketaan. Ajettu palvelin pysäytetään; sitten uusi pari kirjoitetaan `pending_recreate = 1` (joten paneelin kaatuminen sen jälkeen jättää rehellisen "uudelleenrakennus odottaa" -tilan), säiliö poistetaan, rakennetaan uudelleen uudessa parissa ja käynnistetään. Jos jokin vaihe pysäytyksen jälkeen epäonnistuu, `putBackOnOldPort` kirjoittaa vanhan parin takaisin, rakentaa uudelleen (ja käynnistää uudelleen, jos se oli ajossa) sen päälle ja tallentaa, mikä vaihe epäonnistui; historia ja hälytykset kertovat, jos edes se epäonnistui, mikä jättää palvelimen pysäytetyksi, kunnes joku käynnistää sen.
  `settings`-kyky riittää, ajettava palvelin mukaan lukien. Ei-ylläpitäjät voivat valita vain `PORT_GAME_START`:sta ylöspäin.
  (Siirtymän 029 `port_*_pending`-sarakkeet kuuluvat aiempaan, julkaisemattomaan suunnitelmaan ja ovat käyttämättömiä; 031 tyhjentää ne.) Lukituskollisiota vastaa 409, jossa on `code: 'BUSY'`, jota alla olevat uudelleenyrittävät kutsujat tarkistavat sanamuodon sijaan. Kaatumisen automaattinen uudelleenkäynnistys
  (`watcher.restartAfterCrash`) ja ajoitettu varmuuskopio tai käynnistys (`scheduler.runTaskWithRetry`),
  jotka löytävät palvelimen kiireisenä muun toiminnon kanssa, yrittävät uudelleen 20 s / 60 s välein enintään 30 minuutin ajan,
  ja paketin päivitys tai palautus yrittää uudelleen lukittuja vaiheitaan samalla tavalla (`opLock.retryWhileBusy`);
  kaatumisen uudelleenkäynnistys tai odottava ajoitettu käynnistys antaa periksi, kun joku on pysäyttänyt, tappanut tai käynnistänyt palvelimen sen jälkeen (`events.lifecycleActionSince`), ja kaatumisen uudelleenkäynnistys myös, kun automaattinen uudelleenkäynnistys on pois päältä tai palvelin on poissa. Ajoitetut uudelleenkäynnistykset, pysäytykset ja komennot eivät yritä uudelleen, ja ajoitus, jonka viimeisin suoritus on edelleen odottamassa, ohittaa seuraavan laukaisunsa.
- **Levykiintiöt** ovat paneelin valvonnassa, koska Docker ei voi rajoittaa sidontakansioiden käyttöä: indeksoija välimuistittaa hakemistokohtaiset koot ja levynkasvatusoperaatiot ovat niistä riippuvaisia.
- **Salaisuudet** (RCON-salasanat, API-avaimet, TOTP-salaisuudet, Discord-webhook-URL) salataan levossa AES-256-GCM:llä käyttäen erillistä satunnaista avainta osoitteessa `$DATA_DIR/.secret-key` (tila `0600`,
  automaattisesti generoitu). Se on riippumaton `SESSION_SECRET`:stä; `SESSION_SECRET`:stä johdettu avain säilytetään vain purkuun tarkoitettuna varana arvoille, jotka on kirjoitettu ennen erillisen avaimen olemassaoloa, ja
  `src/services/secretsMigration.js` salaa ne uudelleen erillisen avaimen alle kerran käynnistyksen yhteydessä.
  `.secret-key`-tiedosto, joka on olemassa mutta ei jäsenny, on vakava käynnistysvirhe (sitä ei koskaan regeneroida hiljaa
  päälle). Blueprintit poistavat kaikki salaisuudet viennin yhteydessä.
- **`server.properties` on paneelin omistama, mutta ympäristövarjostettu.** itzg-kuva vahvistaa jokaisen
  ympäristöön perustuvan ominaisuuden uudelleen jokaisella käynnistyksellä (`OVERRIDE_SERVER_PROPERTIES` oletusarvoisesti tosi), joten paneelin suoraan muokkaama arvo - World Controls PvP/vaikeustaso, whitelist-kytkin, Files-editori - palautuisi hiljaa seuraavalla käynnistyksellä, ellei vastaavaa ympäristömuuttujaa poisteta ja
  säiliötä luoda uudelleen. Jokainen suora ominaisuusarvon kirjoitus kulkee `writeServerProperties()` (koko tiedosto) tai `setServerProperty()` (yksi avain) läpi `src/services/servers.js`:ssä, jotka kirjoittavat tiedoston atomisesti uudelleen, poistavat ympäristömuuttujan jokaisen muuttuneen avaimen takaa (catalog-kenttien `prop:`-attribuutin kautta, jota testataan kuvan omia ominaisuusmäärityksiä vastaan) ja merkitsevät
  `pending_recreate`. Vaikeustaso kirjoitetaan tiedostoon ja lähetetään RCON:n kautta, koska erillinen palvelin soveltaa `difficulty`-ominaisuutta uudelleen jokaisella käynnistyksellä. Minecraft itse tallentaa `server.properties`-tiedoston uudelleen käynnistysaikaisista arvoistaan `whitelist on/off`-komennoilla, mikä peruuttaisi palvelimen ollessa käynnissä tehdyt muokkaukset, joten käynnissä olevan whitelist-kytkin ottaa tiedoston ensin kuvakaappauksen ja kirjoittaa sen takaisin muuttaen vain `white-list`-arvon. Ympäristö
  muuttujat pysyvät täysin konfiguroitavina luonnin yhteydessä (velho renderöi ne ja ne sovelletaan kerran); ne vain
  irrottavat kiinnityksen ensimmäisellä kerralla, kun paneeli muokkaa taustalla olevaa ominaisuutta. MOTD on sama sopimus: suora `motd`-tiedoston muokkaus poistaa sen, joten viimeisin kirjoitus voittaa.

## Tiedot ja siirtomuodot

- **`data/panel.db`** - SQLite-tietokanta. Varmuuskopioidaan päivittäin `VACUUM INTO` -komennolla
  `data/backups/_panel/`-kansioon (uusimmat 14 säilytetään); `PRAGMA integrity_check` suoritetaan käynnistyksen yhteydessä.
- **`data/.session-secret`** - automaattisesti generoitu evästeiden allekirjoitusavain, luodaan ensimmäisellä käynnistyksellä, jos
  `SESSION_SECRET` on asetettu. Sen poistaminen vaihtaa avaimen (mikä mitätöi sessiot).
- **`data/.secret-key`** - erillinen 32-tavuinen salauksen avain levossa (tila `0600`), luodaan automaattisesti ensimmäisellä käynnistyksellä. Riippumaton `SESSION_SECRET`:stä; sen poistaminen tekee jokaisesta tallennetusta tunnuksesta purkamattoman, joten se kuuluu varmuuskopioihisi.
- **Blueprintit (`.mcserver.zip`)** - zip-tiedosto, jossa on `manifest.json`, joka kuvaa konfiguraation, resurssit, kiinnitetyn paketin viittauksen, päällysteen manifestin (lähde-URL:t + sha256), valitut konfiguraatiotiedostot ja valinnaisesti maailman. Tuonti lataa ja tarkistaa jokaisen modin tiivisteen ja määrittää uudet portit.
- **Paneelin luomat Docker-säiliöt** on nimetty ja merkitty, jotta katselija löytää ne;
  paneeli omistaa niiden koko elinkaaren.

## Käynnistysjärjestys

1. `require('./instrument')` (Sentry-sauma) ennen kaikkea muuta, sitten `require('./preflight')`
   selkeän virheen ilmoittamiseksi tukemattomasta Node-versiosta.
2. Lataa konfiguraatio; varmista/generoi `.session-secret` **ja** `.secret-key`.
3. `ensureDataRoot()` - luo `./data`-rakenteen, tyhjentää `tmp/`.
4. Suorita tietokantamigraatiot, sitten `PRAGMA integrity_check` (kirjaa äänekkäästi, osoittaa `data/backups/_panel`-kansioon
   virheen sattuessa).
5. Salaa uudelleen kaikki vanhentuneet `SESSION_SECRET`-avaimella salatut salaisuudet `.secret-key`:n alle (`secretsMigration`).
6. Tuo API-avaimet ympäristöstä kerran (`apiKeys.importFromEnvOnce()`), kiinnitä kaikki palvelimet, jotka kantavat edelleen kiinnittämätöntä modpack-valitsinta (`packPins.pinUnpinnedServers()`), merkitse edellisessä prosessissa kesken jääneet versioyhteensopivuuden tarkistukset keskeytyneiksi
   (`compat.reconcileScans()`), sitten siemenna aloitusblueprintit (suojattu).
7. Käynnistä HTTP + WS-palvelin. Paljastetussa yhteydessä tulosta ensimmäisen käynnistyksen `/setup` PIN-koodi.
8. Asenna käynnistyksen jälkeinen suorituskykyvartija (sieppaa käsittelemättömät viat; `MSM_EXIT_ON_FATAL=1` tekee siitä kovan poistumisen valvotuille käyttöönotoille).
9. Käynnistä taustapalvelut: WS-välittäjä, tallennusindeksoija, kaatumis- + inventaariokatselijat, ajoitin,
   Discord-tapahtumasilta, chatbot-yhteydenottokatselija ja **päivittäinen ylläpitotimer** (poista vanhat
   analytiikkarivit, chatbot-transkriptiot, tapahtumahistoria (365 päivää) ja API-välimuistirivit, sitten varmuuskopioi
   `panel.db`).
10. Alusta Docker **taustalla**. Käyttöliittymä on täysin käytettävissä, vaikka daemon olisi alhaalla;
    Docker-ominaisuudet syttyvät, kun se tulee saavutettavaksi. Kun yhteys on muodostettu, `refreshStatuses({ boot })`
    sovittaa yhteen välimuistitetut tilat, lähettää kertaluonteisen `offline-after-restart`-tapahtuman palvelimelle, joka oli käynnissä ennen paneelin uudelleenkäynnistystä eikä sitä tuoda takaisin, ja käynnistyssilmukka käynnistää
    `auto_start`-palvelimet sekä palauttaa kaatuneina ulosvedon aikana löydetyt `auto_restart`-palvelimet
    (ottaen huomioon kaatumis-silmukan takaisinkytkennän).

> Instrumentointi ennen esivalmistelua on harkittu kompromissi: se antaa tulevan Sentry-johdotuksen
> korjata ajonaikaista ohjelmistoa ensin, hieman vähemmän ystävällisen viestin kustannuksella todella vanhalla Node-versiolla.

## Rakennusputki

`pnpm run build` = `build:css` (Tailwind → `public/css/app.css`) + `build:js` (esbuild →
`public/dist/js/`, ESM koodin jakamisella). `postinstall` suorittaa **vain CSS:n**. `public/css/app.css`
ja `public/dist/` ovat gitignore-listattuja rakennustuotteita; Dockerfile-rakennusvaihe suorittaa täyden
`pnpm run build` -komennon ja kopioi `public/`-kansion ajonaikaiseen kuvaan. Staattiset resurssit tarjoillaan
`immutable`/pitkällä välimuistilla sormenjälkitiedostoille, lyhyellä välimuistilla CSS/JS:lle ja `no-cache` HTML:lle ja
`/api`-rajapinnalle.
