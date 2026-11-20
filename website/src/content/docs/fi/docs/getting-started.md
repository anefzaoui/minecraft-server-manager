---
title: 'Aloitus'
description: 'Asenna Minecraft Server Manager ja suorita ensimmäisen käynnistyksen asetukset: järjestelmän tarkistus, aikavyöhykkeesi ja pääkäyttäjätili.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/getting-started.md'
---

[← Takaisin dokumenttien hakemistoon](/docs/)

## Ensimmäisen käynnistyksen asetukset

Kun avaat paneelin ensimmäistä kertaa, lyhyt asennusohjattu toiminto opastaa sinua sen läpi:

1.  **Järjestelmän tarkistus** varmistaa, että Docker on käytettävissä, Node.js on riittävän uusi ja datakansio on kirjoitettavissa. Vaikka Docker ei olisi vielä käynnissä, voit jatkaa; palvelinten luominen ja käynnistäminen odottaa, kunnes se on.
2.  **Luo ylläpitäjätilisi**. Tämä on ainoa tili, joka on olemassa, kunnes lisäät muita, ja sillä on täysi hallinta. Valitse käyttäjänimi (2–32 merkkiä) ja vähintään 8 merkin salasana. Kirjaudut sisään heti sen luomisen jälkeen.
3.  **Paneelin määritys** (valinnainen): julkinen verkkotunnus, jota näytetään pelaajille yhteysosoitteissa, CurseForge API-avain ja aikavyöhykkeesi. Kaikki nämä voidaan muuttaa myöhemmin kohdassa **Asetukset**.

Viimeinen vaihe tarjoaa **Luo palvelin** tai **Siirry hallintapaneeliin**.

![Ensimmäisen käynnistyksen asetusten Järjestelmän tarkistus -vaihe](/docs/images/setup-system-check.png)

> **Julkisesti käytettävät asennukset ovat PIN-koodisuojattuja.** Jos käynnistät paneelin muusta kuin loopback-osoitteesta (`PANEL_HOST` muuna kuin `127.0.0.1`), asennussivu pyytää myös **6-numeroista PIN-koodia**. Paneeli tulostaa sen konsoliinsa käynnistyksen yhteydessä. Syötä se yhdessä käyttäjänimesi ja salasanasi kanssa. Tämä estää muukalaista, joka saavuttaa portin ensin, valtaamasta ylläpitäjätiliä. PIN-koodi katoaa, kun ylläpitäjätili on olemassa.

## Sisäänkirjautuminen

Asennuksen jälkeen paneeli on suojattu kirjautumisruudulla. Syötä käyttäjänimesi ja salasanasi jatkaaksesi.

![Kirjautuminen](/docs/images/login.png)

Jos tililläsi on käytössä [kaksivaiheinen tunnistautuminen](/docs/two-factor-authentication/), sinulta kysytään 6-numeroista koodia todennussovelluksestasi heti salasanasi jälkeen.

## Navigointi

Kaikki on järjestetty vasempaan sivupalkkiin:

- **Hallintapaneeli** – kaikki palvelimet yhdellä silmäyksellä ([tiedot](/docs/dashboard/)).
- **Palvelimet**, **Modpackit**, **Maailmat**, **Blueprintit** – palvelinten ja niiden sisällön luominen ja hallinta.
- **Päivitykset**, **Varmuuskopiot**, **Aikataulut**, **Tallennustila**, **Toiminta** – operatiivinen puoli: mikä on vanhentunutta, tilannekuvasi, automaatio, levyn käyttö ja auditointiloki.
- **Oikeudet** (alareunassa, vain ylläpitäjille): mitä kukin käyttäjä voi tehdä kullakin palvelimella ([tiedot](/docs/users-and-roles/#per-server-permissions)).
- **Asetukset** (alareunassa, vain ylläpitäjille): API-avaimet, paneelin määritys, oletusasetukset uusille palvelimille, [varmuuskopioiden säilytys](/docs/backups/#retention), käyttäjät, kirjautumisturvallisuus ja julkinen API.

Niiden alapuolella sivupalkki listaa palvelimesi. Yhden avaaminen näyttää sen omat välilehdet: **Yleiskatsaus**, **Konsoli**, **Pelaajat**, **Modit**, **Maailma**, **Varmuuskopiot**, **Valvonta** ja **Asetukset**, useimmissa niistä on liittyviä välilehtiä (esimerkiksi **Asetukset → Määritys** sisältää palvelimen asetukset ja sen pelikentän). Katso [Yksittäinen palvelin](/docs/servers/#a-single-server).

Yläpalkissa on **Luo palvelin** -painike, **teeman vaihto** (tumma/vaalea) ja **tilivalikko**, josta voit muuttaa profiilikuvasi, hallita [kaksivaiheista tunnistautumista](/docs/two-factor-authentication/) tai kirjautua ulos.

## Puhelimella tai tabletilla

Jokainen sivu on suunniteltu ensisijaisesti kapealle näytölle ja laajenee siitä eteenpäin: sivupalkki piiloutuu valikkopainikkeen taakse, datataulukot pinoutuvat korteiksi, työkalurivit kietoutuvat ja maailmanhallintakiskot romahtavat kortiksi, jonka avaat tarvittaessa. Painikkeilla ja siruilla on todellinen kosketusalueen koko. Mikään ei ole vain työpöytäkäyttöön.

<p align="center">
  <img src="/docs/images/mobile/dashboard.png" alt="Hallintapaneeli puhelimella" width="180">
  <img src="/docs/images/mobile/server-overview.png" alt="Palvelimen yleiskatsaus puhelimella" width="180">
  <img src="/docs/images/mobile/server-console.png" alt="Konsoli puhelimella" width="180">
  <img src="/docs/images/mobile/mods.png" alt="Modit-välilehti puhelimella" width="180">
  <img src="/docs/images/mobile/server-versions.png" alt="Versioyhteensopivuus puhelimella" width="180">
  <img src="/docs/images/mobile/settings.png" alt="Asetukset puhelimella" width="180">
</p>

## Mitä tarvitset

Paneeli kommunikoi Dockerin kanssa palvelinten suorittamiseksi, joten se tarvitsee pääsyn Docker-daemonin (Docker Desktop tai Docker Engine -socket) kautta. Kun Docker on käytettävissä, hallintapaneelin Docker-ruutu näyttää **Yhdistetty** ja sen version. Jos se ei ole, paneeli toimii silti. Et voi kuitenkaan käynnistää palvelimia ennen kuin daemon on käynnissä.

## Seuraavat vaiheet

- [Luo ensimmäinen palvelimesi →](/docs/servers/)
- [Suojaa tilisi 2FA:lla →](/docs/two-factor-authentication/)
