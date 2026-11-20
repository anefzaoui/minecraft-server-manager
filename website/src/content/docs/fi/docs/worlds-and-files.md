---
title: 'Maailmat ja tiedostot'
description: 'Maailmakirjasto, maailmojen lataukset ja vaihdot, modien ja pluginien välilehti sekä selainpohjainen tiedostonhallinta.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/worlds-and-files.md'
---

[← Takaisin dokumenttien hakemistoon](/docs/)

## Maailmat

**Maailmat**-sivu on maailmakirjasto: kaikki tallennetut maailmat yhdessä paikassa. **Lataa maailma** ottaa `.zip`- tai `.tar`-arkiston ja etsii maailman siitä automaattisesti, **Tallenna kirjastoon** ottaa palvelimen reaaliaikaisesta maailmasta tilannekuvan (se toimii palvelimen ollessa käynnissä), ja jokainen kirjaston maailma voidaan ladata tai asentaa mihin tahansa palvelimeen **Asenna…**-toiminnolla. Asennus joko korvaa palvelimen maailman (palvelin on pysäytettävä, ja sen nykyinen maailma varmuuskopioidaan ensin) tai lisää sen rinnalle, aktivoitavaksi myöhemmin. Yhteensopivuustarkistus suoritetaan ennen jokaista asennusta.

Palvelimen oma **Maailma → Maailmat** -välilehti listaa kyseisen palvelimen maailmat. Sieltä voit aktivoida toisen maailman (palvelimen ollessa pysäytettynä), ladata, kopioida, nimetä uudelleen tai [kutistaa](/docs/world-shrink/) maailman, kopioida sen toiseen palvelimeen, poistaa passiivisen ja nollata aktiivisen maailman uudella, säilytetyllä tai mukautetulla siemenluvulla (turvavarmuuskopio tarjotaan ensin). Sama kirjasto sijaitsee alla, **Asenna tähän** -painikkeella.

![Maailmat](/docs/images/worlds.png)

## Tiedostonhallinta

Palvelimen **Maailma**-osion alla **Tiedostot**-välilehti on täydellinen selainpohjainen tiedostonhallinta kyseisen palvelimen datahakemistolle. Listaa, lue, muokkaa, nimeä uudelleen, siirrä, kopioi, poista ja lataa tiedostoja, luo kansioita ja etsi tekstitiedostojen sisältöä kansion alta **Etsi tiedostoista**: kaikki mitä normaalisti tekisit SSH:n kautta, selaimesta käsin.

![Tiedostonhallinta](/docs/images/server-files.png)

Tekstitiedostot avautuvat editorissa, jonka kokorajoitus on 8 Mt; suuremmat tiedostot voi ladata. Lataukset hyväksyvät jopa 20 tiedostoa kerrallaan.

### Pysyminen hiekkalaatikossa

Jokainen tiedosto-operaatio rajoittuu palvelimen omaan datahakemistoon. Paneeli ratkaisee jokaisen polun ja kieltäytyy kaikesta, mikä yrittäisi paeta: `..`-läpikäynti, absoluuttiset polut ja jopa symboliset linkit, jotka osoittavat hakemiston ulkopuolelle (mukaan lukien roikkuvat, jotka eivät vielä ole olemassa). Moduuli tai lisäosa ei voi istuttaa linkkiä huijatakseen tiedostonhallintaa lukemaan tai kirjoittamaan muualle isäntäkoneella.

## Modit

Modatuille ja lisäosapalvelimille **Modit**-välilehti (oma ryhmänsä palvelimen sivupalkissa) hallinnoi modipakettia: selaa ja lisää modeja, ja näe mitä on asennettu. Jokaiselta asennetun modin riviltä voit päivittää sen (tai jättää päivityksen huomiotta), [kumota](/docs/updates/#undoing-a-mod-update) sen, poistaa sen käytöstä tai poistaa sen, ja **Päivitä kaikki** -painike asentaa kaikki saatavilla olevat päivitykset yhdellä uudelleenkäynnistyksellä. Modien ja pakettien päivitykset näkyvät myös [Päivitykset](/docs/updates/) -sivulla.

### Modien lisääminen

![Modit](/docs/images/mods.png)

Neljä tapaa, kaikki Modit-välilehden työkalupalkista:

- **Hae modeja**: hae **Modrinth tai CurseForge** (CurseForge-siru ilmestyy, kun API-avain on tallennettu **Asetukset → API-avaimet** -kohtaan), ja lisäosapalvelimilla myös **Hangar** (PaperMC:n oma lisäosarekisteri) ja **SpigotMC** (Spigetin CDN-välityspalvelimen kautta), molemmat ilman avaimia. **Datapaketit**-välilehti hakee Modrinth-datapaketteja. Kaikki suodatetaan palvelimen lataajaa ja Minecraft-versiota varten (valintaruutu näyttää myös rakennukset, joita ei ole merkitty yhteensopiviksi, omalla vastuulla); Quilt-palvelimet näkevät automaattisesti myös fabric-merkityt rakennukset, koska Quilt ajaa Fabric-modeja. Tulokset, jotka ovat jo palvelimella, näyttävät **Asennettu**-merkin. Jos CurseForge-tekijä estää automaattiset lataukset (tai SpigotMC-resurssi on isännöity ulkopuolella), paneeli ilmoittaa siitä suoraan ja tarjoaa **Avaa CurseForge** (tai **Avaa SpigotMC**) + **Lataa Jar** -polun epäonnistumisen sijaan asennuksen keskellä.

  ![Hangar-haku](/docs/images/mods-search-hangar.png)

- **Tuo Zip**: yksi painike, kolme muotoa, automaattisesti tunnistettu:
  - **Modrinth-modipaketti (`.mrpack`)**: jokainen kiinnitetty tiedosto normalisoidaan takaisin Modrinth-projektiinsa hajautushakua käyttäen (joten tuodut modit säilyttävät oikeat nimet, kuvakkeet ja pysyvät päivitettävinä; tiedostot, joita Modrinth ei tunne, asennetaan paketin omasta URL-osoitteesta), varmistetaan paketin sha512-tarkistussummia ladattaessa ja esikatsellaan sopivuustuomioiden kanssa. Vain asiakaskäyttöön tarkoitetut tiedostot ohitetaan näkyvästi, ja molemmat päällekkäiset puut (`overrides/`, sitten `server-overrides/`; palvelinkohtainen kopio voittaa) voidaan ottaa käyttöön.

    ![mrpack-tuonti](/docs/images/mrpack-import.png)

  - **CurseForge-modipaketin vienti** (CurseForgen sovelluksen tuottama zip, jossa on `manifest.json`): jokainen kiinnitetty modi ratkaistaan massana, esikatsellaan varoituksilla (väärä lataaja/MC tälle palvelimelle, tiedostot eivät enää CurseForgessa, modit, jotka vaativat manuaalisen latauksen) ja asennetaan todellisella edistymisellä. Paketin `overrides/` (asetukset, skriptit) voidaan valinnaisesti ottaa käyttöön; kaikki tiedostot, jotka ylikirjoitettaisiin, varmuuskopioidaan ensin `.import-backups/<aikaleima>/` -kansioon palvelinkansion sisällä.
  - **Itse keräämiesi jar-tiedostojen tavallinen zip**: jokainen jar-tiedosto tunnistetaan (Modrinth-hajautus täsmää → CurseForge-sormenjälki → jar-tiedoston oma metatieto) ja arvioidaan palvelimen suhteen (_sopii / väärä lataaja / väärä MC-versio / jo asennettu / tunnistamaton_), joten valitset, mikä todella kuuluu, ennen kuin mitään asennetaan.
- **Lisää URL-osoitteella**: liitä melkein mitä tahansa: Modrinth, CurseForge, Hangar tai SpigotMC -projektisivut, GitHub-repo tai julkaisun URL (pelkkä `omistaja/repo` toimii myös; GitHub-asennukset suosivat uusinta vakaata julkaisua ja ohittavat `-sources`/`-javadoc` -sivupurkit), pelkkä Modrinth-tunniste tai mikä tahansa suora `.jar`-URL. Paneeli ratkaisee oikean rakennuksen palvelimen lataajaa ja MC-versiota varten.

  ![Lisää linkillä](/docs/images/mods-add-by-link.png)

- **Lataa Jar** (haun varajärjestelmästä tai odottavien latausten ratkaisijasta): ladatut jar-tiedostot tunnistetaan samalla tavalla, joten ne säilyttävät oikean nimensä, versionsa, kuvakkeensa ja niistä tulee päivitettäviä.

Jokainen rekisteriasennus **tarkistetaan tarkistussummalla latauksen aikana**: virta tarkistetaan vahvimmalla tiivisteellä, jonka rekisteri julkaisee (sha512 → sha256 → sha1 → md5), ja epäsuhta keskeyttää ennen kuin mikään laskeutuu palvelimelle.

Koko zip-tiedosto (`.mrpack` mukaan lukien) voi myös **luoda palvelimen**: ohjatun toiminnon **Modipaketista**-välilehdellä lataa se ja paketin manifesti (tai enemmistöääni tunnistettujen jar-tiedostojen kesken) täyttää lataajan, Minecraft-version ja lataajan rakennuksen.
