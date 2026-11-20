---
title: 'Minecraft-chatbot palvelukohtaisesti'
description: 'Paneeli tarjoaa jokaiselle hallitulle Minecraft-palvelimelle ylläpitäjän määrittämän chatbotin, joka asetetaan palvelimen Asetukset → Chatbot-välilehdellä.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/chatbot.md'
---

[← Takaisin dokumenttien hakemistoon](/docs/)

Paneeli tarjoaa jokaiselle hallinnoidulle Minecraft-palvelimelle ylläpitäjän määrittämän chatbotin, joka asetetaan palvelimen **Asetukset → Chatbot** -välilehdellä. Se yhdistää OpenAI-yhteensopivaan chat-completions-päätepisteeseen, mukaan lukien Ollaman toisella lähiverkkoisännällä. Jokaisella palvelimella on oma päätepisteensä, mallinsa, kutsumanimensä, persoonansa, transkriptiokäytäntönsä, tiedotusviestinsä ja tehokäytäntönsä. Oletuskutsu on `@wizard`, ja oletuspersoona esittää muinaista, leikkisää velhoa pelimaailmassa; molempia voi muokata.

![Chatbot-asetukset](/docs/images/integrations-chatbot.png)

## Pelaajakokemus

- Kuka tahansa pelaaja voi käyttää `@wizard <viesti>` (tai määritettyä kutsumanimeä) keskusteluun ja deterministiseen, Minecraft-versiotietoiseen vanilla-reseptiapuun.
- Liittymisviestit ja määritettävä kertaluonteinen pelisession tarkistus muistuttavat pelaajia chatbotin saatavuudesta. `@wizard chat` avaa lyhyen opt-in-keskusteluikkunan; `@wizard bye` sulkee sen.
- **Peruskäyttäjät** voivat kutsua käytössä olevia itse-/mahtitehoja. **Tehonvalvojat** voivat kutsua erikseen validoituja toimintoja, jotka vaikuttavat toiseen online-pelaajaan. Pelaajat, jotka eivät kuulu kumpaankaan ryhmään, pysyvät vain keskustelutilassa.
- Peruskäyttäjien itse-lahjat käyttävät sallittujen kohteiden listaa. Valvojat voivat antaa toiselle pelaajalle minkä tahansa kelvollisen nimetyn vanilla- tai modatun kohteen, määrän rajoituksen ja muiden tehonsuojausten alaisena.

![Chatbot-transkriptiot](/docs/images/chatbot-transcripts.png)

## Suunnittelu ja turvallisuus

Määritykset ja transkriptiot ovat vain ylläpitäjille. Malli ei koskaan vastaanota raakaa RCON- tai mielivaltaista komennon suoritusta. Viesti paljastaa vain yhden kiinteän työkalun, joka vastaa sen nimenomaista tarkoitusta; palvelinkoodi validoi valtuutuksen, argumentit, liput, määrät, jäähdytysajat ja tarkat online-pelaajien nimet ennen olemassa olevan palveluoperaation suorittamista. Minecraft-valitsimet hylätään, pelaajien väliset toiminnot eivät voi kohdistua kutsujaan, tehot alkavat kuiva-ajotilassa, ja jokainen yritetty teho auditoidaan. Tuetonta työkalukutsua käyttävät mallit palautuvat vain keskusteluun.

Vastaukset on rajattu Minecraft-chattiin. Tunnetut vanilla-reseptit tulevat mukana toimitettujen versioitujen reseptitietojen mukana ja renderöidään vakaiksi 2x2/3x3 riveiksi; LLM:ää ei luoteta reseptiasettelujen keksimiseen. Tuntemattomat tai modatut reseptit ohjaavat pelaajan JEI/REI:hin sen sijaan, että keksittäisiin vastaus.

## Pääasialliset tote tiedostot

- `src/services/wizard.js`: palvelinkohtainen määritys, OpenAI-yhteensopivat pyynnöt, chatin käsittely, tiedotus, transkriptioiden säilytys ja vastausrajat.
- `src/services/wizardPowers.js`: roolitarkistukset, tarkoitussidonnaiset työkaluskeemat, validointi, suoritus, jäähdytysajat ja tehojen auditointi.
- `src/services/wizardRecipes.js`: deterministinen versioitu reseptihaku ja ruudukon muotoilu. Resepti- ja kohdetiedot tulevat mukana toimitetusta [`minecraft-data`](https://github.com/PrismarineJS/minecraft-data) -paketista. (Tämän dokumentin aikaisempi luonnos viittasi `src/data/recipes/`-kansioon, jota ei koskaan tallennettu; tällaista kansiota ei ole, ja tiedot sijaitsevat paketissa. Katso "Riippuvuusjalanjälki".)
- `src/analytics/ingest.js`: välittää jäsennyksien, poistumisten ja pelaajien chatin jäsennykset chatbotille.
- `src/web/routes/wizard.js`, `public/js/pages/integrations.js` ja `views/partials/server/integrations.hbs` (käyttäen `chatbot.hbs`): ylläpitäjän API ja palvelinkohtainen Asetukset → Chatbot-välilehti.
- `src/db/migrations/011_wizard_chat.js`, `013_wizard_invocation_name.js`, `015_wizard_powers.js`, `017_wizard_outreach.js` ja `019_wizard_power_controllers.js`: pysyvä skeema.
- `test/wizard.test.js`: valtuutus-, työkaluraja-, säilytys-, tiedotus- ja chattikäyttäytymistestit.

Sisäiset `wizard`-reitti/moduuli/taulun nimet säilytetään päivitys- ja API-yhteensopivuuden vuoksi; "chatbot" on käyttäjälle näkyvä tuotetermi. Samoin tallennettu `power_testers_json`-kenttä vastaa käyttöliittymän **Peruskäyttäjät**-ryhmää.

## Riippuvuusjalanjälki (`minecraft-data`)

Reseptiapu käyttää `minecraft-data`-pakettia. Se on suuri levytilaltaan (noin 429 MB asennettuna), ja se toimitetaan tuotantokuvan mukana, koska se on ajonaikainen riippuvuus, ei kehitysaikainen. Pidämme sen tarkoituksella, jotta reseptiapu toimii offline-tilassa jokaiselle Minecraft-julkaisulle ilman verkkopyyntöä.

Huomautuksia seuraavalle tarkastelijalle (ihmiselle tai tekoälylle), jotta koko ei yllättäisi:

- Tällä hetkellä käytetään vain Java (`pc`) -dataa. `wizardRecipes.js` lukee `minecraftData.versions.pc` ja versiopohjaiset `recipes`, `items` ja `blocks` -taulut. Tiedostot, joihin se todella koskee, ovat yhteensä noin 15 MB jokaisesta pc-versiosta.
- Noin 330 MB paketista on `data/bedrock`, eikä mikään tässä sitä lue vielä. Jätämme sen paikalleen tarkoituksella. Jos paneeli joskus lisää Bedrock Minecraft -tuen, Bedrock-resepti- ja kohdetiedot ovat jo täällä, joten reseptiominaisuus voi kasvaa kattamaan Bedrock-palvelimet lisäämättä uutta riippuvuutta. Aloita `minecraftData.versions.bedrock` -kohdasta ja seuraa samaa muotoa kuin pc-polku.
- Jos kokoa on joskus pienennettävä ennen Bedrock-tuen saapumista, tässä arkistossa on jo malli sitä varten. `src/services/itemRegistry.js` hakee `minecraft-data`-tiedostoja jsDelivr CDN:stä tarvitessaan niitä ja välimuistittaa ne `api_cache`-kansioon. Joko tämä lähestymistapa tai pieni käsin valittu `src/data/recipes/`-osajoukko, joka kattaa muutamia yleisiä versioita, pienentäisi kuvaa huomattavasti.

## Paikallinen tallennus ja manuaalinen tarkastus

Kaikki asetukset ja säilytetyt transkriptiot sijaitsevat paneelin SQLite-tietokannassa `/data/panel.db` -osoitteessa paneelin säiliön sisällä. Tavallisella Compose-liitoksella isäntäpolku on `${DATA_DIR_HOST}/panel.db` (esimerkiksi `/opt/msm/data/panel.db`). Asiaankuuluvat taulut ovat `wizard_configs`, `wizard_transcripts` ja `wizard_outreach`; tehoauditoinnit ovat rivejä `events`-taulussa tyypillä `wizard-power`. Valinnainen LLM API-avain on AES-256-GCM-salattu paneelin levossa olevalla avaimella, `.secret-key` data-kansiossa (erillään `SESSION_SECRET`).

Varmuuskopioi tietokanta ja pysäytä paneeli ennen suoria SQLite-muokkauksia, jotta sen WAL käsitellään turvallisesti. Ylläpitäjän käyttöliittymän/API:n käyttö on suositeltavaa, koska se soveltaa validointia ja salausta. Pidä `panel.db`, `panel.db-wal` ja `panel.db-shm` -tiedostot yhdessä kopioidessasi live-tietokantaa.
