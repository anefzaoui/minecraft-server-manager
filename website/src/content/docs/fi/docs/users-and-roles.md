---
title: 'Käyttäjät ja roolit'
description: 'Paneeli on monen käyttäjän käytettävissä.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/users-and-roles.md'
---

[← Takaisin dokumenttien hakemistoon](/docs/)

Paneeli on monen käyttäjän käytettävissä. Hallitse tilejä kohdassa **Asetukset → Käyttäjät**.

![Käyttäjät](/docs/images/settings-users.png)

## Kolme roolia

| Rooli        | Voi tehdä                                                                                                                                         |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| **admin**    | Kaiken: käyttäjien, API-avainten, globaalien tiedostojen, edistyneiden Docker-ohitusten ja kaikkien palvelintoimintojen hallinta.                 |
| **operator** | Palvelinten suoritus ja määritys (käynnistys/pysäytys, konsoli, varmuuskopiot, maailmat, modit, useimmat asetukset), mutta ei admin-vain alueita. |
| **viewer**   | Vain lukuoikeus. Näkee palvelimet ja niiden tilan, mutta ei tee muutoksia.                                                                        |

Jokainen käyttäjä, myös katselija, voi hallita omaa [kaksivaiheista tunnistautumistaan](/docs/two-factor-authentication/), koska oman kirjautumisen suojaaminen ei ole palvelinhallintatoiminto.

## Vain adminille, ja miksi

Muutamia asioita on tarkoituksella rajoitettu adminille:

- **Käyttäjien hallinta, API-avaimet ja globaalit tiedostot.**
- **[Julkinen API](/docs/public-api/)** - `/api/v1`:n käyttöönotto ja sen vain luku -oikeuksilla varustettujen Bearer-tokenien luominen, rajaaminen tai peruuttaminen.
- **Edistyneet Docker-ohitukset** - mukautettu säiliön nimi, lisäporttien julkaisut ja sidontaliitokset. Sidontaliitos voi yhdistää minkä tahansa isäntäpolun säiliöön, ja yhdistettynä paneelin Docker-käyttöoikeuksiin se vastaa käytännössä root-käyttäjää isännällä. Nämä kentät näkyvät vain admineille.

Mukautetut säiliöiden nimet eivät myöskään voi sijaita paneelin omassa `msm-` nimiavaruudessa, joten käsin nimetty säiliö ei voi koskaan varjostaa toisen palvelimen säiliötä ja ohjata pysäytys- tai komentoa väärään instanssiin.

## Tilien hallinta

![Profiilikuva](/docs/images/profile-picture.png)

Adminit voivat luoda käyttäjiä, muuttaa rooleja, nollata salasanoja ja poistaa tilejä Käyttäjät-taulukosta. **2FA**-sarake näyttää, onko kaksiportainen tunnistautuminen käytössä kullakin käyttäjällä; admin voi **nollata** toisen käyttäjän 2FA:n (kadonneen puhelimen ja varmuuskoodien tapauksessa), mutta ei koskaan poistaa omaansa ilman salasanaansa, minkä itsepalveluvirta hoitaa sen sijaan.

Epäonnistuneet kirjautumiset rajoitetaan per tili (sekä per IP-osoite että tilikohtainen yleinen laskuri) hidastamaan murtautumisyrityksiä, ja sama rajoitus kattaa myös 2FA-koodivaiheen, joten oikea salasana ei voi nollata laskuria ennen koodin arvaamista. Tämän edessä on karkeampi per asiakas-IP pyyntörajoitin kirjautumis-, 2FA- ja asetus-päätepisteissä, säädettävissä `RATE_LIMIT_AUTH_PER_15MIN` (oletus 100; käänteisen välityspalvelimen takana, aseta `TRUST_PROXY` niin että se avaa todellisen asiakkaan IP-osoitteen perusteella).
