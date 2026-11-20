---
title: 'Arkitektur'
description: 'Minecraft Server Manager er en enkeltprosess, server-rendret Node.js-applikasjon.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/architecture.md'
---

[← Tilbake til dokumentindeks](/docs/)

Minecraft Server Manager er en enkeltprosess, server-rendret Node.js-applikasjon. Den administrerer
Minecraft-servere som kjører som Docker-containere ved hjelp av
[itzg/docker-minecraft-server](https://github.com/itzg/docker-minecraft-server)-imaget, og kommuniserer med
Docker-daemonen via API-et (aldri ved å kjøre `docker` CLI fra skallet).

## Kjøretidsstruktur

- **Express + Handlebars** rendrer sider på serversiden. Det er ingen SPA; nettleser-JS i `public/js/`
  er håndskrevet progressiv forbedring. Et esbuild-steg (`pnpm run build:js`) pakker og
  minifiserer det til `public/dist/js/`; appen serverer den pakken når den er til stede og den rå
  kilden ellers, så en utviklingskjøring uten bygg fortsatt fungerer.
- **`node:sqlite`** (innebygd i Node; panelet krever Node ≥ 24) er databasen - synkron,
  null native moduler, WAL-modus. En liten versjonsmigreringskjører bruker `src/db/migrations/*` ved
  oppstart. Forberedte utsagn caches i `src/db/index.js` med SQL-teksten som nøkkel.
- **`ws`** bærer live konsoll- og statistikkstrømmene. Begge er **meglet**: én oppstrøms
  `docker logs --follow` (eller `docker stats`) per server, demultipleksert én gang og fordelt til hver
  tilkoblede fane, snarere enn én oppstrøms per seer. Konsollmegleren holder en liten avspillingsbuffer
  for sent-tilkoblede faner og dropper en abonnent hvis socket faller for langt bak, i stedet for
  å stanse den delte strømmen.
- **dockerode** er den eneste måten appen snakker med Docker på. Endepunktet oppdages automatisk per plattform
  (Windows navngitt pipe vs. unix socket).
- **All persistent lagring lever under én mappe** (`$DATA_DIR`, standard `./data`). Kopiering av den
  mappen migrerer hele panelet.

## Lagdeling

Avhengigheter flyter i én retning:

```
                 ┌─────────────────────────────┐
   HTTP  ───────▶│  web/routes/*  (+ middleware)│   parse & valider input, formater svar
                 └──────────────┬──────────────┘
                                │
                 ┌──────────────▼──────────────┐
                 │         services/*          │   domenerlogikk (de faktiske funksjonene)
                 └───┬─────────┬─────────┬─────┘
                     │         │         │
        ┌────────────▼──┐ ┌────▼────┐ ┌──▼──────────┐
        │   docker/*    │ │  db/*   │ │  storage/*  │   infrastruktur
        └───────────────┘ └─────────┘ └─────────────┘
```

- **`web/routes/`** - én ruter per domene (`players`, `worlds`, `crashes`, `blueprints`, `files`, …).
  `web/app.js` monterer toppnivårutene (`api.js`, den JSON API-en for sesjoner som også inneholder kjerne-
  serverrutene og monterer domenerutene per server; `index.js`, sidene; `auth`, `account`,
  `tasks`, …). Ruter validerer med zod, kaller en tjeneste, og returnerer JSON
  eller rendrer en visning. Forretningslogikk hører ikke hjemme her. To ruter er montert i **offentlig sone**,
  før `requireAuth`: `routes/status.js` (valgfrie HTML-statusider per server) og
  `routes/apiV1.js` (`/api/v1`, en skrivebeskyttet JSON API autentisert av en admin-generert Bearer-token
  fra `services/apiTokens.js`, deaktivert med mindre aktivert i Innstillinger; se `docs/public-api.md`).
- **`services/`** - hjertet av appen. Hver tjeneste eier ett domene og kan avhenge av
  infrastruktur og andre tjenester.
- **`docker/`** - dockerode-innpakninger: `connect` (endepunkt-deteksjon + daemon-helse), `containers`
  (opprett/start/stopp/gjenskap med bind-monteringer, minne/CPU-grenser og etiketter), `logs`, `stats`,
  `images`, `networks` (oppdagelse av vertsnettverk), `hostPath` (omroter bind-stier under
  `DATA_DIR_HOST`), og en `watcher` som gjør Docker-hendelser om til historikk + krasjdeteksjon.
- **`db/`** - SQLite-innpakningen og migreringskjører.
- **`storage/`** - `./data`-oppstarten, **sti-vakten** (`safeJoin`, ryggraden for filsikkerhet), og
  bakgrunnsstørrelsesindeksereren + kvotehåndhevelse.

Tverrgående:

- **`config/`** - miljøkonfigurasjon pluss **feltkatalogen**: den eneste sannhetskilden for
  serverinnstillinger. Hver itzg-miljøvariabel er katalogisert (etikett, hjelp, type, enhet, standard,
  validering, seksjon, fareflagg). Veiviseren, innstillingsskjemaene og zod-valideringen er alle avledet
  fra den, så å eksponere en ny innstilling er en dataendring, ikke ny UI-plumbing.
- **`events/`** - `recordEvent()` er det ene inngangspunktet for historikkl লগgen; livssyklushendelser fanger også
  utdrag fra container-logger til `data/logs/<id>/events/`.
- **`ws/`** - autentiserte konsoll + statistikk WebSockets (sesjonsinformasjonskapsel verifisert ved oppgradering, `Origin`
  sjekket for å blokkere cross-site hijacking), meglet per server (se "Kjøretidsstruktur").
- **`logger.js` + `instrument.js`** - `require('./logger')(label)` returnerer en per-modul
  [Pino](https://getpino.io)-logger; nivå fra `LOG_LEVEL`, `makeFailureThrottle()` holder en
  vedvarende feilende bakgrunnssløyfe til én logglinje pluss en "gjenopprettet" linje.
  `src/utils/logSanitize.js` fjerner kreditorsformede nøkler og webhook-tokens fra den strukturerte
  metadataen; `src/config/logLevel.js` er den delte nivåtillatelseslisten (holdt separat for å unngå en
  krev-syklus med `config`). `src/instrument.js` er en sovende Sentry-søm, lastet først i
  `src/server.js`. `src/web/middleware/requestLog.js` skriver én tilgangslogglinje per forespørsel
  (hopper over `/healthz` og statiske ressurser). ESLint håndhever `no-console` under `src/**`, med
  `preflight.js`, `instrument.js`, og `config/index.js` unntatt (de kjører før logeren eksisterer).
- **Hastighetsbegrensning** - `src/web/middleware/rateLimit.js` plasserer `express-rate-limit` foran `/api`
  (`RATE_LIMIT_API_PER_MIN`, standard 1200) og innloggings- / 2FA- / oppsetts-POST-ene
  (`RATE_LIMIT_AUTH_PER_15MIN`, standard 100); `0` deaktiverer en begrenser. Den bruker `req.ip` som nøkkel, så
  `TRUST_PROXY` er viktig bak en proxy. `/api/v1` har sine egne begrensere: en per-klient-IP-grense
  (fem ganger per-token-budsjettet) som kjører før tokenet er verifisert, deretter et per-token
  budsjett (`RATE_LIMIT_PUBLIC_API_PER_MIN`, standard 120) nøklet på ID-en til det verifiserte tokenet. En
  separat per-konto myk teller i
  `src/web/middleware/auth.js` håndterer innloggingslåsing (per-IP og konto-globalt, avtagende).
- **Autorisasjon**: to lag. Den globale rollen (`requireAuth` → `requireRole` / `requireWrite` i
  `src/web/middleware/auth.js`) kontrollerer panel-omfattende handlinger og er standarden på hver server. Per-server
  tillatelser (`src/services/permissions.js`, ni kapabiliteter lagret som en JSON-liste per
  `(bruker, server)` i `user_server_permissions`) finjusterer den standarden for én server; hver
  `/api/servers/:id`-rute, sub-ruter, side, WebSocket og flåteomfattende liste går gjennom
  `src/web/middleware/serverAccess.js` (`serverScope`, montert på `/servers/:id`-prefikset til både
  API-et og ruter-siden, skjuler en server uten `view` som en 404; `requireCap(cap)` navngir
  kapabiliteten en rute trenger). Skrivinger som navngir serveren sin i kroppen (planer, verdensuttrekk og
  installasjon, blueprint-eksport) åpnes for seere kun av `requireWrite` for den serveren, og hver
  slik rute sjekker kapabiliteten selv. `test/permissions-routes.test.js` går gjennom de levende ruter-stablene og feiler hvis en server-omfanget skrive-rute, montering eller side mangler en port.

## Nøkkeldomeneatferd

- **Modpacks er alltid festet.** Imaget oppgraderer automatisk upinnede pakker ved hver omstart, så
  panelet løser "latest" til en konkret versjons-ID ved installasjonstidspunktet og fester den. Oppgraderinger er en
  eksplisitt orkestrert flyt (`updates/`): forhåndsvisning → sikkerhetskopi før oppdatering → grasiøs stopp → fest på nytt →
  gjenskap → helseovervåking → ett-klikks tilbakestilling.
- **Overlegget for egendefinerte modifikasjoner** administreres av panelet: bruker-tilføyde modifikasjoner lander i det dedupliserte biblioteket og
  blir hardkoblet inn i serveren slik at de overlever pakkeoppdateringer. Deaktivering er klassebevisst. Fordi
  biblioteket beholder hver byggeversjon det har lastet ned, registrerer en oppdatering byggeversjonen den erstattet
  (`server_content.previous_*`) og kan rulles tilbake fra lokale filer alene. Deaktivering av en pakke-mod
  skriver pakkens ekskluderingsmiljøvariabel i stedet; `packs.applyPack` bærer den og resten av
  pakkejusteringen (`PACK_TUNING_KEYS`) over en versjonsendring av samme pakke, og dropper den når
  pakken endres.
- **En oppgradering av Minecraft-versjon må fortjenes.** `services/compat.js` skanner serverens modifikasjoner -
  løst fra panel-installerte rader, deretter CurseForge-pakkemanifestet, deretter etter innholds-hash
  mot Modrinth/CurseForge - og bygger en støttematrise (laster, Minecraft-versjon) per prosjekt
  ut av CurseForges `latestFilesIndexes` (200 prosjekter per forespørsel) og Modrinths per-prosjekt
  versjonsliste (én forespørsel per prosjekt, som holder laster og versjon paret). Oppdateringssjekkeren tilbyr kun den nyeste versjonen ALLE modifikasjoner støtter, og tilbyr ingenting i det hele tatt når svaret ikke kan fastslås: ingen skanning, en skanning for en annen versjon eller laster, en som aldri ble ferdig, eller en jar som ingen av registrene gjenkjenner. Skanninger er kun manuelle, og deres fremdrift og delvise resultater lever i `version_compat` (ikke i minnebaserte `services/tasks.js`), så en oppdatering eller en panel-omstart gjenopptar i stedet for å henge på en spinner; `reconcileScans()` markerer skanninger som foreldreløse ved en nedstengning ved neste oppstart.
- **Modlasterversjonen er en pin, som alt annet.** `services/loaderPin.js` leser den installerte byggeversjonen fra
  imagets eget installasjonsmanifest (`.forge-manifest.json` og lignende) og skriver pinnen: lasterens itzg-variabel på en vanlig server (`FORGE_VERSION`, …), eller
  `CF_MOD_LOADER_VERSION` på en CurseForge-pakke for Forge eller Fabric, som overstyrer versjonen pakken
  deklarerer. Imagets CurseForge-installatør ignorerer den overstyringen for NeoForge, og Modrinth
  og FTB-pakker har ingen, så deres laster følger pakken. `packs.applyPack` fjerner alle `CF_`-variabler ved en pakkeoppdatering eller tilbakestilling, som fjerner en overstyring med resten. En typet byggeversjon sjekkes mot registrets fulle liste først (`services/loaderVersions.js`; Forges kommer fra
  dens maven-metadata, som hopper over tall; et bom blir sjekket på nytt én gang mot selve registeret),
  deretter er endringen sikkerhetskopi → pin (over env slik den er etter sikkerhetskopien) → gjenoppbygging.
- **Porter** allokeres fra et grunnleggende skjema (spill fra `PORT_GAME_START` og oppover, RCON = spill +
  `PORT_RCON_OFFSET`, Bedrock fra `PORT_BEDROCK_START`), testes for tilgjengelighet, og reserveres i
  databasen. "Opptatt" er unionen av alle serveres krav (live porter, pluss et ventende par nedenfor),
  hver vertsport enhver Docker-container publiserer (`containers.publishedHostPorts`: kjørende
  containeres live-bindinger pluss hver stoppet containers konfigurerte, fordi en OS-bind-test
  fra innsiden av panelets egen container ser kun den containerens nettverksnavnerom), og OS-testen. Docker-delen er cachet i 3 sekunder og begrenset: en liste som ikke svarer på 2,5 sekunder dropper
  kun Docker-delen, og en treg inspeksjon koster kun den containerens porter. Serveropprettelser og
  `servers.changeGamePort` velger porter gjennom én serialiseringskjede som kun dekker valget
  og dets krav (radskrivingen for en opprettelse, minnebasert reservasjon for en portendring);
  BlueMaps portvelger og de ekstra portoverstyringene er ikke i den og
  konsulterer ikke Docker. En portendring på en eksisterende server (`servers.changeGamePort`, under serverens op-lås)
  anvendes umiddelbart, fordi Docker fikser portbindinger ved container-opprettelse:
  det nye paret (RCON alltid spill + `PORT_RCON_OFFSET`) testes og reserveres i minnet
  (`ports.reserve`, både det gamle og det nye paret, respektert av alle andre valg) under port-låsen. Det nektes (409 `PENDING_CHANGES`) mens andre innstillinger venter på en gjenoppbygging, så det gjenoppbygger kun
  en container som allerede har kjørt, på en ny port; og en kjørende server endres kun
  når forespørselen sier `restart: true` (ellers 409 `NEEDS_CONFIRM`). Imaget trekkes ned og et
  egendefinert containernavn sjekkes før noe berøres. En kjørende server stoppes; deretter skrives det nye paret med `pending_recreate = 1` (slik at en panelkrasj derfra etterlater en ærlig "gjenoppbygging venter"), containeren fjernes, gjenoppbygges på det nye paret og startes. Hvis et steg
  etter stoppen feiler, skriver `putBackOnOldPort` det gamle paret tilbake, gjenoppbygger (og starter på nytt, hvis den kjørte) på det og registrerer hvilket steg som feilet; historikk og varsler sier om selv det feilet, noe som etterlater serveren stoppet til noen starter den.
  `settings`-kapabiliteten er nok, inkludert kjørende server. Ikke-administratorer kan kun velge fra `PORT_GAME_START` og oppover.
  (Kolonnene `port_*_pending` fra migrasjon 029 tilhører et tidligere, ikke-utgitt design og er ubrukt; 031 tømmer dem.) En låsekollisjon svarer 409 med `code: 'BUSY'`, som de retrying
  kallerne under sjekker heller enn ordlyden. En automatisk omstart etter krasj
  (`watcher.restartAfterCrash`) og en planlagt sikkerhetskopi eller start (`scheduler.runTaskWithRetry`)
  som finner serveren opptatt med en annen handling, prøver igjen hver 20. sekund / 60. sekund i opptil 30 minutter,
  og en pakkeoppdatering eller tilbakestilling prøver sine låste steg på samme måte (`opLock.retryWhileBusy`);
  en krasj-omstart eller en ventende planlagt start gir opp når noen har stoppet, drept eller
  startet serveren siden (`events.lifecycleActionSince`), og krasj-omstarten også når
  automatisk omstart er av eller serveren er borte. Planlagte omstarter, stopp og kommandoer prøves ikke på nytt, og en plan som sist kjørte fortsatt venter hopper over neste avfyring.
- **Disk-kvoter** håndheves av panelet fordi Docker ikke kan begrense bruken av bind-monteringer: indeksereren
  cacher størrelser per mappe og disk-voksende operasjoner er begrenset av dem.
- **Hemmeligheter** (RCON-passord, API-nøkler, TOTP-hemmeligheter, Discord webhook URL) krypteres
  ved lagring med AES-256-GCM ved hjelp av en dedikert tilfeldig nøkkel på `$DATA_DIR/.secret-key` (modus `0600`,
  automatisk generert). Den er uavhengig av `SESSION_SECRET`; en nøkkel avledet fra `SESSION_SECRET` beholdes som en
  kun-dekrypterings-fallback for verdier skrevet før den dedikerte nøkkelen eksisterte, og
  `src/services/secretsMigration.js` krypterer disse på nytt under den dedikerte nøkkelen én gang ved oppstart.
  En `.secret-key` som eksisterer, men ikke kan parses, er en hard oppstartsfeil (den blir aldri stille
  regenerert over toppen). Blåkopier fjerner alle hemmeligheter ved eksport.
- **`server.properties` eies av panelet, men skygges av miljøvariabler.** itzg-imaget gjeninnfører hver
  miljø-støttet egenskap ved hver start (`OVERRIDE_SERVER_PROPERTIES` standard er sann), så en verdi som
  panelet redigerer direkte - Verden Kontroller PvP/vanskelighetsgrad, hviteliste-bryteren, Filredigereren -
  ville bli stille tilbakestilt ved neste start med mindre den matchende miljøvariabelen fjernes og
  containeren gjenskapes. Hver direkte egenskapsskriving går gjennom `writeServerProperties()` (hele filen)
  eller `setServerProperty()` (én nøkkel) i `src/services/servers.js`, som atomisk skriver om
  filen, fjerner miljøvariabelen bak hver endrede nøkkel (via `prop:`-attributtet på katalogfelter, sjekket i tester mot imagets egne egendefinisjoner), og flagger
  `pending_recreate`. Vanskelighetsgrad skrives til filen så vel som sendt over RCON, fordi en
  dedikert server gjenanvender `difficulty`-egenskapen ved hver oppstart. Minecraft selv lagrer
  server.properties på nytt fra sine oppstartstidsverdier ved `whitelist on/off`, noe som ville angre endringer gjort
  mens serveren kjører, så den kjørende hviteliste-bryteren tar et øyeblikksbilde av filen først og skriver den tilbake
  med kun `white-list` endret. MOTD har samme kontrakt: en direkte
  `motd`-filredigering fjerner den, så siste skriving vinner.

## Data- og wireformater

- **`data/panel.db`** - SQLite-databasen. Sikkerhetskopieres daglig via `VACUUM INTO` til
  `data/backups/_panel/` (nyeste 14 beholdes); `PRAGMA integrity_check` kjører ved oppstart.
- **`data/.session-secret`** - den automatisk genererte hemmeligheten for signering av informasjonskapsler, opprettet ved første kjøring hvis
  `SESSION_SECRET` er uinnstilt. Sletting av den roterer hemmeligheten (noe som ugyldiggjør sesjoner).
- **`data/.secret-key`** - den dedikerte 32-bytes krypteringsnøkkelen ved lagring (modus `0600`), automatisk opprettet
  ved første kjøring. Uavhengig av `SESSION_SECRET`; sletting av den gjør alle lagrede legitimasjoner
  ukrypterbare, så den hører hjemme med sikkerhetskopiene dine.
- **Blåkopier (`.mcserver.zip`)** - en zip med en `manifest.json` som beskriver konfigurasjon, ressurser,
  den festede pakke-referansen, overleggsmanifestet (kilde-URL-er + sha256), valgte konfigurasjonsfiler, og
  valgfritt en verden. Import laster ned og hasj-verifiserer hver mod og tildeler ferske porter.
- **Docker-containere** opprettet av panelet navngis og merkes slik at vakten kan finne dem;
  panelet eier hele livssyklusen deres.

## Oppstartssekvens

1. `require('./instrument')` (Sentry-sømmen) før noe annet, deretter `require('./preflight')`
   for å feile tydelig på en utdatert Node-versjon.
2. Last inn konfigurasjon; sikre/generer `.session-secret` **og** `.secret-key`.
3. `ensureDataRoot()` - opprett `./data`-layouten, tøm `tmp/`.
4. Kjør DB-migreringer, deretter `PRAGMA integrity_check` (logger høyt, peker på `data/backups/_panel`
   ved feil).
5. Krypter eventuelle eldre `SESSION_SECRET`-nøkkel-baserte hemmeligheter på nytt under `.secret-key` (`secretsMigration`).
6. Importer API-nøkler fra miljøet én gang (`apiKeys.importFromEnvOnce()`), fest enhver server som fortsatt
   har en upinnet modpack-velger (`packPins.pinUnpinnedServers()`), marker versjons-
   kompatibilitetsskanninger som ble etterlatt kjørende av en tidligere prosess som avbrutt
   (`compat.reconcileScans()`), deretter seed start-blåkopier (beskyttet).
7. Start HTTP + WS-serveren. På en eksponert bind, skriv den første kjøringens `/setup` PIN-kode.
8. Installer kjøretidsvakten etter oppstart (fanger ukjente feil; `MSM_EXIT_ON_FATAL=1` gjør at den avsluttes hardt for administrerte distribusjoner).
9. Start bakgrunnstjenester: WS-megler, lagringsindekserer, krasj- og inventarvakter, planlegger,
   Discord hendelsesbro, chatbot-utgående vakt, og **daglig vedlikeholdstimer** (rydd opp gamle
   analyserader, chatbot-transkripsjoner, hendelseshistorikk (365 dager) og API-cache-rader, deretter ta et øyeblikksbilde av `panel.db`).
10. Initialiser Docker **i bakgrunnen**. UI-et er fullt brukbar mens daemonen er nede;
    Docker-funksjoner lyser opp når den blir tilgjengelig. Når tilkoblet, gjenoppretter `refreshStatuses({ boot })`
    mellomlagrede statusser, sender ut en engangs `offline-after-restart`-hendelse for en server som var
    oppe før panelet startet på nytt og ikke vil bli brakt tilbake, og oppstarts-løkken starter
    `auto_start`-servere pluss gjenoppretter `auto_restart`-servere funnet krasjet under nedetiden
    (respekterer krasj-loop-tilbakefall).

> Rekkefølgen instrument-før-preflight er en bevisst avveining: den lar en fremtidig Sentry-kabling
> patche kjøretiden først, på bekostning av en litt mindre vennlig melding på en virkelig gammel Node.

## Bygg pipeline

`pnpm run build` = `build:css` (Tailwind → `public/css/app.css`) + `build:js` (esbuild →
`public/dist/js/`, ESM med kodelinjedeling). `postinstall` kjører **kun CSS**. `public/css/app.css`
og `public/dist/` er git-ignorert byggeartefakter; Dockerfile-byggestadiet kjører hele
`pnpm run build` og kopierer `public/` inn i kjøretidsimaget. Statiske ressurser serveres
med `immutable`/lang cache for fingeravtrykte filer, kort cache for CSS/JS, og `no-cache` for HTML og
`/api`.
