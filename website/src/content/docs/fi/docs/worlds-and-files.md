---
title: 'Maailmat ja tiedostot'
description: 'Maailmat-sivu hallinnoi palvelimiesi maailmatietoja: vaihda aktiivista maailmaa, lataa maailma tai lataa se alas.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/worlds-and-files.md'
---

[← Takaisin dokumenttien hakemistoon](/docs/)

## Maailmat

**Maailmat**-sivu hallinnoi palvelimiesi maailmatietoja: vaihda aktiivista maailmaa, lataa maailma tai lataa se alas.

![Maailmat](/docs/images/worlds.png)

## Tiedostonhallinta

Palvelimen **Maailma**-osion alla oleva **Tiedostot**-välilehti on täydellinen selaimessa toimiva tiedostonhallinta kyseisen palvelimen datahakemistolle. Listaa, lue, muokkaa, luo, nimeä uudelleen, siirrä, kopioi, poista ja lataa tiedostoja: kaiken, mitä normaalisti tekisit SSH:n kautta, nyt selaimesta.

![Tiedostonhallinta](/docs/images/server-files.png)

Tekstitiedostot avautuvat editoriin, jonka kokoraja on 2 Mt; suuremmat tiedostot voi ladata. Lataukset hyväksyvät useita tiedostoja kerralla.

### Hiekkalaatikon sisällä pysyminen

Jokainen tiedosto-operaatio rajoittuu palvelimen omaan datahakemistoon. Paneeli ratkaisee jokaisen polun ja hylkää kaiken, mikä yrittäisi paeta: `..`-traversal, absoluuttiset polut ja jopa symboliset linkit, jotka osoittavat hakemiston ulkopuolelle (mukaan lukien roikkuvat linkit, joita ei vielä ole olemassa). Moduuli tai lisäosa ei voi istuttaa linkkiä huijatakseen tiedostonhallintaa lukemaan tai kirjoittamaan muualle isännöintipalvelimelle.

## Modit

Modatuille palvelimille **Modit**-välilehti (oma ryhmänsä palvelimen sivupalkissa) hallinnoi modien joukkoa: selaa ja lisää modeja sekä näe, mitä on asennettu. Modien ja pakettien päivitykset näkyvät [Päivitykset](/docs/updates/) -sivulla.

### Modien lisääminen

![Modit](/docs/images/mods.png)

Neljä tapaa, kaikki Modit-välilehden työkalupalkista:

- **Hae modeja** - hae **Modrinthista tai CurseForgesta** (CurseForge-siru ilmestyy, kun API-avain on tallennettu Asetukset → API-avaimet), ja lisäosapalvelimilla myös **Hangarista** (PaperMC:n oma lisäosarekisteri) ja **SpigotMC:stä** (Spigetin CDN-välityspalvelimen kautta) - molemmat ilman avainta. Kaikki suodatetaan palvelimen lataajaa ja Minecraft-versiota varten; Quilt-palvelimet näkevät automaattisesti myös fabric-tagatut rakennukset, koska Quilt ajaa Fabric-modeja. Tulokset, jotka ovat jo palvelimella, näyttävät **Asennettu**-merkin. Jos CurseForge-tekijä kieltää automaattiset lataukset - tai SpigotMC-resurssi on isännöity ulkoisesti - paneeli ilmoittaa siitä suoraan ja tarjoaa **Avaa sivu** + **Lataa jar** -polun epäonnistumisen sijaan asennuksen aikana.

  ![Hangar-haku](/docs/images/mods-search-hangar.png)

- **Tuo zip** - yksi painike, kolme muotoa, automaattisesti tunnistettu:
  - **Modrinth-modpack (`.mrpack`)**: jokainen kiinnitetty tiedosto normalisoidaan takaisin Modrinth-projektiinsa hajautushakuun (joten tuodut modit säilyttävät oikeat nimet, kuvakkeet ja pysyvät päivitettävinä; tiedostot, joita Modrinth ei tunnista, asennetaan paketin omasta URL-osoitteesta), varmistetaan paketin sha512-tarkistussummia ladattaessa ja esikatsellaan sopivuustuomioilla. Vain asiakaskäyttöön tarkoitetut tiedostot ohitetaan näkyvästi, ja molemmat ylikirjoituspuut (`overrides/`, sitten `server-overrides/` - palvelinkohtainen kopio voittaa) voidaan ottaa käyttöön.

    ![mrpack-tuonti](/docs/images/mrpack-import.png)

  - **CurseForge-modpack-vienti** (zip, jonka CurseForge-sovellus tuottaa, `manifest.json`-tiedostolla): jokainen kiinnitetty modi ratkaistaan massana, esikatsellaan varoituksilla (väärä lataaja/MC tälle palvelimelle, tiedostot eivät enää CurseForgessa, modit, jotka vaativat manuaalisen latauksen) ja asennetaan todellisella edistymisellä. Paketin `overrides/` (asetukset, skriptit) voidaan myös valinnaisesti ottaa käyttöön - kaikki tiedostot, jotka ylikirjoitettaisiin, varmuuskopioidaan ensin `.import-backups/<aikaleima>/` -kansioon palvelinkansion sisällä.
  - **Pelkkä zip-tiedosto jar-tiedostoista**, jotka olet itse kerännyt: jokainen jar-tiedosto tunnistetaan (Modrinth-hajautus täsmää → CurseForge-sormenjälki → itse jar-tiedoston metatiedot) ja arvioidaan palvelimen suhteen - _sopii / väärä lataaja / väärä MC-versio / jo asennettu / tunnistamaton_ - joten valitset, mikä todella kuuluu, ennen kuin mikään asennetaan.
- **Lisää linkillä** - liitä melkein mitä tahansa: Modrinth, CurseForge, Hangar tai SpigotMC -projektisivut, GitHub-repo tai julkaisun URL-osoite (pelkkä `omistaja/repo` toimii myös - GitHub-asennukset suosivat uusinta vakaata julkaisua ja ohittavat `-sources`/`-javadoc` sivupurkkien tiedostot), pelkkä Modrinth-slogani tai mikä tahansa suora `.jar`-URL. Paneeli ratkaisee oikean rakennuksen palvelimen lataajaa ja MC-versiota varten.

  ![Lisää linkillä](/docs/images/mods-add-by-link.png)

- **Lataa jar** (haun varajärjestelmästä tai odottavien latausten ratkaisijasta) - ladatut jar-tiedostot tunnistetaan samalla tavalla, joten ne säilyttävät oikean nimensä, versionsa, kuvakkeensa ja niistä tulee päivitettäviä.

Jokainen rekisteriasennus **tarkistetaan tarkistussummalla latauksen aikana**: virta tarkistetaan vahvimmalla tiivisteellä, jonka rekisteri julkaisee (sha512 → sha256 → sha1 → md5), ja ristiriita keskeyttää ennen kuin mikään laskeutuu palvelimelle.

Koko zip-tiedosto (`.mrpack` mukaan lukien) voi myös **luoda palvelimen**: ohjatun toiminnon _Modpackista_ -välilehdellä lataa se ja paketin manifesti (tai enemmistöääni tunnistettujen jar-tiedostojen kesken) täyttää lataajan, Minecraft-version ja lataajan rakennuksen.
