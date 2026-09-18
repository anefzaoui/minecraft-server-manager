---
title: 'Chatbot per Minecraft-server'
description: 'Denne forken legger til en administrator-konfigurert chatbot til hver administrerte Minecraft-server.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/chatbot.md'
---

[← Tilbake til dokumentindeks](/docs/)

Denne forken legger til en admin-konfigurert chatbot til hver administrerte Minecraft-server. Den kobler seg til en
OpenAI-kompatibel chat-completions-endepunkt, inkludert Ollama på en annen LAN-vert. Hver server har
sitt eget endepunkt, modell, invokasjonsnavn, persona, transkripsjonspolicy, oppsøkende meldinger og maktpolicy. Standardinvokasjonen er `@wizard`, og standardpersonaen demonstrerer en eldgammel,
leken trollmann i spillet; begge kan redigeres.

![Chatbot-innstillinger](/docs/images/integrations-chatbot.png)

## Spillerens opplevelse

- Enhver spiller kan bruke `@wizard <melding>` (eller den konfigurerte invokasjonen) for samtale og
  deterministisk, Minecraft-versjonsbevisst vanilla oppskriftshjelp.
- Meldingshilsener ved tilkobling og en konfigurerbar engangs-spillsjekk minner spillere om at chatboten er
  tilgjengelig. `@wizard chat` åpner et kort samtykkebasert samtalevindu; `@wizard bye` lukker det.
- **Grunnleggende brukere** kan aktivere aktiverte selv-/verdensmakter. **Maktkontrollere** kan aktivere separat
  validerte handlinger som påvirker en annen online spiller. Spillere i ingen av gruppene forblir
  kun for samtale.
- Grunnleggende brukeres selvgaver bruker en tillatt liste for gjenstander. Kontrollere kan gi en annen spiller enhver gyldig
  navneromsbasert vanilla eller modifisert gjenstand, underlagt mengdebegrensningen og andre maktsikkerhetstiltak.

![Chatbot-transkripsjoner](/docs/images/chatbot-transcripts.png)

## Design og sikkerhet

Konfigurasjon og transkripsjoner er kun for administratorer. Modellen mottar aldri rå RCON eller vilkårlig
kommandoeksekvering. En melding eksponerer kun det ene faste verktøyet som samsvarer med dens eksplisitte intensjon;
serverkoden validerer autorisasjon, argumenter, flagg, mengder, nedkjølingstider og nøyaktige online spillernavn
før den utfører en eksisterende tjenesteoperasjon. Minecraft-velgere avvises, kryssspillerhandlinger kan ikke målrette den som kalte, makter starter i tørrkjøringsmodus, og hver forsøkte makt blir revidert. Støttede verktøykallende modeller faller tilbake til kun samtale.

Svar er begrenset for Minecraft-chat. Kjente vanilla oppskrifter kommer fra medfølgende versjonsbaserte oppskriftsdata og gjengis som stabile 2x2/3x3 rader; LLM-en stoles ikke på til å finne opp oppskriftslayout. Ukjente eller modifiserte oppskrifter henviser spilleren til JEI/REI i stedet for å fabrikkere et svar.

## Hovedimplementasjonsfiler

- `src/services/wizard.js`: per-server konfigurasjon, OpenAI-kompatible forespørsler, chatthåndtering,
  oppsøkende virksomhet, transkripsjonsbevaring og svargrenser.
- `src/services/wizardPowers.js`: rolle-sjekker, intensjonsspesifikke verktøyskjemaer, validering, eksekvering,
  nedkjølingstider og maktrevisjon.
- `src/services/wizardRecipes.js`: deterministisk versjonsbasert oppskriftsoppslag og rutenettformatering. Oppskrift
  og gjenstandsdata kommer fra den medfølgende [`minecraft-data`](https://github.com/PrismarineJS/minecraft-data)
  pakken. (Et tidligere utkast av dette dokumentet pekte på en `src/data/recipes/` mappe som aldri ble
  innsjekket; det finnes ingen slik mappe, og dataene ligger i pakken. Se "Avhengighetsfotavtrykk".)
- `src/analytics/ingest.js`: videresender parsede tilkoblinger, frakoblinger og spillerchatter til chatboten.
- `src/web/routes/wizard.js`, `public/js/pages/integrations.js`, og
  `views/partials/server/integrations.hbs`: admin API og per-server Integrasjons-UI.
- `src/db/migrations/011_wizard_chat.js` til `019_wizard_power_controllers.js`: vedvarende skjema.
- `test/wizard.test.js`: autorisasjon, verktøy-grenser, oppbevaring, oppsøkende virksomhet og chatteatferdstester.

De interne `wizard`-rute-/modul-/tabellnavnene beholdes for oppgraderings- og API-kompatibilitet;
"chatbot" er produkttermen som vendes mot brukeren. Tilsvarende mapper `power_testers_json`-feltet til
UI-ens gruppe **Grunnleggende brukere**.

## Avhengighetsfotavtrykk (`minecraft-data`)

Oppskriftshjelp bruker `minecraft-data`-pakken. Den er stor på disk (omtrent 429 MB installert), og den
leveres inne i produksjonsimaget fordi det er en kjøretidsavhengighet, ikke en utviklingsavhengighet. Vi beholder den
med vilje slik at oppskriftshjelp fungerer offline for hver Minecraft-utgivelse uten nettverkskall.

Merknader for den som ser på dette neste (menneske eller AI), slik at størrelsen ikke blir en overraskelse:

- Kun Java (`pc`)-data brukes for øyeblikket. `wizardRecipes.js` leser `minecraftData.versions.pc`
  og per-versjons `recipes`, `items` og `blocks` tabellene. Filene den faktisk berører utgjør
  omtrent 15 MB på tvers av alle pc-versjoner.
- Rundt 330 MB av pakken er `data/bedrock`, og ingenting her leser det ennå. Vi lar den ligge
  på plass med vilje. Hvis panelet noen gang legger til Bedrock Minecraft-støtte, er Bedrock oppskrifts- og gjenstandsdataene
  allerede her, så oppskriftsfunksjonen kan vokse til å dekke Bedrock-servere uten å legge til en ny
  avhengighet. Start fra `minecraftData.versions.bedrock` og følg samme form som pc-stien.
- Hvis størrelsen noen gang må reduseres før Bedrock-støtte kommer, finnes det allerede et mønster for det
  i dette depotet. `src/services/itemRegistry.js` henter `minecraft-data`-filer fra jsDelivr CDN
  når den trenger dem og cacher dem i `api_cache`. Enten den tilnærmingen, eller en liten håndplukket
  `src/data/recipes/`-undergruppe som dekker noen vanlige versjoner, ville krympe imaget mye.

## Lokal lagring og manuell inspeksjon

Alle innstillinger og beholdte transkripsjoner ligger i panel-SQLite-databasen på `/data/panel.db` inne
i panelcontaineren. Med standard Compose-montering er vertsbanen
`${DATA_DIR_HOST}/panel.db` (for eksempel `/opt/msm/data/panel.db`). Relevante tabeller er
`wizard_configs`, `wizard_transcripts` og `wizard_outreach`; maktrevisjoner er rader i `events`
tabellen med type `wizard-power`. Den valgfrie LLM API-nøkkelen er AES-256-GCM-kryptert ved bruk av panelets
`SESSION_SECRET`, normalt vedvarende som `${DATA_DIR_HOST}/.session-secret`.

Sikkerhetskopier databasen og stopp panelet før direkte SQLite-redigeringer slik at WAL-filen håndteres trygt.
Bruk av admin-UI/API foretrekkes fordi det bruker validering og kryptering. Hold
`panel.db`, `panel.db-wal` og `panel.db-shm` filene samlet når du kopierer en live database.
