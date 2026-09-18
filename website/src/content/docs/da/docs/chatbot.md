---
title: 'Chatbot pr. Minecraft-server'
description: 'Denne fork tilføjer en admin-konfigureret chatbot til hver administreret Minecraft-server.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/chatbot.md'
---

[← Tilbage til dokumentindeks](/docs/)

Denne fork tilføjer en admin-konfigurerbar chatbot til hver administreret Minecraft-server. Den forbinder til et
OpenAI-kompatibelt chat-completions-endepunkt, herunder Ollama på en anden LAN-vært. Hver server har
sit eget endepunkt, model, invocationsnavn, persona, transskriptionspolitik, opsøgende beskeder og
strømpolitik. Standardinvokationen er `@wizard`, og standardpersonaen demonstrerer en ældgammel,
legende troldmand i spillet; begge kan redigeres.

![Chatbot-indstillinger](/docs/images/integrations-chatbot.png)

## Spilleroplevelse

- Enhver spiller kan bruge `@wizard <besked>` (eller den konfigurerede invokation) til samtale og
  deterministisk, Minecraft-versionsbevidst vanilla opskriftshjælp.
- Velkomstbeskeder ved tilslutning og en konfigurerbar engangs-check-in minder spillere om, at chatbotten er
  tilgængelig. `@wizard chat` åbner et kort opt-in samtalevindue; `@wizard bye` lukker det.
- **Grundlæggende brugere** kan invokere aktiverede selv-/verdenskræfter. **Power controllers** kan invokere separat
  validerede handlinger, der påvirker en anden online spiller. Spillere i ingen af grupperne forbliver
  kun til samtale.
- Grundlæggende brugeres selv-gaver bruger en tilladt liste over genstande. Controllers kan give en anden spiller enhver gyldig
  navngivet vanilla eller modded genstand, underlagt mængdebegrænsningen og andre strømsikkerhedsforanstaltninger.

![Chatbot-transskriptioner](/docs/images/chatbot-transcripts.png)

## Design og sikkerhed

Konfiguration og transskriptioner er kun for administratorer. Modellen modtager aldrig rå RCON eller vilkårlig
kommandoeksekvering. En besked eksponerer kun det enkelte faste værktøj, der matcher dens eksplicitte hensigt;
serverkode validerer autorisation, argumenter, flag, mængder, cooldowns og præcise online spillernavne, før den
udfører en eksisterende serviceoperation. Minecraft-selektorer afvises, krydsspillerhandlinger kan ikke målrette den, der kalder, kræfter starter i dry-run-tilstand, og hver forsøgt kraft logges. Ikke-understøttede værktøjskaldende modeller falder tilbage til kun samtale.

Svar er begrænsede for Minecraft-chat. Kendte vanilla opskrifter kommer fra bundtede versionsspecifikke opskriftsdata og gengives som stabile 2x2/3x3 rækker; LLM'en er ikke betroet til at opfinde opskriftslayouts. Ukendte eller moddede opskrifter henviser spilleren til JEI/REI i stedet for at fabrikere et svar.

## Vigtigste implementeringsfiler

- `src/services/wizard.js`: konfiguration pr. server, OpenAI-kompatible anmodninger, chat-håndtering,
  opsøgende arbejde, transskriptionsopbevaring og svargrænser.
- `src/services/wizardPowers.js`: rolletjek, hensigts-specifikke værktøjsskemaer, validering, udførelse,
  cooldowns og logning af kræfter.
- `src/services/wizardRecipes.js`: deterministisk versionsspecifik opskriftsopslag og gitterformatering. Opskrift
  og genstandsdata kommer fra den bundtede [`minecraft-data`](https://github.com/PrismarineJS/minecraft-data)
  pakke. (Et tidligere udkast til dette dokument pegede på en `src/data/recipes/` mappe, der aldrig blev
  committet; der findes ingen sådan mappe, og dataene ligger i pakken. Se "Afhængighedsaftryk".)
- `src/analytics/ingest.js`: videresender parsede joins, leaves og spillerchat til chatbotten.
- `src/web/routes/wizard.js`, `public/js/pages/integrations.js`, og
  `views/partials/server/integrations.hbs`: admin API og UI for integrationer pr. server.
- `src/db/migrations/011_wizard_chat.js` til `019_wizard_power_controllers.js`: persistent skema.
- `test/wizard.test.js`: tests for autorisation, værktøjsgrænser, opbevaring, opsøgende arbejde og chatadfærd.

De interne `wizard`-rute/modul/tabelnavne bevares for opgraderings- og API-kompatibilitet;
"chatbot" er den brugerrettede produktterm. Ligeledes svarer det gemte `power_testers_json`-felt til
UI'ens **Grundlæggende brugere** gruppe.

## Afhængighedsaftryk (`minecraft-data`)

Opskriftshjælp bruger `minecraft-data` pakken. Den er stor på disken (ca. 429 MB installeret), og den
leveres inde i produktionsbilledet, fordi det er en runtime-afhængighed, ikke en udviklingsafhængighed. Vi beholder den
med vilje, så opskriftshjælp fungerer offline for enhver Minecraft-udgivelse uden netværkskald.

Noter til den, der ser på dette næste gang (menneske eller AI), så størrelsen ikke kommer som en overraskelse:

- Kun Java (`pc`) data bruges lige nu. `wizardRecipes.js` læser `minecraftData.versions.pc`
  og de versionsspecifikke `recipes`, `items` og `blocks` tabeller. Filerne, den rent faktisk rører ved, udgør
  ca. 15 MB på tværs af alle pc-versioner.
- Omkring 330 MB af pakken er `data/bedrock`, og intet her læser det endnu. Vi lader det være
  på plads med vilje. Hvis panelet nogensinde tilføjer Bedrock Minecraft-understøttelse, er Bedrock opskrift og genstandsdata
  allerede her, så opskriftsfunktionen kan udvides til at dække Bedrock-servere uden at tilføje en ny
  afhængighed. Start fra `minecraftData.versions.bedrock` og følg samme struktur som pc-stien.
- Hvis størrelsen nogensinde skal reduceres, før Bedrock-understøttelse lander, er der allerede et mønster for det
  i dette repo. `src/services/itemRegistry.js` henter `minecraft-data` filer fra jsDelivr CDN,
  når den har brug for dem, og cacher dem i `api_cache`. Enten den tilgang, eller en lille håndplukket
  `src/data/recipes/` delmængde, der dækker et par almindelige versioner, ville reducere billedet meget.

## Lokal lagring og manuel inspektion

Alle indstillinger og gemte transskriptioner ligger i panellets SQLite-database på `/data/panel.db` inde i
panelcontaineren. Med standard Compose-mountet er host-stien
`${DATA_DIR_HOST}/panel.db` (f.eks. `/opt/msm/data/panel.db`). Relevante tabeller er
`wizard_configs`, `wizard_transcripts` og `wizard_outreach`; power audits er rækker i `events`
tabellen med typen `wizard-power`. Den valgfrie LLM API-nøgle er AES-256-GCM krypteret ved hjælp af panelets
`SESSION_SECRET`, normalt persisteret som `${DATA_DIR_HOST}/.session-secret`.

Sikkerhedskopier databasen og stop panelet før direkte SQLite-redigeringer, så dens WAL håndteres sikkert.
Brug af admin UI/API foretrækkes, da det anvender validering og kryptering. Behold
`panel.db`, `panel.db-wal` og `panel.db-shm` filerne samlet, når du kopierer en live database.
