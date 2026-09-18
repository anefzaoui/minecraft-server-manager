---
title: 'Aloitus'
description: 'Kun avaat ohjauspaneelin ensimmäistä kertaa, se pyytää sinua luomaan pääkäyttäjätilin.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/getting-started.md'
---

[← Takaisin dokumenttien luetteloon](/docs/)

## Ensimmäisen käynnistyksen määritys

Kun avaat paneelin ensimmäistä kertaa, se pyytää sinua luomaan ylläpitäjätilin. Tämä on ainoa tili, joka on olemassa, kunnes lisäät muita, ja sillä on täysi hallinta.

Valitse käyttäjänimi ja vähintään 8 merkkiä pitkä salasana. Siinä kaikki: olet kirjautunut sisään ja sinut ohjataan suoraan kojelautaan.

> **Julkisesti käytettävissä olevat asennukset suojataan PIN-koodilla.** Jos käynnistät paneelin muuhun kuin loopback-osoitteeseen (`PANEL_HOST` on muu kuin `127.0.0.1`), määrityssivu pyytää myös **6-numeroista PIN-koodia**. Paneeli tulostaa sen konsoliinsa käynnistyksen yhteydessä. Syötä se käyttäjänimesi ja salasanasi lisäksi. Tämä estää muukalaista, joka saavuttaa portin ensin, valtaamasta ylläpitäjätiliä. PIN-koodi katoaa, kun ylläpitäjätili on luotu.

## Kirjautuminen sisään

Määrityksen jälkeen paneeli on suojattu kirjautumisruudulla. Jatkaaksesi syötä käyttäjänimesi ja salasanasi.

![Kirjautuminen sisään](/docs/images/login.png)

Jos tililläsi on käytössä [kaksivaiheinen tunnistautuminen](/docs/two-factor-authentication/), sinulta kysytään 6-numeroista koodia tunnistussovelluksestasi heti salasanasi jälkeen.

## Navigointi

Kaikki löytyy vasemmasta sivupalkista:

- **Kojelauta** - kaikki palvelimet yhdellä silmäyksellä ([tiedot](/docs/dashboard/)).
- **Palvelimet**, **Modpackit**, **Maailmat**, **Blueprintit** - palvelinten ja niiden sisällön luominen ja hallinta.
- **Päivitykset**, **Varmuuskopiot**, **Aikataulut**, **Tallennustila**, **Aktiviteetti** - operatiivinen puoli: mikä on vanhentunutta, tilannekuvasi, automaatio, levyn käyttö ja auditointiloki.
- **Asetukset** (alhaalla): käyttäjät, API-avaimet ja paneelin konfiguraatio.

Yläpalkissa on **Luo palvelin** -painike, **teeman vaihtaja** (tumma/vaalea) ja **tilivalikko**, josta voit hallita [kaksivaiheista tunnistautumista](/docs/two-factor-authentication/) tai kirjautua ulos.

## Puhelimella tai tabletilla

Jokainen sivu on suunniteltu ensisijaisesti kapealle näytölle ja laajenee siitä: sivupalkki piiloutuu valikkopainikkeen taakse, datataulukot pinoutuvat korteiksi, työkalurivit kietoutuvat ja maailmanhallintakiskot romahtavat kortiksi, jonka avaat tarvittaessa. Painikkeilla ja siruilla on todellinen kosketusalueen koko. Mikään ei ole vain työpöytäkäyttöön.

<p align="center">
  <img src="/docs/images/mobile/dashboard.png" alt="Kojelauta puhelimella" width="180">
  <img src="/docs/images/mobile/server-overview.png" alt="Palvelimen yleiskatsaus puhelimella" width="180">
  <img src="/docs/images/mobile/server-console.png" alt="Konsoli puhelimella" width="180">
  <img src="/docs/images/mobile/mods.png" alt="Modit-välilehti puhelimella" width="180">
  <img src="/docs/images/mobile/settings.png" alt="Asetukset puhelimella" width="180">
</p>

## Mitä tarvitset

Paneeli kommunikoi Dockerin kanssa palvelinten suorittamiseksi, joten se tarvitsee pääsyn Docker-daemonin (Docker Desktop tai Docker Engine -pistoke). Kun Docker on saavutettavissa, kojelaudan Docker-ruutu näyttää **Yhdistetty** ja sen version. Jos se ei ole, paneeli toimii silti. Et voi käynnistää palvelimia ennen kuin daemon on käynnissä.

## Seuraavat vaiheet

- [Luo ensimmäinen palvelimesi →](/docs/servers/)
- [Suojaa tilisi 2FA:lla →](/docs/two-factor-authentication/)
