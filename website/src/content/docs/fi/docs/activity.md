---
title: 'Aktiviteettiloki'
description: 'Aktiviteettisivu on täydellinen auditointiloki: haettava, kronologinen tallenne kaikesta, mitä paneelissa tapahtui.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/activity.md'
---

[← Takaisin dokumenttien luetteloon](/docs/)

**Aktiviteetti**-sivu on täydellinen tapahtumien kirjaus: haettava, kronologinen tallenne kaikesta, mitä paneelissa on tapahtunut. Suodata sitä palvelimen tai tapahtumatyypin mukaan, hae yhteenvetoja ja vie suodatetut tiedot CSV- tai JSON-muodossa. Lokitiedot tallentaneet merkinnät (esimerkiksi kaatuminen) avautuvat paikallaan.

![Aktiviteetti](/docs/images/activity.png)

## Mitä tallennetaan

- **Tunnistautuminen**: kirjautumiset (mukaan lukien 2FA:n tai varmuuskoodin käyttö), tilin lukitukset, salasanan vaihdot ja 2FA:n käyttöönotto, poistaminen tai nollaus.
- **Palvelimen elinkaari**: luomiset, käynnistykset, pysäytykset, uudelleenkäynnistykset, kaatumiset, automaattiset uudelleenkäynnistykset ja muistin loppumistapahtumat.
- **Hälytykset**: jumittuneet käynnistykset, pysäytysvirheet, epäonnistuneet ajoitukset, kiintiöiden pysäytykset, epäterveet säiliöt, uudelleenkäynnistyksen jälkeen offline-tilassa.
- **Tiedot**: luodut ja palautetut varmuuskopiot, viedyt mallit, pakettien asennukset ja päivitykset, modien ja maailmojen muutokset sekä tiedostojen muokkaukset.
- **Pelaajat**: potkut, bannit, whitelist- ja operaattorimuutokset sekä pelaajamuistiinpanot.
- **Määritykset**: chat-komentojen muutokset, käyttäjä- ja roolimuutokset, palvelinkohtaiset käyttöoikeusmuutokset, pelin porttimuutokset ja asetusten muokkaukset.

Jokainen merkintä tallentaa, kuka sen teki (käyttäjänimi tai paneeli/ajastin automatisoiduille toiminnoille), mihin palvelimeen se liittyy ja milloin. [Kojelauta](/docs/dashboard/) näyttää viimeisimmät merkinnät; tämä sivu on täydellinen historia. Operaattorit ja katselijat näkevät vain merkinnät palvelimista, joita he voivat tarkastella (sekä paneelinlaajuiset), ja palvelinkohtaiset käyttöoikeusmuutokset näytetään vain ylläpitäjille. Elinkaari- ja hälytystapahtumat voidaan myös välittää Discordiin (katso [Integraatiot](/docs/integrations/)).

Koska se tallentaa turvallisuuteen liittyviä tapahtumia (kirjautumiset, 2FA-muutokset, rooli- ja käyttöoikeusmuutokset), aktiviteettiloki on myös ensimmäinen pysähdyspaikkasi, jos jokin tilin toiminnassa näyttää epäilyttävältä.
