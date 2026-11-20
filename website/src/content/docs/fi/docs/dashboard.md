---
title: 'Kojelauta'
description: 'Kojelauta on kotipesäsi: jokainen palvelin, sen reaaliaikainen tila ja käynnissä oleva syöte tapahtumista.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/dashboard.md'
---

[← Takaisin dokumenttien luetteloon](/docs/)

Kojelauta on kotipesäsi: jokainen palvelin, sen reaaliaikainen tila ja syöte tapahtumista.

![Kojelauta](/docs/images/dashboard.png)

## Yhteenvetoruudut

Ylhäällä:

- **Palvelimia verkossa**: kuinka monta palvelintasi on käynnissä kokonaismäärästä.
- **Yhdistyneitä pelaajia**: pelaajien kokonaismäärä kaikissa käynnissä olevissa palvelimissa.
- **Päivityksiä saatavilla**: kuinka monella palvelimella, paketilla tai modilla on uudempi versio ([katso Päivitykset](/docs/updates/)).
- **Docker**: voiko paneeli tavoittaa Docker-daemonin ja sen version.

Toinen rivi lisää **Määrätty muisti** (ja kuinka paljon on käytössä), **Tallennustilaa käytetty** kaikissa palvelinten datakansioissa, **Terveys · 24h** (kaatumiset, muistin loppumiset ja automaattiset uudelleenkäynnistykset viimeisen päivän aikana) ja **Päivitykset** jaettuna modeihin ja palvelintasoisiksi päivityksiksi. Niiden alla **Palvelimet tilan mukaan** laskee palvelimesi kussakin tilassa, ja **Resurssien yleiskatsaus** piirtää kaikkien palvelinten muistin ja suorittimen osuudet.

## Palvelinkortit

Jokainen palvelin näkyy korttina, jossa on sen tila (Käynnissä, Käynnistyy, Pysäytetty, Kaatunut ja välitilat, kuten Epäterve tai Jumiutunut), tyyppi ja Minecraft-versio, pelin portti ja sen tunnisteet. Jokainen kortti näyttää **pelaajat** ja **levytilan** käytön kiintiöön nähden; käynnissä olevat palvelimet näyttävät myös reaaliaikaisen **suorittimen** ja **muistin** käytön, jota päivitetään jatkuvasti.

Napsauta korttia avataksesi kyseisen palvelimen. Tyhjä **Luo palvelin** -kortti ja yläpalkin **Luo palvelin** -painike käynnistävät molemmat [luontivelhon](/docs/servers/).

Voit etsiä palvelimiasi (nimen, tyypin, version tai tunnisteen mukaan), lajitella niitä tilan, nimen, koon, viimeksi käynnistetyn tai luodun mukaan ja vaihtaa ruudukko- ja luettelonäkymien välillä oikealla olevalla valitsimella.

## Viimeaikainen toiminta

Alareunassa oleva syöte näyttää paneelin ihmisluettavan auditointilokin viimeisimmät merkinnät: kirjautumiset, varmuuskopiot, blueprint-viennit, päivitystarkistukset, chat-komentojen muutokset, palvelinten käynnistykset ja pysäytykset ja paljon muuta. Jokainen merkintä on merkitty palvelimella, johon se kuuluu (tai itse paneelilla), ja kuinka kauan sitten se tapahtui. **Näytä kaikki** avaa koko historian [Toiminta](/docs/activity/) -sivulla.
