---
title: 'Arkitektur'
description: 'Minecraft Server Manager er en single-process, server-rendered Node.js-applikation.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/architecture.md'
---

[← Tilbage til dokumentindeks](/docs/)

Minecraft Server Manager er en single-process, server-rendered Node.js-applikation. Den administrerer
Minecraft-servere, der kører som Docker-containere ved hjælp af
[itzg/docker-minecraft-server](https://github.com/itzg/docker-minecraft-server) imaget, og kommunikerer med
Docker-daemonen via dens API (aldrig ved at køre `docker` CLI via shell).

## Runtime-struktur

- **Express + Handlebars** render sider server-side. Der er ingen SPA; browserens JS i `public/js/`
  er håndskrevet progressiv forbedring. Et esbuild-trin (`pnpm run build:js`) bundter og
  minificerer det til `public/dist/js/`; appen serverer den bundle, når den er til stede, og den rå
  kilde ellers, så en udviklerkørsel uden build stadig virker.
- **`node:sqlite`** (indbygget i Node; panelet kræver Node ≥ 24) er databasen - synkron,
  ingen native moduler, WAL-tilstand. En lille versions-migrations-runner anvender `src/db/migrations/*` ved
  opstart. Forberedte statements caches i `src/db/index.js` med SQL-teksten som nøgle.
- **`ws`** håndterer live konsol- og statistikstrømme. Begge er **mæglet**: én upstream
  `docker logs --follow` (eller `docker stats`) pr. server, demuxet én gang og fordelt til hver
  tilsluttet fane, snarere end én upstream pr. seer. Konsolmægleren holder en lille replay-buffer til
  faner, der tilslutter sig sent, og dropper en abonnent, hvis socket falder for langt bagud, snarere end
  at sinke den delte strøm.
- **`dockerode`** er den eneste måde, appen taler med Docker på. Endepunktet detekteres automatisk pr. platform
  (Windows navngivet pipe vs. unix socket).
- **Al vedvarende tilstand lever under én mappe** (`$DATA_DIR`, standard `./data`). Kopiering af den
  mappe migrerer hele panelet.

## Lagdeling

Afhængigheder flyder i én retning:

```
                 ┌─────────────────────────────┐
   HTTP  ───────▶│  web/routes/*  (+ middleware)│   analysér & valider input, formater svar
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

- **`web/routes/`** - én router pr. domæne (`servers`, `players`, `worlds`, `crashes`, `blueprints`,
  `files`, …), monteret i `web/app.js`. Routere validerer med zod, kalder en service og returnerer JSON
  eller render en visning. Forretningslogik hører ikke hjemme her. To routere er monteret i den **offentlige
  zone**, før `requireAuth`: `routes/status.js` (opt-in HTML-status sider pr. server) og
  `routes/apiV1.js` (`/api/v1`, en skrivebeskyttet JSON API autentificeret af en admin-udstedt Bearer-token
  fra `services/apiTokens.js`, deaktiveret medmindre aktiveret i Indstillinger; se `docs/public-api.md`).
- **`services/`** - hjertet af appen. Hver service ejer et domæne og kan afhænge af
  infrastruktur og andre services.
- **`docker/`** - dockerode-wrappers: `connect` (endepunktdetektering + daemon-sundhed), `containers`
  (opret/start/stop/genskab med bind mounts, hukommelses-/CPU-grænser og labels), `logs`, `stats`,
  `images` og en `watcher`, der omdanner Docker-begivenheder til historik + crash-detektering.
- **`db/`** - SQLite-wrapperen og migrations-runneren.
- **`storage/`** - `./data` bootstrap, **sti-vagten** (`safeJoin`, rygraden for fil-sikkerhed) og
  baggrundsstørrelses-indekseringen + kvotehåndhævelse.

Tværgående:

- **`config/`** - miljøkonfiguration plus **feltkataloget**: den enkelt kilde til sandhed for
  serverindstillinger. Hver itzg-miljøvariabel er katalogiseret (label, hjælp, type, enhed, standard,
  validering, sektion, fare-flag). Guiden, indstillingsformularerne og zod-valideringen er alle afledt
  af den, så eksponering af en ny indstilling er en dataændring, ikke ny UI-opsætning.
- **`events/`** - `recordEvent()` er det ene indgangspunkt for historikloggen; livscyklusbegivenheder fanger også
  container-loguddrag til `data/logs/<id>/events/`.
- **`ws/`** - autentificerede konsol + statistik WebSockets (session cookie verificeret ved opgradering, `Origin`
  tjekket for at blokere cross-site hijacking), mæglet pr. server (se "Runtime-struktur").
- **`logger.js` + `instrument.js`** - `require('./logger')(label)` returnerer en pr-modul
  [Pino](https://getpino.io) logger; niveau fra `LOG_LEVEL`, `makeFailureThrottle()` holder en
  vedvarende fejlet baggrundssløjfe til én loglinje plus en "gendannet" linje.
  `src/utils/logSanitize.js` fjerner credential-formede nøgler og webhook-tokens fra de strukturerede
  metadata; `src/config/logLevel.js` er den delte niveau-tilladelsesliste (holdt separat for at undgå en
  require-cyklus med `config`). `src/instrument.js` er en sovende Sentry-søm, indlæst først i
  `src/server.js`. `src/web/middleware/requestLog.js` skriver én adgangsloglinje pr. anmodning
  (springer `/healthz` og statiske aktiver over). ESLint håndhæver `no-console` under `src/**`, med
  `preflight.js`, `instrument.js` og `config/index.js` undtaget (de kører før loggeren eksisterer).
- **Rate limiting** - `src/web/middleware/rateLimit.js` placerer `express-rate-limit` foran `/api`
  (`RATE_LIMIT_API_PER_MIN`, standard 1200) og login / 2FA / setup POSTs
  (`RATE_LIMIT_AUTH_PER_15MIN`, standard 100); `0` deaktiverer en begrænser. Den bruger `req.ip` som nøgle, så
  `TRUST_PROXY` er vigtig bag en proxy. `/api/v1` har sin egen pr-token begrænser
  (`RATE_LIMIT_PUBLIC_API_PER_MIN`, standard 120), med en hash af Bearer-tokenet som nøgle og IP som fallback. En separat pr-konto blød tæller i
  `src/web/middleware/auth.js` håndterer login-lockout (pr-IP og konto-global, aftagende).

## Nøgle domæne-adfærd

- **Modpacks er altid fastgjort.** Imagget opgraderer automatisk ikke-fastgjorte packs ved hver genstart, så
  panelet løser "latest" til en konkret versions-id ved installationstidspunktet og fastgør den. Opgraderinger er et
  eksplicit orkestreret flow (`updates/`): forhåndsvisning → backup før opdatering → yndefuld stop → gen-fastgørelse →
  genskabelse → sundheds-monitor → one-click rollback.
- **Overlayet med brugerdefinerede mods** administreres af panelet: bruger-tilføjede mods lander i det deduplicerede bibliotek og
  linkes hårdt ind i serveren, så de overlever pack-opdateringer. Deaktivering er klasse-bevidst.
- **Porte** allokeres fra et basis-skema (spil fra `PORT_GAME_START` og opefter, RCON = spil +
  `PORT_RCON_OFFSET`, Bedrock fra `PORT_BEDROCK_START`), undersøges for tilgængelighed og reserveres i
  databasen.
- **Disk-kvoter** håndhæves af panelet, fordi Docker ikke kan begrænse brugen af bind-mounts: indekseren
  cacher størrelser pr. mappe, og disk-vækstoperationer er betinget af dem.
- **Hemmeligheder** (RCON-adgangskoder, API-nøgler, TOTP-hemmeligheder, Discord webhook URL'en) krypteres ved
  lagring med AES-256-GCM ved hjælp af en dedikeret tilfældig nøgle på `$DATA_DIR/.secret-key` (tilstand `0600`,
  automatisk genereret). Den er uafhængig af `SESSION_SECRET`; en nøgle afledt af `SESSION_SECRET` gemmes som en
  kun-dekrypterings fallback for værdier skrevet før den dedikerede nøgle eksisterede, og
  `src/services/secretsMigration.js` genkrypterer dem under den dedikerede nøgle én gang ved opstart.
  En `.secret-key`, der eksisterer, men ikke kan parses, er en alvorlig opstartsfejl (den genereres aldrig stille
  over den eksisterende). Blueprints fjerner alle hemmeligheder ved eksport.

## Data- og wireformater

- **`data/panel.db`** - SQLite-databasen. Tages snapshot dagligt via `VACUUM INTO` til
  `data/backups/_panel/` (de seneste 14 gemmes); `PRAGMA integrity_check` kører ved opstart.
- **`data/.session-secret`** - den automatisk genererede cookie-signeringshemmelighed, oprettet ved første kørsel, hvis
  `SESSION_SECRET` ikke er sat. Sletning af den roterer hemmeligheden (hvilket ugyldiggør sessioner).
- **`data/.secret-key`** - den dedikerede 32-byte krypteringsnøgle ved lagring (tilstand `0600`), automatisk oprettet
  ved første kørsel. Uafhængig af `SESSION_SECRET`; sletning af den gør enhver gemt legitimationsoplysning
  ulæselig, så den hører hjemme sammen med dine backups.
- **Blueprints (`.mcserver.zip`)** - en zip med en `manifest.json`, der beskriver konfiguration, ressourcer,
  den fastgjorte pack-reference, overlay-manifestet (kilde-URL'er + sha256), valgte konfigurationsfiler og
  valgfrit en verden. Import gen-downloader og hash-verificerer hver mod og tildeler nye porte.
- **Docker-containere**, oprettet af panelet, navngives og mærkes, så watcher'en kan finde dem;
  panelet ejer deres fulde livscyklus.

## Opstartssekvens

1. `require('./instrument')` (Sentry-sømmen) før alt andet, derefter `require('./preflight')`
   for at fejle tydeligt på en ikke-understøttet Node-version.
2. Indlæs konfiguration; sikrer/genererer `.session-secret` **og** `.secret-key`.
3. `ensureDataRoot()` - opretter `./data`-layoutet, rydder `tmp/`.
4. Kør DB-migrationer, derefter `PRAGMA integrity_check` (logger højt, peger på `data/backups/_panel`
   ved fejl).
5. Genkrypter eventuelle ældre `SESSION_SECRET`-baserede hemmeligheder under `.secret-key` (`secretsMigration`).
6. Seed start-blueprints (beskyttet).
7. Start HTTP + WS-serveren. På en eksponeret forbindelse, udskriv den første-kørsels `/setup` PIN.
8. Installer runtime-vagten efter opstart (fanger ukontrollerede fejl; `MSM_EXIT_ON_FATAL=1` får den til at
   lukke hårdt for overvågede installationer).
9. Start baggrundstjenester: WS-mægler, lagerindekserer, crash- og lager-watchere, planlægger,
   Discord-begivenhedsbro, og **den daglige vedligeholdelsestimer** (fjern gamle analyse-rækker + snapshot
   `panel.db`).
10. Initialiser Docker **i baggrunden**. UI'en er fuldt brugbar, mens daemonen er nede;
    Docker-funktioner lyser op, når den bliver tilgængelig. Når den er tilsluttet, `refreshStatuses({ boot })`
    afstemmer cachede statusser, udsender en engangs `offline-after-restart` begivenhed for en server, der var
    oppe før panelet genstartede og ikke vil blive bragt tilbage, og opstarts-loopet starter
    `auto_start` servere plus gendanner `auto_restart` servere fundet crashet under nedbruddet
    (respekterer crash-loop backoff).

> Instrument-før-preflight-rækkefølgen er en bevidst afvejning: den lader en fremtidig Sentry-ledning
> patche runtime'en først, på bekostning af en lidt mindre venlig besked på en virkelig gammel Node.

## Bygge-pipeline

`pnpm run build` = `build:css` (Tailwind → `public/css/app.css`) + `build:js` (esbuild →
`public/dist/js/`, ESM med code-splitting). `postinstall` kører **kun CSS**. `public/css/app.css`
og `public/dist/` er gitignorede build-artefakter; Dockerfile build-trinnet kører den fulde
`pnpm run build` og kopierer `public/` ind i runtime-imaget. Statiske aktiver serveres
`immutable`/lang-cache for fingerprinted filer, kort-cache for CSS/JS, og `no-cache` for HTML og
`/api`.
