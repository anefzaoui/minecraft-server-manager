---
title: 'Minecraft-chatbot per server'
description: 'Het paneel biedt een door de beheerder geconfigureerde chatbot voor elke beheerde Minecraft-server, ingesteld via het tabblad Instellingen → Chatbot van de server.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/chatbot.md'
---

[← Terug naar de documentatie-index](/docs/)

Het paneel biedt een door de beheerder geconfigureerde chatbot voor elke beheerde Minecraft-server, ingesteld op het tabblad **Instellingen → Chatbot** van de server. Het maakt verbinding met een
OpenAI-compatibele chat-completions-endpoint, inclusief Ollama op een andere LAN-host. Elke server heeft
zijn eigen endpoint, model, aanroepnaam, persona, transcriptiebeleid, outreach-berichten en machtigingsbeleid. De standaardaanroep is `@wizard`, en de standaardpersona demonstreert een oude,
speelse tovenaar in de game; beide zijn bewerkbaar.

![Chatbot-instellingen](/docs/images/integrations-chatbot.png)

## Spelerservaring

- Elke speler kan `@wizard <bericht>` (of de geconfigureerde aanroep) gebruiken voor conversatie en
  deterministische, Minecraft-versiebewuste vanilla receptenhulp.
- Bij het joinen van de server en een configureerbare eenmalige check-in tijdens de speelsessie herinneren spelers eraan dat de chatbot beschikbaar is. `@wizard chat` opent een kort opt-in conversatievenster; `@wizard bye` sluit het.
- **Basisgebruikers** kunnen ingeschakelde zelf-/wereldmachten aanroepen. **Machtcontrollers** kunnen afzonderlijk gevalideerde acties aanroepen die van invloed zijn op een andere online speler. Spelers in geen van beide groepen blijven
  alleen voor conversatie.
- Zelf-geschenken van basisgebruikers maken gebruik van een item-allowlist. Controllers kunnen een andere speler elk geldig genaamd vanilla of gemodificeerd item geven, onderhevig aan de hoeveelheidslimiet en andere machtigingsbeveiligingen.

![Chatbot-transcripties](/docs/images/chatbot-transcripts.png)

## Ontwerp en beveiliging

Configuratie en transcripties zijn alleen voor beheerders. Het model ontvangt nooit ruwe RCON- of willekeurige
opdrachtuitvoering. Een bericht onthult alleen de enkele vaste tool die overeenkomt met de expliciete intentie;
servercode valideert autorisatie, argumenten, vlaggen, hoeveelheden, cooldowns en exacte online
speler namen voordat een bestaande servicebewerking wordt uitgevoerd. Minecraft-selectors worden afgewezen,
acties tussen spelers kunnen de aanroeper niet targeten, machten beginnen in dry-run modus, en elke poging tot machtiging wordt gecontroleerd. Niet-ondersteunde tool-calling modellen vallen terug op alleen conversatie.

Antwoorden zijn beperkt voor Minecraft-chat. Bekende vanilla recepten komen uit gebundelde, versiegebonden receptgegevens en worden weergegeven als stabiele 2x2/3x3 rijen; de LLM wordt niet vertrouwd om receptlay-outs te bedenken. Onbekende of gemodificeerde recepten verwijzen de speler naar JEI/REI in plaats van een antwoord te fabriceren.

## Belangrijkste implementatiebestanden

- `src/services/wizard.js`: per-server configuratie, OpenAI-compatibele verzoeken, chatafhandeling,
  outreach, transcriptiebehoud en antwoordlimieten.
- `src/services/wizardPowers.js`: rolcontroles, intentie-specifieke toolschema's, validatie, uitvoering,
  cooldowns en machtigingsauditing.
- `src/services/wizardRecipes.js`: deterministische versiegebonden receptenopzoeking en rasterformattering. Recept-
  en itemgegevens komen uit het gebundelde [`minecraft-data`](https://github.com/PrismarineJS/minecraft-data)
  pakket. (Een eerdere versie van dit document verwees naar een `src/data/recipes/` map die nooit is
  gecommit; er is geen dergelijke map, en de gegevens bevinden zich in het pakket. Zie "Afhankelijkheidsvoetafdruk".)
- `src/analytics/ingest.js`: stuurt geparseerde joins, leaves en spelerchats door naar de chatbot.
- `src/web/routes/wizard.js`, `public/js/pages/integrations.js`, en
  `views/partials/server/integrations.hbs` (via `chatbot.hbs`): admin API en het per-server
  Instellingen → Chatbot tabblad.
- `src/db/migrations/011_wizard_chat.js`, `013_wizard_invocation_name.js`, `015_wizard_powers.js`,
  `017_wizard_outreach.js`, en `019_wizard_power_controllers.js`: persistente schema's.
- `test/wizard.test.js`: autorisatie, tool-grenzen, retentie, outreach en chatgedragstests.

De interne `wizard` route/module/tabelnamen worden behouden voor upgrade- en API-compatibiliteit;
"chatbot" is de productterm voor de eindgebruiker. Evenzo correspondeert het opgeslagen `power_testers_json` veld met de UI-groep **Basisgebruikers**.

## Afhankelijkheidsvoetafdruk (`minecraft-data`)

Receptenhulp maakt gebruik van het `minecraft-data` pakket. Het is groot op schijf (ongeveer 429 MB geïnstalleerd), en het
wordt meegeleverd in de productie-image omdat het een runtime-afhankelijkheid is, geen dev-afhankelijkheid. We houden het
bewust aan zodat receptenhulp offline werkt voor elke Minecraft-release zonder netwerkoproep.

Opmerkingen voor degene die dit hierna bekijkt (mens of AI), zodat de grootte geen verrassing is:

- Alleen de Java (`pc`) gegevens worden momenteel gebruikt. `wizardRecipes.js` leest `minecraftData.versions.pc`
  en de per-versie `recipes`, `items`, en `blocks` tabellen. De bestanden die het daadwerkelijk aanraakt, tellen op
  tot ongeveer 15 MB over alle pc-versies.
- Ongeveer 330 MB van het pakket is `data/bedrock`, en niets hier leest het nog. We laten het
  bewust staan. Als het paneel ooit Bedrock Minecraft-ondersteuning toevoegt, zijn de Bedrock recept- en itemgegevens
  er al, dus de receptfunctie kan groeien om Bedrock-servers te dekken zonder een nieuwe afhankelijkheid toe te voegen. Begin bij `minecraftData.versions.bedrock` en volg dezelfde structuur als het pc-pad.
- Als de grootte ooit naar beneden moet worden gebracht voordat Bedrock-ondersteuning beschikbaar is, is er al een patroon voor in deze repository. `src/services/itemRegistry.js` haalt `minecraft-data` bestanden op van de jsDelivr CDN
  wanneer het ze nodig heeft en cachet ze in `api_cache`. Ofwel die aanpak, of een kleine, met de hand gekozen
  `src/data/recipes/` subset die een paar veelvoorkomende versies dekt, zou de image aanzienlijk verkleinen.

## Lokale opslag en handmatige inspectie

Alle instellingen en bewaarde transcripties bevinden zich in de paneel SQLite-database op `/data/panel.db` binnen
de paneelcontainer. Met de standaard Compose-mount is het hostpad
`${DATA_DIR_HOST}/panel.db` (bijvoorbeeld `/opt/msm/data/panel.db`). Relevante tabellen zijn
`wizard_configs`, `wizard_transcripts`, en `wizard_outreach`; machtigingsaudits zijn rijen in de `events`
tabel met type `wizard-power`. De optionele LLM API-sleutel is AES-256-GCM versleuteld met de at-rest sleutel van het paneel, `.secret-key` in de datafolder (afzonderlijk van `SESSION_SECRET`).

Maak een back-up van de database en stop het paneel voordat u directe SQLite-bewerkingen uitvoert, zodat de WAL veilig wordt afgehandeld.
Het gebruik van de admin UI/API heeft de voorkeur omdat deze validatie en encryptie toepast. Houd de
`panel.db`, `panel.db-wal`, en `panel.db-shm` bestanden bij elkaar bij het kopiëren van een live database.
