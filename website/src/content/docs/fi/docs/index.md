---
title: 'Dokumentaatio'
description: 'Täydellinen, itse isännöity ohjauspaneeli itzg/docker-minecraft-serverille.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/README.md'
---

Täydellinen, itse isännöity ohjauspaneeli [itzg/docker-minecraft-server](https://github.com/itzg/docker-minecraft-server)-palvelimelle. Luo, suorita ja hallitse Minecraft-palvelimia selaimestasi. Ei komentoriviä, ei YAML-tiedostojen manuaalista muokkausta.

![Ohjausnäkymä](/docs/images/dashboard.png)

## Aloita tästä

- **[Aloitusopas](/docs/getting-started/)** - ensiasennus, kirjautuminen ja navigointi.
- **[Ohjausnäkymä](/docs/dashboard/)** - yleiskatsaus kaikista palvelimista, pelaajista ja toiminnasta.

## Palvelinten suorittaminen

- **[Palvelinten luominen ja hallinta](/docs/servers/)** - luontivelho, palvelintyypit, versiot ja palvelinkohtaiset asetukset.
- **[Konsoli ja chat-komennot](/docs/console-and-chat/)** - reaaliaikainen konsoli ja mukautetut pelinsisäiset chat-komennot, jotka suoritetaan pelaajana.
- **[Modipaketit](/docs/modpacks/)** - asenna CurseForge-, Modrinth-, FTB- ja GT New Horizons -paketit, aina kiinnitettynä tarkkaan versioon.
- **[Maailmat ja tiedostot](/docs/worlds-and-files/)** - vaihda maailmoja, hallitse modeja ja muokkaa tiedostoja suoraan selaimessa.
- **[Maailman pienentäminen](/docs/world-shrink/)** - vapauta levytilaa poistamalla lohkoja, joissa kukaan ei käy, itsenäisesti tai osana varmuuskopiota.
- **[Reaaliaikainen kartta](/docs/live-map/)** - yhden napsautuksen 3D-kartta maailmasta BlueMapilla, paneelin kirjautumisen takana.
- **[Kutsut ja tilasivu](/docs/invites-and-status-page/)** - osoite, kutsumeksti ja asiakasmodipakkaus ystäville sekä julkinen tilasivu.

## Tiedot ja automaatio

- **[Palvelinkohtainen chatbot](/docs/chatbot/)** - paikallinen/OpenAI-yhteensopiva keskustelu, tiedustelu, tallennetut transkriptiot ja rajoitetut pelitehot.
- **[Varmuuskopiot](/docs/backups/)** - yhden napsautuksen tilannekuvat, ajoitetut varmuuskopiot, kuinka monta säilytetään (koko paneeli tai palvelinkohtainen) ja palautus.
- **[Suunnitelmat](/docs/blueprints/)** - tallenna palvelimen koko konfiguraatio ja luo siitä uusia.
- **[Ajoitukset](/docs/schedules/)** - cron-ohjatut uudelleenkäynnistykset, varmuuskopiot ja komennot.
- **[Tallennustila](/docs/storage/)** - palvelinkohtainen levynkäyttö ja paneelin pakottamat kiintiöt.
- **[Päivitykset](/docs/updates/)** - seuraa uusia palvelin-, paketti-, kuva- ja modiversioita, tarkista, mitä Minecraft-versioita modisi tukevat, ja peruuta modipäivitys.
- **[Toimintaloki](/docs/activity/)** - auditointiloki kaikesta tapahtuneesta.
- **[Integraatiot](/docs/integrations/)** - Discord-webhook-ilmoitukset ja Hälytykset-kategoria.
- **[Julkinen API](/docs/public-api/)** - vain lukuoikeudellinen, token-autentikoitu HTTP API palvelimen tilan hakemiseen paneelin ulkopuolelta.

## Tilit ja tietoturva

- **[Käyttäjät ja roolit](/docs/users-and-roles/)** - ylläpitäjä, operaattori ja katselija, mitä kukin voi tehdä, ja palvelinkohtaiset käyttöoikeudet, jotka tarkentavat niitä.
- **[Kaksivaiheinen tunnistautuminen](/docs/two-factor-authentication/)** - suojaa kirjautumisesi todennussovelluksella.

## Oppaat

Ei koske vain tätä paneelia: kysymykset, joita jokainen Minecraft-palvelimen omistaja kohtaa.

- **[Kuinka paljon RAM-muistia palvelin tarvitsee?](/docs/guide-server-memory/)** - kaksi asetettavaa lukua ja miksi joutokäynnillä oleva palvelin lukee 12 Gt.
- **[Vanilla, Paper, Fabric, Forge, NeoForge, Quilt](/docs/guide-choosing-a-loader/)** - mitä käyttää ja valinnan taustalla oleva lisäosien/modien ero.
- **[Palvelimesi ei käynnisty](/docs/guide-server-wont-start/)** - lokin lukeminen ja harvat syyt useimpien virheiden takana.
- **[Varmuuskopiot, jotka todella palautuvat](/docs/guide-backups/)** - johdonmukaiset kopiot, mitä muuta säilyttää ja yhden testaaminen ennen tarvetta.
- **[Palvelimen siirtäminen toiseen isäntään](/docs/guide-moving-a-server/)** - järjestys, joka pitää käyttökatkokset lyhyinä ja inventaariot ennallaan.

## Sisäinen toiminta

- **[Arkkitehtuuri](/docs/architecture/)** - miten paneeli on rakennettu.
- **[Verkkosivusto](/docs/website/)** - miten minecraft-server-manager.com rakennetaan, käännetään ja otetaan käyttöön tästä repositoriosta.

---

> Näiden dokumenttien kuvakaappaukset on otettu paneelin tummalla teemalla. Paneeli käynnistyy tummana, ellei käyttöjärjestelmäsi suosi vaaleaa; käytä yläpalkin teemakytkintä vaihtaaksesi.
