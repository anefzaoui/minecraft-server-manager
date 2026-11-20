---
title: 'Modpackit'
description: 'Asenna CurseForge-, Modrinth-, FTB- ja GT New Horizons -modpackit palvelimiksi, aina kiinnitettynä tarkkaan pack-versioon.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/modpacks.md'
---

[← Takaisin dokumenttien luetteloon](/docs/)

**Modpackit**-sivu (ja [luontivelhon](/docs/servers/) **Modipaketista**-välilehti) asentaa modipakin palvelimena, aina **kiinnitettynä tarkkaan paketin versioon**, joten uudelleenkäynnistys ei voi koskaan hiljaa päivittää pakettia alta pois.

![Modpackit](/docs/images/modpacks.png)

## Tuetut alustat

- **CurseForge**: hae nimen perusteella. Vaatii CurseForge API-avaimen (lisää se kohdasta **Asetukset → API-avaimet**).
- **Modrinth**: hae nimen perusteella.
- **FTB**: Feed The Beast -paketit, vain API:n kautta (numeerinen paketin ID ja eksplisiittinen versio-ID). Paneeli ei vielä tarkista FTB-paketteja päivitysten varalta.
- **GT New Horizons**: 1.7.10-versio asiantuntijapaketti, asennetaan GTNH:n omasta julkaisuindeksistä. GTNH valitsee Java-ajoympäristönsä paketin version mukaan (2.8.0+ toimii **Java 25**:llä integroitujen lwjgl3ify-paikkausten kautta, vanhemmat julkaisut Java 21:llä tai 17:llä), ja velho nostaa palvelimen RAM-muistin ja levytilan järkeviin minimiarvoihin sitä varten.
- **Mukautettu zip**: ei julkaistu paketti lainkaan. Lataa **CurseForge modipakkivienti** (zip-tiedosto, jossa on `manifest.json`, jonka CurseForge-sovellus tuottaa käsin valitulle modikokonaisuudelle), **Modrinth `.mrpack`**, tai **mikä tahansa mod-jar-tiedostojen zip**. Paneeli ratkaisee manifestin massana (tai tunnistaa jokaisen jar-tiedoston hajautusarvon/sormenjäljen/metadatan perusteella), esikatselmoi sopivat ja asentaa kaiken yhdessä tehtävässä, mukaan lukien paketin `overrides/`-konfiguraatiot, jos valitset sen. Modit, joiden tekijät kieltävät automaattiset lataukset, listataan selainlinkin ja manuaalisen latauspaikan kanssa asennuksen epäonnistumisen sijaan.

## Kiinnityksen toiminta

Kun valitset paketin, paneeli ratkaisee tarkan version, tallentaa sen ja asentaa sen. **Päivitykset**-sivulla kerrotaan, kun uudempi versio on saatavilla (ellei palvelimen [päivityskäytäntö](#update-policy) ole **Vain manuaalinen**); päivitys on harkittu, suojattu toimenpide, johon sisältyy varmuuskopiointi ennen päivitystä ja palautus. Vakaaseen versioon sidottuja palvelimia ei koskaan tarjota beta-versioita. Palvelimen oma **Versiot**-välilehti vastaa kysymyksen toista puolta: mitkä tulevat Minecraft-versiot, joita sen todelliset modit voivat seurata ([päivitykset](/docs/updates/#minecraft-version-compatibility)).

Modilataajan versio tulee myös paketin mukana: palvelin asentaa paketin ilmoittaman Forge-, NeoForge- tai Fabric-koontiversion. Jos Forge- tai Fabric CurseForge -paketti ilmoittaa liian vanhan version omille modeilleen, **Versiot**-välilehti voi ohittaa sen, kunnes paketti korjataan; paketin päivitys poistaa ohituksen, koska uusi versio ilmoittaa oman versionsa ([modilataajan version vaihtaminen](/docs/updates/#changing-the-mod-loader-version)).

Hyvin vanhoilla paneeliversioilla (ennen 0.9.7) luodut palvelimet saattoivat jäädä _kiinnittämättömiksi_, mikä tarkoitti, että konttikuva asensi hiljaa uusimman paketin version joka käynnistyksellä. Paneeli korjaa nämä nyt käynnistyksen yhteydessä: se lukitsee jokaisen asennettuun versioon (luetaan paneelin omista tiedoista tai kuvan asennusmanifestista, ei koskaan tuoreesti ratkaistusta "uusimmasta") ja kirjaa tapahtuman. Jos se ei pysty tunnistamaan, mikä on asennettu, palvelimen Asetukset-sivu näyttää varoituksen **Valitse versio…** -painikkeella (CurseForge-, Modrinth- ja GTNH-paketit), joka avaa [versionvalitsimen](#changing-the-pack-version), ja kaikki yritykset tallentaa kiinnittämätön modipakkikonfiguraatio hylätään suoraan.

## Päivityskäytäntö

Jokaisella palvelimella on **Päivityskäytäntö**-kortti sen **Asetukset → Konfiguraatio** -välilehdellä, ja kaikki kolme vaihtoehtoa tarkoittavat sitä, mitä ne sanovat:

- **Vain manuaalinen** (oletus): mikään ei muutu itsestään, ja palvelin jätetään päivitysmerkin ja Päivitykset-sivun ulkopuolelle. "Jätä minut rauhaan" -tila: ihanteellinen käsin viritetylle tai tuodulle paketille, jota et koskaan halua kosketettavan. Se ei lukitse versiota: [**Vaihda versiota…**](#changing-the-pack-version) toimii jokaisen käytännön alla. Jos haluat saada ilmoituksen uusista versioista ja soveltaa niitä yhdellä napsautuksella, valitse **Ilmoita minulle**.
- **Ilmoita minulle**: päivittäinen tarkistus tuo saatavilla olevat päivitykset esiin merkkinä ja Päivitykset-sivulla; niiden soveltaminen on aina sinun napsautuksesi.
- **Automaattinen päivitys**: päivittäisen ajoitetun tarkistuksen jälkeen odottavat **paketin** päivitykset sovelletaan samalla suojatulla polulla kuin manuaalinen päivitys: varmuuskopiointi ennen päivitystä, tilan seuranta ja automaattinen palautus, jos uusi versio ei käynnisty. Päivitykset, jotka siirtäisivät palvelimen eri Minecraft-versioon, ohitetaan aina tapahtumalla sen sijaan: maailman muuntaminen pysyvästi on päätös, jota paneeli kieltäytyy tekemästä puolestasi. Manuaaliset **Tarkista nyt** -painikkeet tarkistavat vain; ne eivät koskaan käynnistä automaattisia päivityksiä.

## Paketin päivittäminen

Kiinnitetystä palvelimesta voit päivittää uudempaan versioon yhdellä toiminnolla. Paneeli ottaa ensin varmuuskopion, vaihtaa kiinnitetyn version, rakentaa palvelimen uudelleen (ratkaisee Javan uudelleen, jos uusi versio tarvitsee eri ajoympäristöä) ja seuraa ensimmäistä käynnistystä, jolla on runsaasti aikaa suurille paketeille, kuten GTNH, jotka lataavat pari gigatavua ja rakentavat usean sadan modin maailman ensimmäisellä käynnistyksellä.

## Paketin version vaihtaminen

Suorittaaksesi tietyn version, uudemman tai vanhemman, käytä **Vaihda versiota…** -painiketta palvelimen **Yleiskatsaus**-välilehden pakettikortissa. **Modipaketit**-sivulla avatun asennetun paketin kortti antaa saman valinnan: valitse versio pudotusvalikosta ja napsauta **Vaihda tähän versioon**. Molemmat vaativat palvelimen **Sisältö**-oikeuden, ja molemmat ovat saatavilla CurseForge-, Modrinth- ja GTNH-paketeille (FTB-paketeilla ei ole vielä versioluetteloa). Luettelo näyttää 25 uusinta versiota CurseForgelle ja Modrinthille, ja jokaisen GTNH-julkaisun.

Vaihto käy läpi saman suojatun polun kuin päivitys: varmuuskopiointi ennen päivitystä, uusi kiinnitys, uudelleenrakennus ja valvottu ensimmäinen käynnistys, yhdellä napsautuksella palautus, jos palvelin ei käynnisty terveeksi. Mukautetut modisi siirtyvät mukana, samoin kuin paketin modit, jotka olet poistanut käytöstä, sekä paketin muut asetusasetukset (pakotetut modit, jätettävät tiedostot, lisäprojektit). Eri paketin asentaminen aloittaa nämä asetukset uudelleen, koska ne ovat järkeviä vain paketille, jolle ne luotiin.

Jokainen versio listataan Minecraft-version mukaan, jolla se toimii, verrattuna versioon, jolla maailmasi viimeksi tallennettiin:

- **Sama Minecraft-versio**: vaihda normaalin vahvistuksen jälkeen. Vanhempaan paketin versioon palaaminen voi pudottaa lohkoja ja kohteita modeista, joita kyseisessä versiossa ei ole, joten varmuuskopio säilyy Varmuuskopiot-välilehdellä joka tapauksessa.
- **Uudempi Minecraft-versio**: sallittu vahvistuksen jälkeen, joka varoittaa, että maailma on muunnettu pysyvästi. Ennen otettu varmuuskopio on ainoa tapa palata vanhaan maailmaan.
- **Vanhempi Minecraft-versio**: ei saatavilla. Minecraft ei voi ladata maailmaa vanhemmalla versiolla kuin mitä se viimeksi tallensi, joten paneeli kieltäytyy sen sijaan, että jättäisi palvelimen, joka kaatuu käynnistyksessä.
