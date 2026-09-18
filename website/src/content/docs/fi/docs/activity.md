---
title: 'Aktiviteettiloki'
description: 'Aktiviteettisivu on täydellinen auditointiloki: haettava, kronologinen tallenne kaikesta, mitä paneelissa tapahtui.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/activity.md'
---

[← Takaisin dokumenttien indeksiin](/docs/)

**Aktiviteetti**-sivu on täydellinen auditointiloki: haettava, kronologinen tallenne kaikesta, mitä paneelissa tapahtui.

![Aktiviteetti](/docs/images/activity.png)

## Mitä tallennetaan

- **Tunnistautuminen** - kirjautumiset (mukaan lukien, käytettiinkö 2FA:ta tai varmuuskoodia), ja 2FA:n käyttöönotto, poistaminen tai nollaus.
- **Palvelimen elinkaari** - luomiset, käynnistykset, pysäytykset, uudelleenkäynnistykset, kaatumiset ja muistin loppumistapahtumat.
- **Hälytykset** - jumittuneet käynnistykset, pysäytysvirheet, epäonnistuneet ajoitukset, kiintiön pysäytykset, epäterveet säiliöt, uudelleenkäynnistyksen jälkeen offline-tilassa.
- **Tiedot** - luodut ja palautetut varmuuskopiot, viedyt blueprintit, pakettien asennukset ja päivitykset.
- **Määritykset** - chat-komentojen muutokset, roolien muutokset ja asetusten muokkaukset.

Jokainen merkintä tallentaa, kuka sen teki (käyttäjänimi tai paneeli/ajastin automatisoiduille toiminnoille), mihin palvelimeen se liittyy ja milloin. [Kojelauta](/docs/dashboard/) näyttää viimeisimmät merkinnät; tämä sivu on täydellinen historia. Elinkaari- ja hälytystapahtumat voidaan myös välittää Discordiin (katso [Integraatiot](/docs/integrations/)).

Koska se tallentaa turvallisuuteen liittyviä tapahtumia (kirjautumiset, 2FA-muutokset, roolimuutokset), aktiviteettiloki on myös ensimmäinen pysähdyspaikkasi, jos jokin tilin toiminnassa näyttää oudolta.
