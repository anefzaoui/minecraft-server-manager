---
title: 'Minecraft-chattbot per server'
description: 'Denna fork lägger till en administratörskonfigurerad chattbot till varje hanterad Minecraft-server.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/chatbot.md'
---

[← Tillbaka till dokumentindex](/docs/)

Denna fork lägger till en administratörskonfigurerad chatbot till varje hanterad Minecraft-server. Den ansluter till en
OpenAI-kompatibel chat-completions-slutpunkt, inklusive Ollama på en annan LAN-värd. Varje server har
sin egen slutpunkt, modell, anropsnamn, persona, transkriptionspolicy, uppsökningsmeddelanden och
maktpolicy. Standardanropet är `@wizard`, och standardpersonan demonstrerar en uråldrig,
lekfull trollkarl i spelet; båda är redigerbara.

![Chatbot-inställningar](/docs/images/integrations-chatbot.png)

## Spelupplevelse

- Vilken spelare som helst kan använda `@wizard <meddelande>` (eller det konfigurerade anropet) för konversation och
  deterministisk, Minecraft-versionsmedveten hjälp med vanliga recept.
- Välkomstmeddelanden vid anslutning och en konfigurerbar engångskontroll av spelsessionen påminner spelare om att chatboten är
  tillgänglig. `@wizard chat` öppnar ett kort fönster för konversation med anmälan; `@wizard bye` stänger det.
- **Grundläggande användare** kan anropa aktiverade själv-/världskrafter. **Maktkontrollanter** kan anropa separat
  validerade åtgärder som påverkar en annan online-spelare. Spelare i ingen av grupperna förblir
  endast för konversation.
- Grundläggande användares själv-gåvor använder en tillåten lista för föremål. Kontrollanter kan ge en annan spelare vilket giltigt
  namngivet vanilj- eller moddat föremål som helst, med förbehåll för kvantitetsgränsen och andra kraftskydd.

![Chatbot-transkriptioner](/docs/images/chatbot-transcripts.png)

## Design och säkerhet

Konfiguration och transkriptioner är endast för administratörer. Modellen tar aldrig emot rå RCON eller godtycklig
kommandoexekvering. Ett meddelande exponerar endast det enda fasta verktyget som matchar dess explicita avsikt;
serverkoden validerar auktorisation, argument, flaggor, kvantiteter, nedkylningstider och exakta online-spelarnamn
innan en befintlig tjänsteoperation exekveras. Minecraft-väljare avvisas,
åtgärder mellan spelare kan inte rikta sig mot anroparen, krafter börjar i torrkörningsläge, och varje försök till
makt loggas. Osupportade verktygsanropsmodeller faller tillbaka till endast konversation.

Svar är begränsade för Minecraft-chatt. Kända vaniljrecept kommer från medföljande versionsspecifika receptdata
och renderas som stabila 2x2/3x3 rader; LLM:en litar inte på att uppfinna receptlayouter. Okända eller
moddade recept hänvisar spelaren till JEI/REI snarare än att fabricera ett svar.

## Huvudsakliga implementeringsfiler

- `src/services/wizard.js`: konfiguration per server, OpenAI-kompatibla förfrågningar, chatt-hantering,
  uppsökning, transkriptionslagring och svarsgränser.
- `src/services/wizardPowers.js`: rollkontroller, avsiktspecifika verktygsscheman, validering, exekvering,
  nedkylningstider och loggning av makter.
- `src/services/wizardRecipes.js`: deterministiskt versionsspecifikt receptuppslag och rutnätsformatering. Recept-
  och föremålsdata kommer från det medföljande [`minecraft-data`](https://github.com/PrismarineJS/minecraft-data)
  paketet. (Ett tidigare utkast av detta dokument pekade på en `src/data/recipes/`-mapp som aldrig committades; det finns ingen sådan mapp, och datan finns i paketet. Se "Beroendefotavtryck".)
- `src/analytics/ingest.js`: vidarebefordrar parsade anslutningar, avbrott och spelarchatt till chatboten.
- `src/web/routes/wizard.js`, `public/js/pages/integrations.js`, och
  `views/partials/server/integrations.hbs`: administratörs-API och UI för serverintegreringar.
- `src/db/migrations/011_wizard_chat.js` till `019_wizard_power_controllers.js`: beständig schema.
- `test/wizard.test.js`: tester för auktorisation, verktygsgränser, lagring, uppsökning och chattbeteende.

De interna namnen på `wizard`-rutter/moduler/tabeller behålls för uppgraderings- och API-kompatibilitet;
"chatbot" är den användarvända produkttermen. Likaså mappar fältet `power_testers_json` som lagras till
UI:ns grupp **Grundläggande användare**.

## Beroendefotavtryck (`minecraft-data`)

Recept-hjälp använder paketet `minecraft-data`. Det är stort på disk (cirka 429 MB installerat), och det
levereras inuti produktionsavbildningen eftersom det är ett körtidsberoende, inte ett utvecklingsberoende. Vi behåller det
med flit så att recept-hjälp fungerar offline för varje Minecraft-utgåva utan nätverksanrop.

Anteckningar för den som tittar på detta härnäst (människa eller AI), så att storleken inte blir en överraskning:

- Endast Java (`pc`) data används just nu. `wizardRecipes.js` läser `minecraftData.versions.pc`
  och tabellerna `recipes`, `items` och `blocks` per version. Filerna den faktiskt rör vid uppgår till
  ungefär 15 MB över alla pc-versioner.
- Cirka 330 MB av paketet är `data/bedrock`, och inget här läser det ännu. Vi lämnar det kvar
  med flit. Om panelen någonsin lägger till stöd för Bedrock Minecraft, finns Bedrock-recept- och föremålsdata
  redan här, så receptfunktionen kan växa för att täcka Bedrock-servrar utan att lägga till ett nytt
  beroende. Börja från `minecraftData.versions.bedrock` och följ samma form som pc-vägen.
- Om storleken någonsin måste minskas innan Bedrock-stöd lanseras, finns det redan ett mönster för det
  i detta repo. `src/services/itemRegistry.js` hämtar `minecraft-data`-filer från jsDelivr CDN
  när den behöver dem och cachar dem i `api_cache`. Antingen den metoden, eller en liten handplockad
  `src/data/recipes/`-undergrupp som täcker några vanliga versioner, skulle krympa avbildningen avsevärt.

## Lokal lagring och manuell inspektion

Alla inställningar och lagrade transkriptioner finns i panelens SQLite-databas på `/data/panel.db` inuti
panelbehållaren. Med standard Compose-montering är värdvägen
`${DATA_DIR_HOST}/panel.db` (till exempel `/opt/msm/data/panel.db`). Relevanta tabeller är
`wizard_configs`, `wizard_transcripts`, och `wizard_outreach`; maktloggar är rader i tabellen `events`
med typen `wizard-power`. Den valfria LLM API-nyckeln är AES-256-GCM-krypterad med hjälp av panelens
`SESSION_SECRET`, normalt beständig som `${DATA_DIR_HOST}/.session-secret`.

Säkerhetskopiera databasen och stoppa panelen innan direkta SQLite-redigeringar så att dess WAL hanteras säkert.
Att använda administratörs-UI/API föredras eftersom det tillämpar validering och kryptering. Behåll
filerna `panel.db`, `panel.db-wal`, och `panel.db-shm` tillsammans när du kopierar en live-databas.
