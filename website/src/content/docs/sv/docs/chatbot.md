---
title: 'Chatbot per Minecraft-server'
description: 'Panelen erbjuder en administratörskonfigurerad chatbot för varje hanterad Minecraft-server, inställd under serverns flik Inställningar → Chatbot.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/chatbot.md'
---

[← Tillbaka till dokumentindex](/docs/)

Panelen erbjuder en administratörskonfigurerad chatbot för varje hanterad Minecraft-server, inställd under fliken **Inställningar → Chatbot** på servern. Den ansluter till en OpenAI-kompatibel chat-completions-slutpunkt, inklusive Ollama på en annan värd i LAN-nätverket. Varje server har sin egen slutpunkt, modell, anropsnamn, persona, transkriptionspolicy, utåtriktade meddelanden och befogenhetspolicy. Standardanropet är `@wizard`, och standardpersonan demonstrerar en uråldrig, lekfull trollkarl i spelet; båda är redigerbara.

![Chatbot-inställningar](/docs/images/integrations-chatbot.png)

## Spelupplevelse

- Vilken spelare som helst kan använda `@wizard <meddelande>` (eller det konfigurerade anropet) för konversation och deterministiskt, Minecraft-versionsmedvetet hjälp med vanliga recept.
- Välkomstmeddelanden vid anslutning och en konfigurerbar engångskontroll av spelsessionen påminner spelare om att chatboten är tillgänglig. `@wizard chat` öppnar ett kort fönster för anmälan; `@wizard bye` stänger det.
- **Grundläggande användare** kan anropa aktiverade själv-/världsbefogenheter. **Befogenhetskontrollanter** kan anropa separat validerade åtgärder som påverkar en annan online-spelare. Spelare i ingen av grupperna förblir endast för konversation.
- Grundläggande användares själv-gåvor använder en tillåten lista för föremål. Kontrollanter kan ge en annan spelare vilket giltigt namnutrymme som helst för vanliga eller modifierade föremål, beroende på kvantitetsgränsen och andra befogenhetsskydd.

![Chatbot-transkriptioner](/docs/images/chatbot-transcripts.png)

## Design och säkerhet

Konfiguration och transkriptioner är endast för administratörer. Modellen tar aldrig emot rå RCON eller godtycklig kommandokörning. Ett meddelande exponerar endast det enda fasta verktyget som matchar dess explicita avsikt; serverkod validerar auktorisering, argument, flaggor, kvantiteter, nedkylningstider och exakta online-spelarnamn innan en befintlig tjänsteoperation utförs. Minecraft-väljare avvisas, korsspelaråtgärder kan inte rikta sig mot anroparen, befogenheter börjar i torrkörningsläge, och varje försök till befogenhet loggas. Ounderstödda verktygsanropsmodeller återgår till endast konversation.

Svar är begränsade för Minecraft-chatt. Kända vanliga recept kommer från medföljande versionsspecifika receptdata och renderas som stabila 2x2/3x3 rader; LLM:en litar inte på att hitta på receptlayouter. Okända eller modifierade recept hänvisar spelaren till JEI/REI snarare än att fabricera ett svar.

## Huvudsakliga implementeringsfiler

- `src/services/wizard.js`: konfiguration per server, OpenAI-kompatibla förfrågningar, chatt-hantering, utåtriktade meddelanden, transkriptionslagring och svarsgränser.
- `src/services/wizardPowers.js`: rollkontroller, avsiktspecifika verktygsscheman, validering, körning, nedkylningstider och loggning av befogenheter.
- `src/services/wizardRecipes.js`: deterministiskt versionsspecifikt receptuppslag och rutnätsformatering. Recept- och föremålsdata kommer från det medföljande paketet [`minecraft-data`](https://github.com/PrismarineJS/minecraft-data). (Ett tidigare utkast av detta dokument pekade på en `src/data/recipes/`-mapp som aldrig checkades in; det finns ingen sådan mapp, och datan finns i paketet. Se "Beroendefotavtryck".)
- `src/analytics/ingest.js`: vidarebefordrar parsade anslutningar, frånkopplingar och spelarchatt till chatboten.
- `src/web/routes/wizard.js`, `public/js/pages/integrations.js`, och `views/partials/server/integrations.hbs` (via `chatbot.hbs`): administratörs-API och fliken Inställningar → Chatbot per server.
- `src/db/migrations/011_wizard_chat.js`, `013_wizard_invocation_name.js`, `015_wizard_powers.js`, `017_wizard_outreach.js`, och `019_wizard_power_controllers.js`: beständig schema.
- `test/wizard.test.js`: tester för auktorisering, verktygsgränser, lagring, utåtriktade meddelanden och chattbeteende.

De interna `wizard`-routnings-/modul-/tabellnamnen behålls för uppgraderings- och API-kompatibilitet; "chatbot" är den användarvända produkttermen. Likaså mappar fältet `power_testers_json` som lagras till grupperingen **Grundläggande användare** i gränssnittet.

## Beroendefotavtryck (`minecraft-data`)

Recept-hjälp använder paketet `minecraft-data`. Det är stort på disk (cirka 429 MB installerat), och det levereras inuti produktionsbilden eftersom det är ett körtidsberoende, inte ett utvecklingsberoende. Vi behåller det avsiktligt så att recept-hjälp fungerar offline för varje Minecraft-utgåva utan nätverksanrop.

Anteckningar för den som tittar på detta härnäst (människa eller AI), så att storleken inte kommer som en överraskning:

- Endast Java (`pc`)-data används just nu. `wizardRecipes.js` läser `minecraftData.versions.pc` och de versionsspecifika tabellerna `recipes`, `items` och `blocks`. Filerna som den faktiskt rör vid uppgår till ungefär 15 MB över alla pc-versioner.
- Cirka 330 MB av paketet är `data/bedrock`, och inget här läser det ännu. Vi lämnar det på plats avsiktligt. Om panelen någonsin lägger till stöd för Bedrock Minecraft, finns Bedrock-recept- och föremålsdata redan här, så receptfunktionen kan växa för att täcka Bedrock-servrar utan att lägga till ett nytt beroende. Börja från `minecraftData.versions.bedrock` och följ samma form som pc-sökvägen.
- Om storleken någonsin måste minskas innan Bedrock-stöd kommer, finns det redan ett mönster för det i detta repo. `src/services/itemRegistry.js` hämtar `minecraft-data`-filer från jsDelivr CDN när den behöver dem och cachar dem i `api_cache`. Antingen det tillvägagångssättet, eller en liten handplockad `src/data/recipes/`-undergrupp som täcker några vanliga versioner, skulle krympa bilden avsevärt.

## Lokal lagring och manuell inspektion

Alla inställningar och lagrade transkriptioner finns i panelens SQLite-databas på `/data/panel.db` inuti panelcontainern. Med standard Compose-monteringen är värdsökvägen `${DATA_DIR_HOST}/panel.db` (till exempel `/opt/msm/data/panel.db`). Relevanta tabeller är `wizard_configs`, `wizard_transcripts` och `wizard_outreach`; befogenhetsloggar är rader i tabellen `events` med typen `wizard-power`. Den valfria LLM API-nyckeln är AES-256-GCM-krypterad med panelens vilande nyckel, `.secret-key` i datamappen (skild från `SESSION_SECRET`).

Säkerhetskopiera databasen och stoppa panelen före direkta SQLite-redigeringar så att dess WAL hanteras säkert. Att använda administratörsgränssnittet/API:et är att föredra eftersom det tillämpar validering och kryptering. Behåll filerna `panel.db`, `panel.db-wal` och `panel.db-shm` tillsammans när du kopierar en live-databas.
