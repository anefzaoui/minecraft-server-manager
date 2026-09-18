---
title: 'Blueprints'
description: 'Blueprint tallentaa palvelimen koko konfiguraation (tyyppi, versio, resurssit, ympäristö, pack pin ja valinnaisesti sen konfiguraation ja maailman) yhteen tiedostoon.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/blueprints.md'
---

[← Takaisin dokumenttien luetteloon](/docs/)

**Blueprint** tallentaa palvelimen koko konfiguraation (tyyppi, versio, resurssit, ympäristö, pack pin ja valinnaisesti sen konfiguraatio ja maailma) yhteen siirrettävään tiedostoon, josta voit luoda uusia palvelimia.

![Blueprints](/docs/images/blueprints.png)

## Vienti

Palvelimesta voit viedä blueprintin ja valita, mitä sisällyttää: konfiguraatio aina, ja valinnaisesti upotetut tiedostot ja maailma. Tulos tallennetaan blueprint-kirjastoosi ja sen voi ladata jaettavaksi.

## Tuonti ja luonti blueprintista

Tuo blueprint-tiedosto (tai valitse sellainen kirjastosta) luodaksesi uuden palvelimen, joka on konfiguroitu täsmälleen kuten alkuperäinen. Se on nopein tapa:

- Käynnistää identtisiä palvelimia (minipelipalvelinverkosto, tuotannon lavastuskopiot).
- Siirtää palvelin paneelien välillä.
- Säilyttää tunnetusti hyvä malli, johon voit aina palata.

Koska blueprint tallentaa tarkan [pack pinin](/docs/modpacks/), blueprintista luotu modpack-palvelin asentaa saman kiinnitetyn version ilman yllättäviä päivityksiä.
