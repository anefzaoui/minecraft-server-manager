---
title: 'Palvelinten luominen ja hallinta'
description: 'Napsauta Luo palvelin (yläpalkki) tai Luo palvelin -korttia avataksesi ohjatun toiminnon.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/servers.md'
---

[← Takaisin dokumenttien hakemistoon](/docs/)

## Palvelimen luominen

Avaa ohjattu toiminto napsauttamalla **Luo palvelin** (yläpalkki) tai **Luo palvelin** -korttia.

![Luo palvelin](/docs/images/create-wizard.png)

Ohjattu toiminto esitäyttää muisti-, suoritin- ja levytilakentät **Uusien palvelinten oletusarvot** -kohdasta Asetukset-sivulla, jota ylläpitäjä voi muuttaa milloin tahansa.

![Uusien palvelinten oletusarvot](/docs/images/settings-defaults.png)

Valitset:

- **Nimen** (ja valinnaisen kuvakkeen, tehostevärin ja tunnisteet laivastosi järjestämiseen).
- **Palvelintyypin** - vanilla, Paper, Fabric, Forge, NeoForge ja muita, joista jokainen vastaa taustalla oikeaa itzg-kuvaa.
- **Minecraft-version** - `LATEST`, snapshot tai tietty versio.
- **Resurssit** - RAM (heap), säiliön muistiraja, suoritin ja levytila.

Haluatko modpackin? **Modpackista**-välilehti asentaa sen sijaan CurseForge-, Modrinth-, FTB- tai GT New Horizons -paketin (katso [Modpackit](/docs/modpacks/)) tai ottaa vastaan **mukautetun lataamasi zip-tiedoston**: CurseForge-modpack-viennin (`manifest.json`) tai minkä tahansa mod-jar-tiedostojen zip-tiedoston. Manifesti (tai enemmistöpäätös tunnistetuista jar-tiedostoista) täyttää lataajan ja Minecraft-version, ja jokainen modi asennetaan yhdessä tehtävässä. Voit myös aloittaa tallennetusta [Blueprintista](/docs/blueprints/).

Paneeli valitsee automaattisesti järkevän Java-ajoympäristön versiollesi, lataa kuvan, luo säiliön ja (valinnaisesti) käynnistää sen, kaikki yhdestä lomakkeesta.

## Palvelinluettelo

**Palvelimet**-sivu listaa koko laivastosi tilan ja nopeiden tilastojen kera.

![Palvelinluettelo](/docs/images/servers-list.png)

## Yksittäinen palvelin

![Pelaajat](/docs/images/players.png)

Palvelimen avaaminen antaa sinulle välilehdellisen työtilan:

- **Yleiskatsaus** - tila, reaaliaikaiset tilastot, käyttöaika ja ensisijaiset käynnistys / pysäytys / uudelleenkäynnistysohjaimet.
- **Konsoli** - reaaliaikainen lokivirta ja komentosyöte sekä pelin sisäinen chat ([tiedot](/docs/console-and-chat/)).
- **Pelaajat** - kuka on online-tilassa, sekä inventaario, tilastot ja [chat-komennot](/docs/console-and-chat/).
- **Modit** - asennettu modilista, [modiselain](/docs/modpacks/) ja sisältöpäivitykset.
- **Maailma** - [maailmat, reaaliaikainen kartta ja tiedostonhallinta](/docs/worlds-and-files/).
- **Varmuuskopiot** - [tilannekuvat ja palautus](/docs/backups/) tälle palvelimelle.
- **Valvonta** - palvelinkohtainen historia ja reaaliaikaiset mittarit, mukaan lukien kaatumisraportit (katso alla).
- **Asetukset** - kaikki palvelimen toimintaan liittyvä, sekä [integraatiot](/docs/integrations/) (Discord, tilasivu, kutsut, chatbot).

![Palvelimen yleiskatsaus](/docs/images/server-overview.png)

**Maailmanohjaimet**-kisko kulkee mukana jokaisella välilehdellä: pelin sisäinen kello, sää, yleiset pelisäännöt kytkinpihdeinä ja "Näytä kaikki maailman säännöt" loput.

![Maailmanohjaimet](/docs/images/world-controls.png)

**Valvonta → Reaaliaikainen** näyttää TPS:n ja millisekunnit per tikki, terveys- ja vakauskortin viimeisen 24 tunnin / 7 päivän kaatumisista ja uudelleenkäynnistyksistä sekä maailmakohtaiset koot.

![Reaaliaikainen valvonta](/docs/images/monitoring-live.png)

## Palvelimen asetukset

**Asetukset**-välilehti on täydellinen konfigurointipinta: uudelleennimeäminen, resurssit, päivityskäytäntö, automaattinen käynnistys / automaattinen uudelleenkäynnistys, ympäristömuuttujat ja edistyneet Docker-ohitukset. Kentät, jotka muuttavat säiliön toimintaa, on selvästi merkitty vaativan uudelleenkäynnistyksen.

![Palvelimen asetukset](/docs/images/server-settings.png)

**Muistimittarista.** "RAM (Java heap)" annetaan Javalle sekä sen aloitus- että enimmäismuistina, ja Java täyttää etukäteen annetun muistin ensimmäisen minuutin aikana, Aikar / MeowIce -lippujen esiasetuksilla tai ilman. Joten muistimittari asettuu noin muistin kokoon ja pysyy siellä, vaikka kukaan ei pelaisikaan; mittarin merkki osoittaa, missä muisti sijaitsee säiliön rajan alla, ja sen alla oleva huomautus kertoo sen. Jos haluat muistin seuraavan todellista käyttöä, aseta pienempi **Alkuperäinen muisti** (edistynyt): 2 Gt muistilla, joka toi idlen käytön 2,6 Gt:sta noin 1,3 Gt:iin mittauksissamme. Java tarvitsee myös muistia pinon ulkopuolella (noin 0,5 Gt vanillassa, 1,5–2 Gt suuressa modpackissa), johon säiliön rajan liikkumavara on tarkoitettu. Katso README:n "Kaksi muistirajaa" numeroita varten.

> Edistyneet Docker-ohituskentät (mukautettu säiliön nimi, ylimääräinen portti ja sidontamontit sekä raa'at ohitukset) ovat **vain ylläpitäjille**, koska sidontamontti ja paneelin Docker-käyttöoikeus ovat tehokkaasti root isännällä. Katso [Käyttäjät ja roolit](/docs/users-and-roles/).

## Kaatumisraportit ja mclo.gs-analyysi

Kaatumisraportit (`crash-reports/*.txt` ja JVM `hs_err_pid*.log` -tiedostot) kerätään automaattisesti, jäsennetään yhden rivin yhteenvetoon poikkeuksesta ja epäillyistä modeista, ja listataan kohdassa **Valvonta → Historia**:

![Kaatumisraporttikortti](/docs/images/crash-mclogs-card.png)

Jokainen raporttikortti tarjoaa sisäänrakennetun katseluohjelman (sisäänvedettävillä osioilla ja korostetuilla poikkeuksilla), pinon jäljennöksen kopioinnin ja latauksen, sekä kaksi [mclo.gs](https://mclo.gs) -toimintoa:

- **Jaa mclo.gs:ään** julkaisee raportin julkisena liitteenä ja kopioi linkin - täsmälleen sen, mitä modien tekijät ja tukichatit pyytävät. Linkki muistetaan raportissa, joten mitään ei koskaan ladata kahdesti.
- **Analysoi** suorittaa mclo.gs:n automatisoidut oivallukset liitteen yli: tunnetut ongelmat ehdotetuilla korjauksilla (puuttuvat riippuvuudet, versioristiriidat, yleiset modikonfliktit), jotka näytetään suoraan paneelissa.

![mclo.gs oivallukset](/docs/images/crash-insights.png)

Molemmat toiminnot ovat eksplisiittisen vahvistuksen takana, koska liite on julkinen: kaatumisraportit voivat sisältää pelaajien nimiä ja koko modilistasi. Paneeli ei koskaan lataa mitään itsestään.
