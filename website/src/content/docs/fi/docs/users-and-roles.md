---
title: 'Käyttäjät ja roolit'
description: 'Tilit, järjestelmänvalvojan, operaattorin ja katselijan roolit sekä palvelinkohtaiset käyttöoikeudet Minecraft Server Managerissa.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/users-and-roles.md'
---

[← Takaisin dokumenttien hakemistoon](/docs/)

Paneeli on monen käyttäjän järjestelmä. Hallitse tilejä kohdassa **Asetukset → Käyttäjät**.

![Käyttäjät](/docs/images/settings-users.png)

## Kolme roolia

| Rooli        | Oletusarvo jokaisella palvelimella                                                                                                                |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| **admin**    | Kaikki: käyttäjien, API-avainten, globaalien tiedostojen, edistyneiden Docker-ohitusten ja kaikkien palvelintoimintojen hallinta.                 |
| **operator** | Palvelinten suoritus ja määritys (käynnistys/pysäytys, konsoli, varmuuskopiot, maailmat, modit, useimmat asetukset), mutta ei admin-only-alueita. |
| **viewer**   | Vain luku -tila. Näkee palvelimet ja niiden tilan, mutta ei tee muutoksia.                                                                        |

Jokainen käyttäjä, mukaan lukien katselija, voi hallita omaa [kaksivaiheista tunnistautumistaan](/docs/two-factor-authentication/), koska oman kirjautumisen suojaaminen ei ole palvelimen hallintatoiminto.

Rooli on **oletusarvo** jokaiselle palvelimelle. Jos haluat antaa jollekin erilaiset oikeudet yhdellä palvelimella, käytä alla olevia palvelinkohtaisia käyttöoikeyksiä.

## Palvelinkohtaiset käyttöoikeudet

**Käyttöoikeudet**-sivu (sivupalkissa tai **Asetukset → Käyttäjät** -kohdan alla **Palvelimen käyttöoikeudet**) näyttää ruudukon: jokainen operaattori ja katselija sivun alareunassa, jokainen palvelin yläreunassa. Napsauta solua päättääksesi, mitä kyseinen käyttäjä voi tehdä kyseisellä palvelimella. Admineja ei ole lueteltu, koska heillä on aina kaikki.

![Käyttöoikeudet](/docs/images/settings-permissions.png)

Jokainen solu on joukko käyttöoikeuksia:

| Käyttöoikeus | Mitä se sallii kyseisellä palvelimella                                                                      |
| ------------ | ----------------------------------------------------------------------------------------------------------- |
| **View**     | Näe palvelin, sen tila, konsolin tuloste, pelaajat, historia ja tilastot.                                   |
| **Power**    | Käynnistä, pysäytä, käynnistä uudelleen, tapa ja rakenna palvelin uudelleen.                                |
| **Console**  | Suorita konsolikomentoja ja maailman pikatoimintoja, lähetä chat-viestejä ja hallitse chat-komentoja.       |
| **Players**  | Potki, estä, lisää sallittujen listalle, anna operaattorin oikeudet ja muokkaa pelaajien muistiinpanoja.    |
| **Content**  | Asenna ja poista modeja, lisäosia, paketteja, maailmoja, datapackeja ja muokkaa inventaarioita.             |
| **Backups**  | Luo, palauta, lataa ja poista varmuuskopioita.                                                              |
| **Files**    | Selaa, muokkaa, lataa ja lataa palvelintiedostoja, arkistoituja lokeja ja lokipaketteja; vie blueprintteja. |
| **Settings** | Muuta palvelimen asetuksia, ominaisuuksia, integraatioita, kuvaketta ja päivitä versioita.                  |
| **Delete**   | Poista palvelin.                                                                                            |

![Käyttöoikeuseditori](/docs/images/permissions-editor.png)

Ruudukon alla **Mitä kukin käyttöoikeus kattaa** avaa kunkin käyttöoikeuden siihen, mitä henkilö voi tehdä, mitä ei sisällytetä, ja tarkat paneelin reitit, jotka se avaa. Viimeinen luettelo tarkistetaan suoritettavaa koodia vastaan testisarjalla.

![Käyttöoikeusviite](/docs/images/permissions-reference.png)

Puhelimella ruudukko pinoutuu yhdeksi kortiksi käyttäjää kohden, ja rivi palvelinta kohden.

<p align="center">
  <img src="/docs/images/mobile/permissions.png" alt="Käyttöoikeudet puhelimessa" width="180">
</p>

Kuinka osat sopivat yhteen:

- **Rooli on oletusarvo.** Operaattori aloittaa kaikilla käyttöoikeuksilla kaikilla palvelimilla; katselija aloittaa vain katseluoikeudella. Solu himmeällä tekstillä (sen työkaluvihje sanoo "Roolin oletus") ei ole koskaan muutettu.
- **Solu ohittaa roolin vain kyseisellä palvelimella.** Anna katselijalle Power- ja Console-oikeudet yhdellä palvelimella, niin hän voi suorittaa sen, kun taas kaikki muut palvelimet pysyvät hänelle vain luku -tilassa. Poista Delete-oikeus operaattorilta pääpalvelimellasi, niin hänellä säilyy kaikki muut oikeudet siellä.
- **Jokainen käyttöoikeus sisältää View-oikeuden.** Et voi toimia palvelimella, jota et voi nähdä.
- **Kytke kaikki pois päältä piilottaaksesi palvelimen.** Se katoaa kyseisen käyttäjän sivupalkista, kojelaudasta, varmuuskopioista, aikatauluista, toiminnasta, päivityksistä, modipaketeista, live-tilasta, käynnissä olevista tehtävistä ja blueprintteista, ja maailmakirjasto lakkaa nimeämästä sitä. Suora linkki, API-kutsu tai konsoliyhteys vastaa "ei löydy", samoin kuin palvelin, jota ei ole olemassa.
- **Paneelin laajuiset toiminnot noudattavat edelleen roolia.** Palvelinten luominen (mukaan lukien yhden kloonaaminen), tallennustila, käyttäjät, API-avaimet, globaalit asetukset ja paneelin laajuiset aikataulut eivät ole palvelinkohtaisia, joten katselija, jolla on käyttöoikeudet joillakin palvelimilla, ei silti voi tehdä mitään niistä. Operaattoreilla säilyy palvelinten luominen ja paneelin laajuiset aikataulut; tallennustila, käyttäjät, API-avaimet ja globaalit asetukset ovat vain admineille.
- **Aikataulut noudattavat palvelinta.** Palvelimen aikataulutettu uudelleenkäynnistys, varmuuskopio tai komento vaatii vastaavan käyttöoikeuden siellä (Power, Backups tai Console), roolista riippumatta.
- **Blueprintit seuraavat myös palvelinta.** Palvelimen vieminen blueprinttina vaatii Files-oikeuden siellä, koska arkisto sisältää sen tiedostot. Blueprint, joka on viety palvelimelta, jota joku ei voi nähdä, on myös piilotettu häneltä.
- **Admin-only-alueet pysyvät admin-only-alueina** kaikilla palvelimilla: chatbot, varmuuskopioiden säilytys ja edistyneet Docker-ohitukset.

Jokainen muutos kirjoitetaan toimintalokiin, jossa kerrotaan kuka muutti mitä; nämä merkinnät näytetään vain admineille. Käyttäjän poistaminen poistaa hänen rivinsä. Palvelimen poistaminen säilyttää ne, joten käyttäjältä piilotettu palvelin pysyy piilotettuna historiassaan ja säilytetyissä varmuuskopioissa.

Olemassa olevat asennukset toimivat edelleen muuttumattomina: kunnes admin muokkaa solua, jokaisella käyttäjällä on täsmälleen se, mitä hänen roolinsa antoi hänelle aiemmin.

## Vain admineille ja miksi

Muutama asia on tarkoituksella rajoitettu admineille:

- **Käyttäjien hallinta, tallennustila, globaalit asetukset, API-avaimet ja globaalit tiedostot.**
- **[Julkinen API](/docs/public-api/)**: `/api/v1`-rajapinnan käyttöönotto ja sen vain luku -tyyppisten Bearer-tokenien luominen, rajaaminen tai peruuttaminen.
- **Edistyneet Docker-ohitukset**: mukautettu säiliön nimi, lisäporttien julkaisut ja bind mountit. Bind mount voi yhdistää minkä tahansa isäntäpolun säiliöön, ja yhdistettynä paneelin Docker-käyttöoikeuteen se on käytännössä root-käyttöoikeus isännällä. Nämä kentät näkyvät vain admineille.

Mukautetut säiliön nimet eivät myöskään voi sijaita paneelin omassa `msm-` nimiavaruudessa, joten käsin nimetty säiliö ei voi koskaan varjostaa toisen palvelimen säiliötä ja ohjata pysäytystä tai komentoa väärään instanssiin.

## Tilien hallinta

![Profiilikuva](/docs/images/profile-picture.png)

Admit voivat luoda käyttäjiä, muuttaa rooleja, nollata salasanoja ja poistaa tilejä Käyttäjät-taulukosta. **2FA**-sarake näyttää, onko kaksiulotteinen tunnistautuminen käytössä kunkin käyttäjän kohdalla; admin voi nollata toisen käyttäjän 2FA-tunnistautumisen **Nollaa 2FA** -toiminnolla kyseisen käyttäjän toimintovalikossa (kadonneen puhelimen ja varmuuskoodien tapauksessa), mutta ei koskaan poistaa omaansa käytöstä ilman salasanaansa, minkä itsepalveluvirta hoitaa sen sijaan.

Epäonnistuneet kirjautumiset rajoitetaan per tili (sekä per IP-osoite että tilikohtainen globaali laskuri) hidastamaan brute-force-yrityksiä, ja sama rajoitus kattaa myös 2FA-koodivaiheen, joten oikea salasana ei voi nollata laskuria ennen koodin arvaamista. Sen edessä on karkeampi per-asiakas-IP-pyyntörajoitin kirjautumis-, 2FA- ja asetus-päätepisteissä, säädettävissä `RATE_LIMIT_AUTH_PER_15MIN` -muuttujalla (oletus 100; käänteisen välityspalvelimen takana aseta `TRUST_PROXY`, jotta se perustuu todelliseen asiakkaan IP-osoitteeseen).
