---
title: 'Blueprintit'
description: 'Blueprintit tallentavat Minecraft-palvelimen koko konfiguraation uudelleenkäytettäväksi reseptiksi uusien palvelimien luomiseen. Salaisuuksia ei koskaan sisällytetä.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/blueprints.md'
---

[← Takaisin dokumenttien hakemistoon](/docs/)

**Blueprint** tallentaa palvelimen koko konfiguraation (tyyppi, versio, resurssit, ympäristö, pack pin, mukautetut modit ja valinnaisesti sen konfiguraation ja maailman) yhteen siirrettävään `.mcserver.zip`-tiedostoon, josta voit luoda uusia palvelimia. Salaisuuksia (salasanat, tokenit ja avaimet ympäristössä) ei koskaan tallenneta blueprintiin.

![Blueprints](/docs/images/blueprints.png)

## Vienti

Palvelimen **Asetukset → Konfiguraatio** -välilehdeltä voit käyttää **Vie blueprintiksi** ja valita, mitä sisällyttää: aina palvelimen konfiguraatio, sen konfiguraatiokansiot (oletuksena päällä) ja valinnaisesti itse mukautetut moditiedostot (suurempi tiedosto, joka asentaa ilman lataamista) ja aktiivinen maailma. Tulos tallennetaan blueprint-kirjastoosi ja sen voi ladata jaettavaksi.

**Kloonaa palvelin** samassa kortissa tekee viennin ja tuonnin yhdessä vaiheessa kopioidakseen palvelimen, maailman kanssa tai ilman.

## Tuonti ja luonti blueprintista

Tuo blueprint-tiedosto (**Tuo blueprint** **Blueprintit**-sivulla) tai valitse jokin kirjastosta (**Luo palvelin** sen kortista tai ohjatun toiminnon **Blueprintista**-välilehdeltä) luodaksesi uuden palvelimen, joka on esikonfiguroitu täsmälleen kuten alkuperäinen. Uusi palvelin saa omat porttinsa ja uuden RCON-salasanan. Mukautetut modit, joita ei upotettu, ladataan uudelleen ja tarkistetaan blueprintin tallentamia tiivisteitä vastaan. Kirjastossa on myös kaksi aloitusblueprinttia, yksi Paperille ja yksi Fabricille.

Se on nopein tapa:

- Käynnistää identtisiä palvelimia (minipelipalvelinten verkosto, tuotannon staging-kopiot).
- Siirtää palvelin paneelien välillä.
- Säilyttää tunnetusti hyvä malli, johon voi aina palata.

Koska blueprint tallentaa tarkan [pack pinin](/docs/modpacks/), blueprintista luotu modpack-palvelin asentaa saman kiinnitetyn version ilman yllättäviä päivityksiä.
