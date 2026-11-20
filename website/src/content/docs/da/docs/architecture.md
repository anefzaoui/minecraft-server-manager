---
title: 'Arkitektur'
description: 'Minecraft Server Manager er en single-process, server-rendered Node.js-applikation.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/architecture.md'
---

[← Tilbage til docs-indeks](/docs/)

Minecraft Server Manager er en enkeltproces, server-gengivet Node.js-applikation. Den administrerer
Minecraft-servere, der kører som Docker-containere ved hjælp af
[itzg/docker-minecraft-server](https://github.com/itzg/docker-minecraft-server) imaget, og kommunikerer med
Docker-daemonen via dens API (aldrig ved at køre `docker` CLI via shell).

## Kørselsprofil

- **Express + Handlebars** gengiver sider på serversiden. Der er ingen SPA; browserens JS i `public/js/`
  er håndskrevet progressiv forbedring. Et esbuild-trin (`pnpm run build:js`) bundter og
  minificerer det til `public/dist/js/`; appen serverer den bundt, når den er til stede, og den rå
  kilde ellers, så en udviklerkørsel uden en build stadig virker.
- **`node:sqlite`** (indbygget i Node; panelet kræver Node ≥ 24) er databasen - synkron,
  nul native moduler, WAL-tilstand. En lille versionsmigreringskører anvender `src/db/migrations/*` ved
  opstart. Forberedte statements caches i `src/db/index.js` med SQL-teksten som nøgle.
- **`ws`** bærer live konsol- og statistikstrømmene. Begge er **mæglet**: én upstream
  `docker logs --follow` (eller `docker stats`) pr. server, demuxet én gang og fordelt til hver
  tilsluttet fane, snarere end én upstream pr. seer. Konsolmægleren holder en lille replay-buffer
  til sent-tilkomne faner og dropper en abonnent, hvis socket falder for langt bagud, snarere end
  at sinke den delte strøm.
- **dockerode** er den eneste måde, appen taler med Docker. Endepunktet detekteres automatisk pr. platform
  (Windows navngivet pipe vs. unix socket).
- **Al vedvarende tilstand lever under én mappe** (`$DATA_DIR`, standard `./data`). Kopiering af den
  mappe migreres hele panelet.

## Lagdeling

Afhængigheder flyder i én retning:

```
                 ┌─────────────────────────────┐
   HTTP  ───────▶│  web/routes/*  (+ middleware)│   analysér & valider input, formuler svar
                 └──────────────┬──────────────┘
                                │
                 ┌──────────────▼──────────────┐
                 │         services/*          │   domænelogik (de faktiske funktioner)
                 └───┬─────────┬─────────┬─────┘
                     │         │         │
        ┌────────────▼──┐ ┌────▼────┐ ┌──▼──────────┐
        │   docker/*    │ │  db/*   │ │  storage/*  │   infrastruktur
        └───────────────┘ └─────────┘ └─────────────┘
```

- **`web/routes/`** - én router pr. domæne (`players`, `worlds`, `crashes`, `blueprints`, `files`, …).
  `web/app.js` monterer de øverste niveauer (`api.js`, den session JSON API, der også indeholder kerne-
  serverruterne og monterer domænerouterne pr. server; `index.js`, siderne; `auth`, `account`,
  `tasks`, …). Routere validerer med zod, kalder en service og returnerer JSON
  eller gengiver en visning. Forretningslogik hører ikke hjemme her. To routere er monteret i den **offentlige
  zone**, før `requireAuth`: `routes/status.js` (opt-in HTML-status sider pr. server) og
  `routes/apiV1.js` (`/api/v1`, en skrivebeskyttet JSON API autentificeret af en admin-genereret Bearer-token
  fra `services/apiTokens.js`, slået fra medmindre aktiveret i Indstillinger; se `docs/public-api.md`).
- **`services/`** - hjertet af appen. Hver service ejer et domæne og kan afhænge af
  infrastruktur og andre services.
- **`docker/`** - dockerode-wrappers: `connect` (endepunktdetektion + daemon-sundhed), `containers`
  (opret/start/stop/genskab med bind mounts, hukommelses-/CPU-grænser og labels), `logs`, `stats`,
  `images`, `networks` (opdagelse af host-netværk), `hostPath` (genrodder bind-stier under
  `DATA_DIR_HOST`), og en `watcher`, der omdanner Docker-begivenheder til historik + crash-detektion.
- **`db/`** - SQLite-wrapperen og migreringskøreren.
- **`storage/`** - `./data` bootstrap, **sti-vagten** (`safeJoin`, rygraden for fil-sikkerhed), og den
  baggrunds-størrelsesindeksering + kvotehåndhævelse.

På tværs af lagene:

- **`config/`** - miljøkonfiguration plus **feltkataloget**: den enkelte sandhedskilde for
  serverindstillinger. Hver itzg miljøvariabel er katalogiseret (label, hjælp, type, enhed, standard,
  validering, sektion, fareflag). Guiden, indstillingsformularerne og zod-valideringen er alle afledt
  af den, så eksponering af en ny indstilling er en dataændring, ikke ny UI-rørføring.
- **`events/`** - `recordEvent()` er det ene indgangspunkt for historikloggen; livscyklusbegivenheder
  fanger også container-loguddrag til `data/logs/<id>/events/`.
- **`ws/`** - autentificerede konsol + statistik WebSockets (session cookie verificeret ved opgradering, `Origin`
  tjekket for at blokere cross-site hijacking), mæglet pr. server (se "Kørselsprofil").
- **`logger.js` + `instrument.js`** - `require('./logger')(label)` returnerer en pr.-modul
  [Pino](https://getpino.io) logger; niveau fra `LOG_LEVEL`, `makeFailureThrottle()` holder en
  vedvarende fejlet baggrundssløjfe til én loglinje plus en "gendannet" linje.
  `src/utils/logSanitize.js` redigerer credential-formede nøgler og webhook-tokens fra den strukturerede
  metadata; `src/config/logLevel.js` er den delte niveau-tilladelsesliste (holdt separat for at undgå en require-cyklus med `config`). `src/instrument.js` er en sovende Sentry-søm, indlæst først i
  `src/server.js`. `src/web/middleware/requestLog.js` skriver én adgangsloglinje pr. anmodning
  (springer `/healthz` og statiske aktiver over). ESLint håndhæver `no-console` under `src/**`, med
  `preflight.js`, `instrument.js`, og `config/index.js` undtaget (de kører før loggeren eksisterer).
- **Ratebegrænsning** - `src/web/middleware/rateLimit.js` placerer `express-rate-limit` foran `/api`
  (`RATE_LIMIT_API_PER_MIN`, standard 1200) og login / 2FA / setup POSTs
  (`RATE_LIMIT_AUTH_PER_15MIN`, standard 100); `0` deaktiverer en begrænser. Den bruger `req.ip` som nøgle, så
  `TRUST_PROXY` betyder noget bag en proxy. `/api/v1` har sine egne begrænsere: en pr.-klient-IP-grænse
  (fem gange budgettet pr. token) der kører før tokenet er verificeret, derefter et pr.-token
  budget (`RATE_LIMIT_PUBLIC_API_PER_MIN`, standard 120) med tokenets id som nøgle. En
  separat pr.-konto blød tæller i
  `src/web/middleware/auth.js` håndterer login-lockout (pr.-IP og konto-global, aftagende).
- **Autorisation**: to lag. Den globale rolle (`requireAuth` → `requireRole` / `requireWrite` i
  `src/web/middleware/auth.js`) styrer panel-brede handlinger og er standarden på hver server. Pr.-server
  tilladelser (`src/services/permissions.js`, ni kapaciteter gemt som en JSON-liste pr.
  `(bruger, server)` i `user_server_permissions`) forfiner den standard for én server; hver
  `/api/servers/:id` rute, underrouter-montering, side, WebSocket og flåde-bred liste går igennem
  `src/web/middleware/serverAccess.js` (`serverScope`, monteret på `/servers/:id` præfikset af både
  API'en og sides-routeren, skjuler en server uden `view` som en 404; `requireCap(cap)` navngiver
  kapaciteten en rute behøver). Skrivninger, der navngiver deres server i bodyen (planer, verdensudtræk og
  installation, blueprint-eksport) åbnes for seere af `requireWrite` kun for den server, og hver
  sådan rute tjekker kapaciteten selv. `test/permissions-routes.test.js` gennemgår de live router-stakke og fejler, hvis en server-scoped skrive-rute, montering eller side mangler en gate.

## Nøgle domæneadfærd

- **Modpacks er altid fastgjort.** Imagets auto-opgraderer ikke-fastgjorte pakker ved hver genstart, så
  panelet løser "latest" til en konkret versions-id ved installationstidspunktet og fastgør den. Opgraderinger er et
  eksplicit orkestreret flow (`updates/`): forhåndsvisning → backup før opdatering → yndefuld stop → gen-fastgørelse →
  genoprettelse → sundheds-monitor → et-klik-tilbageførsel.
- **Overlayet med brugerdefinerede mods** administreres af panelet: bruger-tilføjede mods lander i det deduplicerede bibliotek og
  linkes hårdt ind i serveren, så de overlever pakkeopdateringer. Deaktivering er klasse-bevidst. Fordi
  biblioteket gemmer hver build, det har downloadet, gemmer en opdatering den build, den erstattede
  (`server_content.previous_*`) og kan gendannes fra lokale filer alene. Deaktivering af en pakke-mod
  skriver pakkens eksklusions-miljøvariabel i stedet; `packs.applyPack` bærer den og resten af
  pakke-tuning (`PACK_TUNING_KEYS`) på tværs af en versionsændring af den samme pakke, og dropper den, når
  pakken ændres.
- **En Minecraft-versionsopgradering skal fortjenes.** `services/compat.js` scanner en servers mods -
  løst fra panel-installerede rækker, derefter CurseForge-pakke-manifestet, derefter efter indholdshash
  mod Modrinth/CurseForge - og bygger en (loader, Minecraft version) supportmatrix pr. projekt
  ud af CurseForges `latestFilesIndexes` (200 projekter pr. anmodning) og Modrinths pr.-projekt
  versionsliste (én anmodning pr. projekt, hvilket er det, der holder loader og version parret).
  Opdaterings-tjekkeren tilbyder kun den nyeste version, som ALLE mods understøtter, og tilbyder intet overhovedet, når
  svaret ikke kan fastslås: ingen scanning, en scanning for en anden version eller loader, en der aldrig
  blev færdig, eller en jar, som ingen af registre genkender. Scanninger er kun manuelle, og deres fremdrift og
  delvise resultater lever i `version_compat` (ikke i den in-memory `services/tasks.js`), så en opdatering
  eller en panel-genstart fortsætter i stedet for at hænge på en spinner; `reconcileScans()` markerer scanninger
  forældreløse ved en nedlukning ved næste opstart.
- **Mod loader-versionen er en pin, som alt andet.** `services/loaderPin.js` læser den installerede build fra
  imagets egen installationsmanifest (`.forge-manifest.json` og lignende) og skriver pinnen: loaderens itzg-variabel på en almindelig server (`FORGE_VERSION`, …), eller
  `CF_MOD_LOADER_VERSION` på en Forge eller Fabric CurseForge-pakke, som tilsidesætter den version, pakken
  deklarerer. Imagets CurseForge-installationsprogram ignorerer den tilsidesættelse for NeoForge, og Modrinth
  og FTB-pakker har ingen, så deres loader følger pakken. `packs.applyPack` fjerner alle `CF_`
  variabler ved en pakkeopdatering eller tilbageførsel, hvilket fjerner en tilsidesættelse med resten. En typet build tjekkes mod registrets fulde liste først (`services/loaderVersions.js`; Forges kommer fra
  dets maven metadata, som springer tal over; et manglende resultat tjekkes én gang mod selve registret),
  derefter er ændringen backup → pin (over env som den er efter backup) → genopbygning.
- **Porte** allokeres fra et basis-skema (spil fra `PORT_GAME_START` og opefter, RCON = spil +
  `PORT_RCON_OFFSET`, Bedrock fra `PORT_BEDROCK_START`), undersøges for tilgængelighed og reserveres i
  databasen. "Optaget" er foreningen af alle serveres krav (live porte, plus et afventende par nedenfor),
  alle host-porte, som enhver Docker-container udgiver (`containers.publishedHostPorts`: kørende
  containeres live-bindinger plus hver stoppet containers konfigurerede, fordi en OS-bind-undersøgelse
  fra inde i panelets egen container kun ser den containers netværksnavnerum), og OS-undersøgelsen. Docker-delen caches i 3 sekunder og begrænses: en liste, der ikke svarer inden for 2,5 sekunder, dropper kun Docker-delen, og en langsom inspektion koster kun den containers porte. Serveroprettelser og
  `servers.changeGamePort` vælger porte gennem én serialiseringskæde, der kun dækker valget
  og dets krav (rækkeskrivningen for en oprettelse, den in-memory reservation for en portændring);
  BlueMaps portvælger og de ekstra port-tilsidesættelser er ikke inkluderet og
  konsulterer ikke Docker. En portændring på en eksisterende server (`servers.changeGamePort`, under serverens op-lås) anvendes med det samme, fordi Docker retter portbindinger ved containeroprettelse:
  det nye par (RCON altid spil + `PORT_RCON_OFFSET`) tjekkes og reserveres i hukommelsen
  (`ports.reserve`, både det gamle og det nye par, respekteret af alle andre valg) under port-låsen. Det nægtes (409 `PENDING_CHANGES`), mens andre indstillinger venter på en genopbygning, så det genopbygger kun en container, der allerede kørte, på en ny port; og en kørende server ændres kun, når anmodningen siger `restart: true` (ellers 409 `NEEDS_CONFIRM`). Imagets trækkes og et brugerdefineret containernavn tjekkes, før noget røres. En kørende server stoppes; derefter skrives det nye par med `pending_recreate = 1` (så et panel-nedbrud derfra efterlader en ærlig "genopbygning afventer"), containeren fjernes, genopbygges på det nye par og startes. Hvis et trin efter stop fejler, skriver `putBackOnOldPort` det gamle par tilbage, genopbygger (og genstarter, hvis den kørte) på det og registrerer, hvilket trin der fejlede; historik og alarmer siger, hvis selv det fejlede, hvilket efterlader serveren stoppet, indtil nogen starter den. `settings`-kapaciteten er nok, inklusive kørende server. Ikke-administratorer kan kun vælge fra `PORT_GAME_START` og opefter.
  (De `port_*_pending` kolonner fra migrering 029 tilhører et tidligere, ikke-udgivet design og bruges ikke; 031 rydder dem.) En låsekollision svarer med 409 med `code: 'BUSY'`, som de opkald, der prøver igen nedenfor, tjekker snarere end ordlyden. En crash auto-restart
  (`watcher.restartAfterCrash`) og en planlagt backup eller start (`scheduler.runTaskWithRetry`)
  der finder serveren optaget af en anden handling, prøver igen hver 20 sekunder / 60 sekunder i op til 30 minutter,
  og en pakkeopdatering eller tilbageførsel prøver sine låste trin på samme måde (`opLock.retryWhileBusy`);
  en crash-restart eller en ventende planlagt start giver op, når nogen har stoppet, dræbt eller
  startet serveren siden (`events.lifecycleActionSince`), og crash-restarten også, når
  auto-restart er slået fra, eller serveren er væk. Planlagte genstarter, stop og kommandoer genprøves ikke, og en plan, hvis sidste kørsel stadig venter, springer sin næste afskydning over.
- **Disk-kvoter** håndhæves af panelet, fordi Docker ikke kan begrænse bind-mount-brug: indekseren
  cacher størrelser pr. mappe, og disk-vækstoperationer er begrænset af dem.
- **Hemmeligheder** (RCON-adgangskoder, API-nøgler, TOTP-hemmeligheder, Discord webhook URL) krypteres
  ved lagring med AES-256-GCM ved hjælp af en dedikeret tilfældig nøgle på `$DATA_DIR/.secret-key` (tilstand `0600`,
  auto-genereret). Den er uafhængig af `SESSION_SECRET`; en `SESSION_SECRET`-afledt nøgle gemmes som en
  kun-dekrypterings-fallback for værdier skrevet før den dedikerede nøgle eksisterede, og
  `src/services/secretsMigration.js` genkrypterer dem under den dedikerede nøgle én gang ved opstart.
  En `.secret-key`, der eksisterer, men ikke kan parses, er en alvorlig opstartsfejl (den regenereres aldrig lydløst
  ovenpå). Blueprints fjerner alle hemmeligheder ved eksport.
- **`server.properties` ejes af panelet, men skygges af miljøvariabler.** itzg-imaget genpåstår hver
  miljø-baseret egenskab ved hver start (`OVERRIDE_SERVER_PROPERTIES` standard er sand), så en værdi, som
  panelet redigerer direkte - Verdens Kontroller PvP/sværhedsgrad, whitelist-kontakten, Fil-editoren -
  ville blive lydløst gendannet ved næste start, medmindre den matchende miljøvariabel fjernes, og
  containeren genskabes. Hver direkte egenskabsskrivning går gennem `writeServerProperties()` (hele filen)
  eller `setServerProperty()` (én nøgle) i `src/services/servers.js`, som atomisk omskriver
  filen, fjerner miljøvariablen bag hver ændret nøgle (via `prop:` attributten på katalogfelter, tjekket i tests mod imagets egne egenskabsdefinitioner), og markerer
  `pending_recreate`. Sværhedsgrad skrives til filen såvel som sendes over RCON, fordi en
  dedikeret server genanvender `difficulty` egenskaben ved hver opstart. Minecraft selv gemmer
  server.properties fra sine opstartsværdier ved `whitelist on/off`, hvilket ville fortryde redigeringer foretaget, mens serveren kører, så den kørende whitelist-kontakt øjebliksbilleder filen først og skriver den tilbage med kun `white-list` ændret. MOTD har den samme kontrakt: en direkte
  `motd` filredigering fjerner den, så den sidste skrivning vinder.

## Data & wire-formater

- **`data/panel.db`** - SQLite-databasen. Øjebliksbilleder dagligt via `VACUUM INTO` til
  `data/backups/_panel/` (nyeste 14 beholdes); `PRAGMA integrity_check` kører ved opstart.
- **`data/.session-secret`** - den auto-genererede cookie-signeringshemmelighed, oprettet ved første kørsel, hvis
  `SESSION_SECRET` er uindstillet. Sletning af den roterer hemmeligheden (hvilket ugyldiggør sessioner).
- **`data/.secret-key`** - den dedikerede 32-byte krypteringsnøgle ved lagring (tilstand `0600`), auto-oprettet
  ved første kørsel. Uafhængig af `SESSION_SECRET`; sletning af den gør enhver gemt legitimationsoplysning
  ukrypterbar, så den hører hjemme med dine backups.
- **Blueprints (`.mcserver.zip`)** - en zip med en `manifest.json`, der beskriver konfiguration, ressourcer, den
  fastgjorte pakke-reference, overlay-manifestet (kilde-URL'er + sha256), valgte konfigurationsfiler og
  valgfrit en verden. Import gen-downloader og hash-verificerer hver mod og tildeler friske porte.
- **Docker-containere**, oprettet af panelet, navngives og mærkes, så watcher kan finde dem;
  panelet ejer deres fulde livscyklus.

## Opstartssekvens

1. `require('./instrument')` (Sentry-sømmen) før alt andet, derefter `require('./preflight')`
   for at fejle klart på en ikke-understøttet Node-version.
2. Indlæs konfiguration; sikr/generer `.session-secret` **og** `.secret-key`.
3. `ensureDataRoot()` - opret `./data` layoutet, ryd `tmp/`.
4. Kør DB-migreringer, derefter `PRAGMA integrity_check` (logger højt, peger på `data/backups/_panel`
   ved fejl).
5. Genkrypter eventuelle ældre `SESSION_SECRET`-nøglede hemmeligheder under `.secret-key` (`secretsMigration`).
6. Importer API-nøgler fra miljøet én gang (`apiKeys.importFromEnvOnce()`), fastgør enhver server, der stadig
   bærer en ikke-fastgjort modpack-vælger (`packPins.pinUnpinnedServers()`), marker version
   kompatibilitetsscanninger efterladt kørende af en tidligere proces som afbrudt
   (`compat.reconcileScans()`), derefter seed start-blueprints (beskyttet).
7. Start HTTP + WS-serveren. På en eksponeret bind, udskriv den første-kørsels `/setup` PIN.
8. Installer post-boot runtime-vagten (fanger ukontrollerede fejl; `MSM_EXIT_ON_FATAL=1` får den til at afslutte hårdt for overvågede implementeringer).
9. Start baggrundstjenester: WS-mægler, lagerindekserer, crash- + lager-watchere, planlægger,
   Discord event-bro, chatbot-udgående watcher, og **daglige vedligeholdelsestimer** (fjern gamle
   analyserækker, chatbot-transskriptioner, historik over begivenheder (365 dage) og API-cache-rækker, derefter snapshot
   `panel.db`).
10. Initialiser Docker **i baggrunden**. UI'en er fuldt brugbar, mens daemonen er nede;
    Docker-funktioner lyser op, når den bliver tilgængelig. Når den er forbundet, genopretter `refreshStatuses({ boot })`
    cachede statusser, udsender en engangs `offline-after-restart` begivenhed for en server, der var oppe før panelet genstartede og ikke vil blive bragt tilbage, og boot-sløjfen starter
    `auto_start` servere plus gendanner `auto_restart` servere fundet crashet under nedetiden
    (respekterer crash-loop backoff).

> Instrument-før-preflight-rækkefølgen er en bevidst afvejning: den lader en fremtidig Sentry-ledningsføring
> lappe runtime først, på bekostning af en lidt mindre venlig besked på en virkelig gammel Node.

## Bygge-pipeline

`pnpm run build` = `build:css` (Tailwind → `public/css/app.css`) + `build:js` (esbuild →
`public/dist/js/`, ESM med kodestripping). `postinstall` kører **kun CSS**. `public/css/app.css`
og `public/dist/` er gitignorerede build-artefakter; Dockerfile build-trinnet kører den fulde
`pnpm run build` og kopierer `public/` ind i runtime-imaget. Statiske aktiver serveres
`immutable`/lang-cache for fingerprintede filer, kort-cache for CSS/JS, og `no-cache` for HTML og
`/api`.
