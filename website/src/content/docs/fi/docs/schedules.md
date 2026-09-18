---
title: 'Aikataulut'
description: 'Aikataulut-sivu automatisoi toistuvat tehtävät cron-lausekkeilla.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/schedules.md'
---

[← Takaisin dokumenttien luetteloon](/docs/)

**Aikataulut**-sivu automatisoi toistuvia tehtäviä cron-lausekkeilla. Ei ulkoista cronia, ei skriptejä.

![Aikataulut](/docs/images/schedules.png)

## Mitä voit ajoittaa

- **Uudelleenkäynnistykset** – yöllinen uudelleenkäynnistys pitämään pitkään käynnissä olleen palvelimen terveenä.
- **Varmuuskopiot** – säännölliset tilannekuvat (merkitty `scheduled` [Varmuuskopiot](/docs/backups/) sivulla).
- **Komennot** – suorita mikä tahansa palvelinkomento aikataulun mukaisesti.
- **Päivitystarkistukset** – päivitä säännöllisesti vanhentuneet tiedot.

Jokainen aikataulu kohdistuu tiettyyn palvelimeen (tai paneeliin globaalisti), käyttää omaa cron-lausekettaan ja voidaan ottaa käyttöön tai poistaa käytöstä poistamatta sitä. Viimeisin suoritusaika näytetään, jotta voit varmistaa sen käynnistymisen.
