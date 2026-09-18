---
title: 'Arkitektur'
description: 'Minecraft Server Manager er en enkeltprosess, server-rendret Node.js-applikasjon.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/architecture.md'
---

[← Tilbake til dokumentasjonsindeks](/docs/)

Minecraft Server Manager er en enkeltprosess, server-rendret Node.js-applikasjon. Den administrerer
Minecraft-servere som kjører som Docker-containere ved hjelp av
[itzg/docker-minecraft-server](https://github.com/itzg/docker-minecraft-server)-imaget, og kommuniserer med
Docker-daemonen via API-et (aldri ved å kjøre `docker` CLI i skallet).

## Kjøretidsform

- **Express + Handlebars** gjengir sider på serversiden. Det er ingen SPA; nettleser-JS i `public/js/`
  er håndskrevet progressiv forbedring. Et esbuild-steg (`pnpm run build:js`) pakker og
  minimerer det til `public/dist/js/`; appen serverer den pakken når den er til stede og den rå
  kilden ellers, så en utviklerkjøring uten bygging fungerer fortsatt.
- **`node:sqlite`** (innebygd i Node; panelet krever Node ≥ 24) er databasen - synkron,
  null native moduler, WAL-modus. En liten versjonsmigreringskjører bruker `src/db/migrations/*` ved
  oppstart. Forberedte utsagn caches i `src/db/index.js` nøkkelbasert på SQL-teksten.
- **`ws`** bærer live konsoll- og strømmestatistikk. Begge er **meglet**: én oppstrøms
  `docker logs --follow` (eller `docker stats`) per server, demultipleksert én gang og sendt ut til hver
  tilkoblede fane, snarere enn én oppstrøms per seer. Konsollmegleren holder en liten avspillingsbuffer
  for sent-tilkoblede faner og slipper en abonnent hvis sokkel faller for langt bak, heller enn å
  stanse den delte strømmen.
- **dockerode** er den eneste måten appen snakker med Docker på. Endepunktet er automatisk oppdaget per plattform
  (Windows navngitt pipe vs. unix socket).
- **All vedvarende tilstand lever under én katalog** (`$DATA_DIR`, standard `./data`). Kopiering av den
  katalogen migrerer hele panelet.

## Lagdeling

Avhengigheter flyter i én retning:

```
                 ┌─────────────────────────────┐
   HTTP  ───────▶│  web/routes/*  (+ mellomvare)│   parse & valider input, form svar
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

- **`web/routes/`** - én ruter per domene (`servers`, `players`, `worlds`, `crashes`, `blueprints`,
  `files`, …), montert i `web/app.js`. Rutere validerer med zod, kaller en tjeneste, og returnerer JSON
  eller gjengir en visning. Forretningslogikk hører ikke hjemme her. To ruter er montert i den **offentlige
  sonen**, før `requireAuth`: `routes/status.js` (valgfri HTML-statusider per server) og
  `routes/apiV1.js` (`/api/v1`, en skrivebeskyttet JSON API autentisert av en administrator-minted Bearer-token
  fra `services/apiTokens.js`, av med mindre aktivert i Innstillinger; se `docs/public-api.md`).
- **`services/`** - hjertet av appen. Hver tjeneste eier ett domene og kan avhenge av
  infrastruktur og andre tjenester.
- **`docker/`** - dockerode-innpakninger: `connect` (endepunktdeteksjon + daemon-helse), `containers`
  (opprett/start/stopp/gjenskap med bind-monteringer, minne/CPU-grenser og etiketter), `logs`, `stats`,
  `images`, og en `watcher` som gjør Docker-hendelser om til historikk + krasjdeteksjon.
- **`db/`** - SQLite-innpakningen og migreringskjører.
- **`storage/`** - `./data`-oppstarten, **sti-vakten** (`safeJoin`, ryggraden for filtrygghet), og
  bakgrunnsstørrelsesindeksereren + kvotehåndhevelse.

Tverrgående:

- **`config/`** - miljøkonfigurasjon pluss **feltkatalogen**: den eneste sannhetskilden for
  serverinnstillinger. Hver itzg miljøvariabel er katalogisert (etikett, hjelp, type, enhet, standard,
  validering, seksjon, fareflagg). Veiviseren, innstillingsskjemaene og zod-valideringen er alle avledet
  fra den, så å eksponere en ny innstilling er en dataendring, ikke ny UI-rørleggerarbeid.
- **`events/`** - `recordEvent()` er det ene inngangspunktet for historikkl লগgen; livssyklushendelser fanger også
  container-loggutdrag til `data/logs/<id>/events/`.
- **`ws/`** - autentiserte konsoll + statistikk WebSockets (sesjonsinformasjon verifisert ved oppgradering, `Origin`
  sjekket for å blokkere kryss-nettsteds kapring), meglet per server (se "Kjøretidsform").
- **`logger.js` + `instrument.js`** - `require('./logger')(label)` returnerer en per-modul
  [Pino](https://getpino.io)-logger; nivå fra `LOG_LEVEL`, `makeFailureThrottle()` holder en
  vedvarende feilende bakgrunnssløyfe til én logglinje pluss en "gjenopprettet" linje.
  `src/utils/logSanitize.js` fjerner kredittkortformede nøkler og webhook-tokens fra den strukturerte
  metadataen; `src/config/logLevel.js` er den delte nivåtillatelseslisten (holdt separat for å unngå en
  kravsyklus med `config`). `src/instrument.js` er en sovende Sentry-søm, lastet først i
  `src/server.js`. `src/web/middleware/requestLog.js` skriver én tilgangslogglinje per forespørsel
  (hopper over `/healthz` og statiske ressurser). ESLint håndhever `no-console` under `src/**`, med
  `preflight.js`, `instrument.js`, og `config/index.js` unntatt (de kjører før loggeren eksisterer).
- **Ratebegrensning** - `src/web/middleware/rateLimit.js` plasserer `express-rate-limit` foran `/api`
  (`RATE_LIMIT_API_PER_MIN`, standard 1200) og innloggings- / 2FA- / oppsett POST-ene
  (`RATE_LIMIT_AUTH_PER_15MIN`, standard 100); `0` deaktiverer en begrensning. Den nøkkelbaseres på `req.ip`, så
  `TRUST_PROXY` betyr noe bak en proxy. `/api/v1` har sin egen per-token begrensning
  (`RATE_LIMIT_PUBLIC_API_PER_MIN`, standard 120), nøkkelbasert på en hash av Bearer-tokenet med en IP-fallback.
  En separat per-konto myk teller i
  `src/web/middleware/auth.js` håndterer innloggingslåsing (per-IP og konto-globalt, avtagende).

## Nøkkel domeneatferd

- **Modpacks er alltid festet.** Imagene oppgraderer automatisk upinnede pakker ved hver omstart, så
  panelet løser "latest" til en konkret versjons-ID ved installasjonstidspunktet og fester den. Oppgraderinger er en
  eksplisitt orkestrert flyt (`updates/`): forhåndsvisning → sikkerhetskopiering før oppdatering → grasiøs stopp →
  re-pin → gjenskap → helseovervåking → ett-klikks tilbakestilling.
- **Overlegget for egendefinerte modifikasjoner** administreres av panelet: bruker-lagte modifikasjoner lander i det dedupliserte biblioteket og
  blir hardlenket inn i serveren slik at de overlever pakkeoppdateringer. Deaktivering er klassebevisst.
- **Porter** allokeres fra et grunnleggende skjema (spill fra `PORT_GAME_START` og oppover, RCON = spill +
  `PORT_RCON_OFFSET`, Bedrock fra `PORT_BEDROCK_START`), sjekkes for tilgjengelighet, og reserveres i
  databasen.
- **Disk-kvoter** håndheves av panelet fordi Docker ikke kan begrense bruken av bind-monteringer: indeksereren
  cacher størrelser per katalog og disk-voksende operasjoner er begrenset av dem.
- **Hemmeligheter** (RCON-passord, API-nøkler, TOTP-hemmeligheter, Discord webhook URL) er kryptert ved
  hvile med AES-256-GCM ved hjelp av en dedikert tilfeldig nøkkel på `$DATA_DIR/.secret-key` (modus `0600`,
  automatisk generert). Den er uavhengig av `SESSION_SECRET`; en `SESSION_SECRET`-avledet nøkkel beholdes som en
  kun-dekrypterings fallback for verdier skrevet før den dedikerte nøkkelen eksisterte, og
  `src/services/secretsMigration.js` krypterer disse på nytt under den dedikerte nøkkelen én gang ved oppstart.
  En `.secret-key` som eksisterer, men ikke kan parses, er en alvorlig oppstartsfeil (den blir aldri stille
  regenerert over toppen). Blåkopier striper alle hemmeligheter ved eksport.

## Data- og ledningsformater

- **`data/panel.db`** - SQLite-databasen. Snappes daglig via `VACUUM INTO` til
  `data/backups/_panel/` (de 14 nyeste beholdes); `PRAGMA integrity_check` kjøres ved oppstart.
- **`data/.session-secret`** - den automatisk genererte cookie-signeringshemmeligheten, opprettet ved første kjøring hvis
  `SESSION_SECRET` er uinnstilt. Sletting av den roterer hemmeligheten (som ugyldiggjør sesjoner).
- **`data/.secret-key`** - den dedikerte 32-byte krypteringsnøkkelen ved hvile (modus `0600`), automatisk opprettet
  ved første kjøring. Uavhengig av `SESSION_SECRET`; sletting av den gjør hver lagrede legitimasjon
  ukrypterbar, så den hører hjemme med sikkerhetskopiene dine.
- **Blåkopier (`.mcserver.zip`)** - en zip med en `manifest.json` som beskriver konfigurasjon, ressurser, den
  festede pakke-referansen, overleggsmanifestet (kilde-URL-er + sha256), valgte konfigurasjonsfiler, og
  valgfritt en verden. Import laster ned på nytt og hasj-verifiserer hver mod og tildeler nye porter.
- **Docker-containere** opprettet av panelet navngis og merkes slik at overvåkeren kan finne dem;
  panelet eier hele livssyklusen deres.

## Oppstartssekvens

1. `require('./instrument')` (Sentry-sømmen) før noe annet, deretter `require('./preflight')`
   for å feile tydelig på en ikke-støttet Node-versjon.
2. Last inn konfigurasjon; sikre/generer `.session-secret` **og** `.secret-key`.
3. `ensureDataRoot()` - opprett `./data`-layouten, tøm `tmp/`.
4. Kjør DB-migreringer, deretter `PRAGMA integrity_check` (logger høyt, peker på `data/backups/_panel`
   ved feil).
5. Krypter eventuelle eldre `SESSION_SECRET`-nøkkelbaserte hemmeligheter på nytt under `.secret-key` (`secretsMigration`).
6. Seed start-blåkopier (beskyttet).
7. Start HTTP + WS-serveren. På en eksponert bind, skriv ut den første kjøringens `/setup` PIN-kode.
8. Installer kjøretidsvakten etter oppstart (fanger ukjente feil; `MSM_EXIT_ON_FATAL=1` gjør at den
   avsluttes hardt for administrerte distribusjoner).
9. Start bakgrunnstjenester: WS-megler, lagringsindekserer, krasj- og inventarovervåkere, planlegger,
   Discord hendelsesbro, og **daglig vedlikeholdstimer** (rydd opp gamle analyse-rader + ta bilde av
   `panel.db`).
10. Initialiser Docker **i bakgrunnen**. UI-et er fullt brukbar mens daemonen er nede;
    Docker-funksjoner lyser opp når den blir tilgjengelig. Når den er tilkoblet, `refreshStatuses({ boot })`
    synkroniserer cachede statusser, sender ut en engangs `offline-after-restart`-hendelse for en server som var
    oppe før panelet startet på nytt og ikke vil bli brakt tilbake, og oppstarts-løkken starter
    `auto_start`-servere pluss gjenoppretter `auto_restart`-servere funnet krasjet under nedetiden
    (respekterer krasj-loop tilbakefall).

> Rekkefølgen instrument-før-preflight er en bevisst avveining: den lar en fremtidig Sentry-kabling
> lappe kjøretiden først, på bekostning av en litt mindre vennlig melding på en virkelig gammel Node.

## Bygg pipeline

`pnpm run build` = `build:css` (Tailwind → `public/css/app.css`) + `build:js` (esbuild →
`public/dist/js/`, ESM med kodelinjedeling). `postinstall` kjører **kun CSS**. `public/css/app.css`
og `public/dist/` er gitignorert bygg-artefakter; Dockerfile-byggestadiet kjører hele
`pnpm run build` og kopierer `public/` inn i kjøretidsimaget. Statiske ressurser serveres
`immutable`/lang-cache for fingeravtrykte filer, kort-cache for CSS/JS, og `no-cache` for HTML og
`/api`.
