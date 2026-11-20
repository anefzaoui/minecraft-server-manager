---
title: 'Aikataulut'
description: 'Aikataulut-sivu automatisoi toistuvat tehtävät cron-lausekkeilla. Ei ulkoista cronia, ei skriptejä.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/schedules.md'
---

[← Takaisin dokumenttien luetteloon](/docs/)

**Aikataulut**-sivu automatisoi toistuvat tehtävät cron-lausekkeilla. Ei ulkoista cronia, ei skriptejä.

![Aikataulut](/docs/images/schedules.png)

## Mitä voit ajoittaa

- **Uudelleenkäynnistykset**: yöllinen uudelleenkäynnistys pitämään pitkään käynnissä olleen palvelimen terveenä.
- **Pysäytykset ja käynnistykset**: palvelimen alasajo yön yli ja sen palauttaminen aamulla.
- **Varmuuskopiot**: säännölliset tilannekuvat (merkitty `scheduled` [Varmuuskopiot](/docs/backups/) -sivulla). Varmuuskopiointiaikataulu voi myös pienentää maailmaa jokaisen varmuuskopion jälkeen ([maailman pienentäminen](/docs/world-shrink/)). Jokainen uusi palvelin saa päivittäisen varmuuskopiointiaikataulun automaattisesti.
- **Komennot**: suorita mikä tahansa palvelinkomento aikataulutetusti.
- **Päivitystarkistukset**: päivitä säännöllisesti vanhentuneet tiedot. Ajoitettu tarkistus myös ottaa käyttöön päivitykset palvelimille, jotka on asetettu [Automaattinen päivitys](/docs/modpacks/#update-policy) -asetukseen.

Jokainen aikataulu kohdistuu tiettyyn palvelimeen (tai paneeliin globaalisti), käyttää omaa cron-lausekettaan ja sen voi ottaa käyttöön tai poistaa käytöstä poistamatta sitä. Muokkausohjelma esikatseloo seuraavat suoritusajat kirjoittaessasi, cron-ajat noudattavat paneelin aikavyöhykettä (asetettu kohdassa **Asetukset**), ja taulukko näyttää kunkin aikataulun seuraavan suoritusajan. Jokainen suoritus tallennetaan historiatapahtumaksi, samoin kuin epäonnistunut suoritus.

Paneeli myös luo omat huoltoaikataulunsa ensimmäisellä käynnistyksellä, joita voit muuttaa tai poistaa käytöstä: päivittäinen päivitystarkistus, tallennustilan uudelleenskannaus kuuden tunnin välein, vanhojen väliaikaisten tiedostojen päivittäinen tyhjennys, bannin vanhenemisen tarkistus 15 minuutin välein (poistaa vanhentuneet väliaikaiset bannit) ja yöllinen sisällön metadatan täydennys (täyttää puuttuvat modien nimet ja kuvakkeet).

## Kun palvelin on kiireinen

Ajoitettu varmuuskopio tai käynnistys, joka löytää palvelimensa keskellä muuta toimintoa (palautus, varmuuskopioiden siivous, portin vaihto), odottaa ja yrittää uudelleen minuutin välein, kunnes kyseinen toiminto päättyy, enintään 30 minuutin ajan. Odottava käynnistys perutaan, jos joku käynnistää tai pysäyttää palvelimen sillä välin. Ajoitettua uudelleenkäynnistystä tai pysäytystä ei yritetä uudelleen: se ohitetaan ja suoritetaan seuraavana ajankohtanaan.
