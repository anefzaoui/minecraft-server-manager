---
title: 'Integraatiot'
description: 'Jokainen palvelin sisältää integraationsa Asetukset-ryhmän alla: Discord, julkinen tilasivu, kertaklikkauksella luotavat kutsut ja valinnainen chatbot-välilehti.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/integrations.md'
---

[← Takaisin dokumenttien hakemistoon](/docs/)

Jokainen palvelin sisältää integraationsa **Asetukset**-ryhmässä: **Discord**, julkinen **Tilaussivu**, yhden napsautuksen **Kutsut** ja valinnainen **Chatbot**-välilehti. Tämä sivu käsittelee Discordia (muilla on omat dokumenttinsa ja asennusohjeensa paneelissa).

## Discord-ilmoitukset

Paneeli välittää palvelintapahtumia Discord-kanavalle webhookin kautta. Ei bottia, ei OAuthia.

### Asennus

1. Discordissa: **Server Settings → Integrations → Webhooks → New Webhook**. Valitse kanava ja kopioi webhook-URL.
2. Paneelissa avaa palvelimen **Asetukset → Discord** -välilehti, liitä URL **Webhook URL** -kenttään, kytke kortti **päälle** ja paina **Tallenna**. URL tallennetaan salattuna (samassa levossa olevassa tallennustilassa kuin API-avaimesi).
3. Käytä **Send test** -painiketta varmistaaksesi, että se toimii.

![Discord integration](/docs/images/integrations-discord.png)

Tallennnetun URL-osoitteen korvaamiseksi liitä uusi ja tallenna; jätä kenttä tyhjäksi säilyttääksesi nykyisen. Tallennettu URL näytetään peitettynä (token on piilotettu).

### Mitä lähetetään

Ilmoitukset on ryhmitelty kytkettäviin kategorioihin. Kaikki ovat oletuksena päällä.

| Kategoria                 | Tapahtumat                                                         |
| ------------------------- | ------------------------------------------------------------------ |
| **Käynnistys / pysäytys** | Palvelin käynnistetty, palvelin pysäytetty                         |
| **Kaatumiset**            | Kaatui, kaatumisloop havaittu, uusi kaatumisraportti               |
| **Varmuuskopiot**         | Varmuuskopio luotu, varmuuskopio palautettu                        |
| **Päivitykset**           | Päivitys asennettu, päivitys peruutettu, päivitys epäonnistui      |
| **Potkut / bannit**       | Pelaaja potkittu, pelaaja bannattu                                 |
| **Hälytykset**            | Asiat, jotka hiljaa jättävät palvelimen rikkinäiseksi (katso alla) |

### Hälytykset-kategoria

`Alerts` on "jotain vaatii ihmisen" -kanava, olosuhteille, jotka olivat aiemmin näkyvissä vain paneelissa:

| Tapahtuma               | Merkitys                                                                                                                                   |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `oom`                   | Säiliö pysäytettiin muistin loppumisen vuoksi.                                                                                             |
| `unhealthy`             | Prosessi on käynnissä, mutta `mc-health`-tunnistin epäonnistuu: elävä mutta kuollut palvelin.                                              |
| `startup-stalled`       | Käynnistyy edelleen noin 10 minuutin kuluttua ilman "Done"-merkintää lokeissa (diagnoosilla siitä, mitä korjata, jos sellainen tunnetaan). |
| `stop-failed`           | Siisti pysäytys ei ottanut vaikutusta ja säiliö on edelleen käynnissä.                                                                     |
| `schedule-failed`       | Aikataulutettu uudelleenkäynnistys / varmuuskopiointi / komento epäonnistui.                                                               |
| `quota-exceeded`        | Tiukka levytilan kiintiö laukesi ja palvelin pysäytettiin.                                                                                 |
| `offline-after-restart` | Palvelin oli käynnissä ennen paneelin uudelleenkäynnistystä, ei ole nyt, eikä sitä käynnistetä automaattisesti.                            |
| `crash-report`          | Uusi kaatumisraportti on tallennettu ja jäsennetty.                                                                                        |
| `update-failed`         | Suojattu päivitys ei tullut terveeksi.                                                                                                     |

### Miten toimitus toimii

Taustasiltä tarkistaa [tapahtumalokin](/docs/activity/) 15 sekunnin välein ja välittää vastaavat rivit. Jos webhook POST epäonnistuu tilapäisesti, kyseistä riviä yritetään uudelleen myöhemmissä tarkistuksissa pudottamisen sijaan; pysyvästi tavoittamaton webhook mykistetään (yksi lokirivi tunnissa) muutaman yrityksen jälkeen. Silta ei koskaan toista tapahtumia ennen paneelin käynnistymistä.
