---
title: 'Modpackit'
description: 'Modpackit-sivu (ja luontivelhon "Modpackista"-välilehti) asentaa modpackin palvelimena, aina kiinnitettynä tarkkaan pack-versioon, jotta uudelleenkäynnistys voi'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/modpacks.md'
---

[← Takaisin dokumenttien luetteloon](/docs/)

**Modpackit**-sivu (ja [luontivelhon](/docs/servers/) **Modipaketista**-välilehti) asentaa modipakin palvelimelle, aina **kiinnitettynä tarkkaan paketin versioon**, joten uudelleenkäynnistys ei voi koskaan hiljaa päivittää pakettia alta pois.

![Modpackit](/docs/images/modpacks.png)

## Tuetut alustat

- **CurseForge** - hae tai liitä paketin URL. Vaatii CurseForge API-avaimen hakua ja yksityisiä paketteja varten (lisää se kohdassa Asetukset → API-avaimet).
- **Modrinth** - hae nimen perusteella.
- **FTB** - Feed The Beast -paketit.
- **GT New Horizons** - 1.7.10 asiantuntijapaketti, asennettu GTNH:n omasta julkaisuindeksistä. GTNH valitsee Java-ajoympäristönsä paketin version mukaan (2.8.0+ toimii **Java 25**:llä integroitujen lwjgl3ify-korjausten kautta, vanhemmat julkaisut Java 21:llä tai 17:llä), ja velho nostaa palvelimen RAM-muistin ja levytilan järkeviin minimiarvoihin sitä varten.
- **Mukautettu zip** - ei julkaistu paketti lainkaan: lataa **CurseForge-modipakkivienti** (zip-tiedosto, jossa on `manifest.json`, jonka CurseForgesta sovellus tuottaa käsin valitulle modijoukolle) tai **mikä tahansa mod-jar-tiedostojen zip**. Paneeli ratkaisee manifestin massana CurseForge API:n kautta (tai tunnistaa jokaisen jar-tiedoston hajautusarvon/sormenjäljen/metadatan perusteella), esikatselle mitä sopii ja asentaa kaiken yhtenä tehtävänä - mukaan lukien paketin `overrides/`-konfiguraatiot, jos valitset sen. Modit, joiden tekijät kieltävät automaattiset lataukset, listataan selainlinkin ja manuaalisen latauspaikan kanssa sen sijaan, että asennus epäonnistuisi.

## Kiinnitys toimii

Kun valitset paketin, paneeli ratkaisee tarkan version, tallentaa sen ja asentaa sen. **Päivitykset**-sivulla kerrotaan, kun uudempi versio on saatavilla; päivittäminen on harkittu, suojattu toimenpide, johon sisältyy varmuuskopiointi ennen päivitystä ja palautus. Vakaaseen versioon sidotuille palvelimille ei koskaan tarjota beta-versiota.

Hyvin vanhoilla paneeliversioilla (ennen 0.9.7) luodut palvelimet saattoivat jäädä _kiinnittämättömiksi_, mikä tarkoitti, että konttikuva asensi hiljaa uusimman paketin version jokaisella käynnistyksellä. Paneeli korjaa nämä nyt käynnistyksen yhteydessä: se lukitsee jokaisen niistä asennettuun versioon (luettuna paneelin omista tiedoista tai kuvan asennusmanifestista, ei koskaan vasta ratkaistusta "uusimmasta") ja kirjaa tapahtuman. Jos se ei pysty tunnistamaan, mikä on asennettu, palvelimen Asetukset-sivulla näkyy varoitus, jossa pyydetään valitsemaan versio manuaalisesti, ja kaikki yritykset tallentaa kiinnittämätön modipakkikonfiguraatio hylätään suoraan.

## Päivityskäytäntö

Jokaisella palvelimella on päivityskäytäntö kohdassa **Asetukset**, ja kaikki kolme vaihtoehtoa tarkoittavat juuri sitä, mitä ne sanovat:

- **Vain manuaalinen** - mikään ei muutu itsestään, ja palvelin jätetään päivitysmerkin ja Päivitykset-sivun ulkopuolelle. "Jätä minut rauhaan" -tila: ihanteellinen käsin viritetylle tai tuodulle paketille, jota et koskaan halua kosketettavan.
- **Ilmoita minulle** (oletus) - päivittäinen tarkistus tuo saatavilla olevat päivitykset esiin merkkinä ja Päivitykset-sivulla; niiden käyttöönotto on aina sinun klikkauksesi.
- **Automaattinen päivitys** - päivittäisen ajoitetun tarkistuksen jälkeen odottavat **paketin** päivitykset otetaan käyttöön samalla suojatulla polulla kuin manuaalinen päivitys: varmuuskopiointi ennen päivitystä, tilan seuranta ja automaattinen palautus, jos uusi versio ei käynnisty. Päivitykset, jotka siirtäisivät palvelimen eri Minecraft-versioon, ohitetaan aina tapahtumalla sen sijaan - maailman muuntaminen pysyvästi on päätös, jota paneeli kieltäytyy tekemästä puolestasi. Manuaaliset "tarkista nyt" -painikkeet vain tarkistavat; ne eivät koskaan käynnistä automaattisia päivityksiä.

## Paketin päivittäminen

Kiinnitetystä palvelimesta voit päivittää uudempaan versioon yhdellä toiminnolla. Paneeli ottaa ensin varmuuskopion, vaihtaa kiinnitetyn version, luo kontin uudelleen (ratkaisee Javan uudelleen, jos uusi versio vaatii eri ajoympäristön) ja seuraa ensimmäistä käynnistystä, antaen runsaasti aikaa suurille paketeille, kuten GTNH:lle, jotka lataavat pari gigatavua ja rakentavat usean sadan modin maailman ensimmäisellä käynnistyksellä.
