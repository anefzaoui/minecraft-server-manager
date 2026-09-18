---
title: 'Kojelauta'
description: 'Kojelauta on kotipesäsi: jokainen palvelin, sen reaaliaikainen tila ja käynnissä oleva syöte tapahtumista.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/dashboard.md'
---

[← Takaisin dokumenttien luetteloon](/docs/)

Kojelauta on kotipesäsi: jokainen palvelin, sen reaaliaikainen tila ja syöte tapahtumista.

![Kojelauta](/docs/images/dashboard.png)

## Yhteenvetoruo'at

Ylhäällä:

- **Palvelimia käynnissä** - kuinka monta palvelintasi on tällä hetkellä käynnissä.
- **Yhdistyneitä pelaajia** - pelaajien kokonaismäärä kaikilla käynnissä olevilla palvelimilla.
- **Päivityksiä saatavilla** - kuinka monella palvelimella, paketilla tai modilla on uudempi versio ([katso Päivitykset](/docs/updates/)).
- **Docker** - voiko paneeli tavoittaa Docker-daemonin ja sen version.

## Palvelinkortit

Jokainen palvelin näkyy korttina, jossa on sen tila (Käynnissä, Käynnistyy, Pysäytetty, Kaatunut), tyyppi ja Minecraft-versio sekä pelisatama. Käynnissä oleville palvelimille saat myös reaaliaikaisen **pelaaja-, CPU-, muisti- ja levynkäytön**, jotka päivittyvät jatkuvasti.

Napsauta korttia avataksesi kyseisen palvelimen. Tyhjä **Luo palvelin** -kortti ja yläpalkin **Luo palvelin** -painike käynnistävät molemmat [luontivelhon](/docs/servers/).

Voit etsiä ja järjestellä palvelimiasi sekä vaihtaa ruudukko- ja luettelonäkymien välillä oikealla olevalla valitsimella.

## Viimeaikainen toiminta

Alareunan syöte on reaaliaikainen, ihmisluettava auditointiloki: kirjautumiset, varmuuskopiot, blueprint-viennit, päivitystarkistukset, chat-komentojen muutokset, palvelinten käynnistykset ja pysäytykset ja paljon muuta. Jokainen merkintä on merkitty palvelimella, johon se kuuluu (tai itse paneelilla), ja kuinka kauan sitten se tapahtui. Täysi historia löytyy [Toiminta](/docs/activity/) -sivulta.
