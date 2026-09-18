---
title: 'Tallennustila'
description: 'Tallennustila-sivu näyttää, mihin levytilasi menee: palvelinkohtainen käyttö ja sen kehitys ajan mittaan.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/storage.md'
---

[← Takaisin dokumenttien luetteloon](/docs/)

**Tallennustila**-sivu näyttää, mihin levytilasi menee: palvelinkohtainen käyttö ja sen kehitys ajan mittaan.

![Tallennustila](/docs/images/storage.png)

## Levytilakiintiöt ovat paneelin valvonnassa

Docker ei voi rajoittaa bind mountin levynkäyttöä, joten paneeli tekee sen. Taustalla toimiva kokoindeksaattori käy läpi datakansion, tallentaa välimuistiin kunkin palvelimen jalanjäljen ja valvoo asettamaasi levytilakiintiötä palvelinkohtaisesti. Kun palvelimen data (maailma + varmuuskopiot + kaikki muu) lähestyy kiintiötään, paneeli pysäyttää hallitsemattoman kasvun sen sijaan, että antaisi yhden palvelimen täyttää isäntäsi.

Aseta palvelimen kiintiö sen [asetuksissa](/docs/servers/). Modatut palvelimet ja niiden [varmuuskopiot](/docs/backups/) voivat olla suuria, joten anna niille tilaa.

## Siivous

Tallennustila-näkymä auttaa sinua löytämään, mitä karsia (vanhat varmuuskopiot, käyttämättömät maailmat tai palvelin, joka on kasvanut odotuksia huomattavasti suuremmaksi) ennen kuin tila loppuu.
