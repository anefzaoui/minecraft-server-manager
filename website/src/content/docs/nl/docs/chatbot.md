---
title: 'Minecraft-chatbot per server'
description: 'Deze fork voegt een door beheerders geconfigureerde chatbot toe aan elke beheerde Minecraft-server.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/chatbot.md'
---

[← Terug naar de documentatie-index](/docs/)

Deze fork voegt een door de beheerder geconfigureerde chatbot toe aan elke beheerde Minecraft-server. Het maakt verbinding met een
OpenAI-compatibel chat-completions-eindpunt, inclusief Ollama op een andere LAN-host. Elke server heeft
zijn eigen eindpunt, model, aanroepnaam, persona, transcriptiebeleid, outreach-berichten en machtigingsbeleid. De standaardaanroep is `@wizard`, en de standaardpersona demonstreert een oude,
speelse tovenaar in de game; beide zijn bewerkbaar.

![Chatbot-instellingen](/docs/images/integrations-chatbot.png)

## Spelerservaring

- Elke speler kan `@wizard <bericht>` (of de geconfigureerde aanroep) gebruiken voor conversatie en
  deterministische, Minecraft-versiebewuste vanilla receptenhulp.
- Join-groeten en een configureerbare eenmalige check-in tijdens de spelsessie herinneren spelers eraan dat de chatbot
  beschikbaar is. `@wizard chat` opent een kort opt-in conversatievenster; `@wizard bye` sluit het.
- **Basisgebruikers** kunnen ingeschakelde zelf-/wereldmachten aanroepen. **Machtcontrollers** kunnen afzonderlijk
  gevalideerde acties aanroepen die van invloed zijn op een andere online speler. Spelers in geen van beide groepen blijven
  alleen voor conversatie.
- Zelf-geschenken van basisgebruikers gebruiken een item-allowlist. Controllers kunnen een andere speler elk geldig
  namespaced vanilla of gemodificeerd item geven, onderhevig aan de hoeveelheidslimiet en andere machtigingsbeveiligingen.

![Chatbot-transcripties](/docs/images/chatbot-transcripts.png)

## Ontwerp en beveiliging

Configuratie en transcripties zijn alleen voor beheerders. Het model ontvangt nooit ruwe RCON of willekeurige
commando-uitvoering. Een bericht exposeert alleen de enkele vaste tool die overeenkomt met de expliciete intentie;
servercode valideert autorisatie, argumenten, vlaggen, hoeveelheden, cooldowns en exacte online
speler namen voordat een bestaande servicebewerking wordt uitgevoerd. Minecraft-selectors worden afgewezen,
cross-player acties kunnen de aanroeper niet targetten, machten beginnen in dry-run modus, en elke poging tot macht
wordt gecontroleerd. Niet-ondersteunde tool-calling modellen vallen terug op alleen conversatie.

Antwoorden zijn beperkt voor Minecraft-chat. Bekende vanilla recepten komen van gebundelde versiegebonden receptgegevens en worden weergegeven als stabiele 2x2/3x3 rijen; de LLM wordt niet vertrouwd om receptlay-outs te bedenken. Onbekende of gemodificeerde recepten verwijzen de speler naar JEI/REI in plaats van een antwoord te fabriceren.

## Belangrijkste implementatiebestanden

- `src/services/wizard.js`: per-server configuratie, OpenAI-compatibele verzoeken, chatafhandeling,
  outreach, transcriptiebehoud en responslimieten.
- `src/services/wizardPowers.js`: rolcontroles, intentie-specifieke toolschema's, validatie, uitvoering,
  cooldowns en machtigingsauditing.
- `src/services/wizardRecipes.js`: deterministische versiegebonden recept lookup en grid-formattering. Recept
  en itemgegevens komen van het gebundelde [`minecraft-data`](https://github.com/PrismarineJS/minecraft-data)
  pakket. (Een eerdere versie van dit document verwees naar een `src/data/recipes/` map die nooit is
  gecommit; er is geen dergelijke map, en de gegevens bevinden zich in het pakket. Zie "Afhankelijkheidsvoetafdruk".)
- `src/analytics/ingest.js`: stuurt geparseerde joins, leaves en spelerchats door naar de chatbot.
- `src/web/routes/wizard.js`, `public/js/pages/integrations.js`, en
  `views/partials/server/integrations.hbs`: admin API en per-server Integraties UI.
- `src/db/migrations/011_wizard_chat.js` tot `019_wizard_power_controllers.js`: persistente schema's.
- `test/wizard.test.js`: autorisatie, tool-grenzen, retentie, outreach en chatgedragstests.

De interne `wizard` route/module/tabelnamen worden behouden voor upgrade- en API-compatibiliteit;
"chatbot" is de gebruikersgerichte productterm. Evenzo is het opgeslagen `power_testers_json` veld gelijk aan de
**Basisgebruikers** groep in de UI.

## Afhankelijkheidsvoetafdruk (`minecraft-data`)

Receptenhulp gebruikt het `minecraft-data` pakket. Het is groot op schijf (ongeveer 429 MB geïnstalleerd), en het
wordt meegeleverd in de productie-image omdat het een runtime-afhankelijkheid is, geen dev-afhankelijkheid. We houden het
met opzet aan, zodat receptenhulp offline werkt voor elke Minecraft-release zonder netwerkoproep.

Opmerkingen voor wie dit hierna bekijkt (mens of AI), zodat de grootte geen verrassing is:

- Alleen de Java (`pc`) gegevens worden momenteel gebruikt. `wizardRecipes.js` leest `minecraftData.versions.pc`
  en de per-versie `recipes`, `items`, en `blocks` tabellen. De bestanden die het daadwerkelijk aanraakt, tellen op tot
  ongeveer 15 MB over alle pc-versies.
- Ongeveer 330 MB van het pakket is `data/bedrock`, en niets hier leest het nog. We laten het met opzet staan.
  Als het paneel ooit Bedrock Minecraft-ondersteuning toevoegt, zijn de Bedrock recept- en itemgegevens
  al aanwezig, dus de receptfunctie kan groeien om Bedrock-servers te dekken zonder een nieuwe afhankelijkheid toe te voegen. Begin bij `minecraftData.versions.bedrock` en volg dezelfde structuur als het pc-pad.
- Als de grootte ooit naar beneden moet komen voordat Bedrock-ondersteuning arriveert, is er al een patroon voor in deze repo. `src/services/itemRegistry.js` haalt `minecraft-data` bestanden van de jsDelivr CDN op wanneer het ze nodig heeft en cachet ze in `api_cache`. Ofwel die aanpak, of een kleine handmatig gekozen `src/data/recipes/` subset die een paar veelvoorkomende versies dekt, zou de image aanzienlijk verkleinen.

## Lokale opslag en handmatige inspectie

Alle instellingen en bewaarde transcripties bevinden zich in de panel SQLite-database op `/data/panel.db` binnen
de panelcontainer. Met de standaard Compose-mount is het hostpad
`${DATA_DIR_HOST}/panel.db` (bijvoorbeeld `/opt/msm/data/panel.db`). Relevante tabellen zijn
`wizard_configs`, `wizard_transcripts`, en `wizard_outreach`; machtigingsaudits zijn rijen in de `events`
tabel met type `wizard-power`. De optionele LLM API-sleutel is AES-256-GCM versleuteld met de `SESSION_SECRET` van het panel, normaal gesproken opgeslagen als `${DATA_DIR_HOST}/.session-secret`.

Maak een back-up van de database en stop het panel voordat u direct SQLite-bewerkingen uitvoert, zodat de WAL veilig wordt afgehandeld.
Het gebruik van de admin UI/API heeft de voorkeur omdat deze validatie en encryptie toepast. Houd de
`panel.db`, `panel.db-wal`, en `panel.db-shm` bestanden bij elkaar bij het kopiëren van een live database.
