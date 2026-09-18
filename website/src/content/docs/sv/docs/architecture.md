---
title: 'Arkitektur'
description: 'Minecraft Server Manager är en Node.js-applikation med en enda process, server-renderad.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/architecture.md'
---

[← Tillbaka till dokumentindex](/docs/)

Minecraft Server Manager är en Node.js-applikation med en enda process och serverrendering. Den hanterar
Minecraft-servrar som körs som Docker-containrar med hjälp av
[itzg/docker-minecraft-server](https://github.com/itzg/docker-minecraft-server)-imagen, och kommunicerar med
Docker-demonen via dess API (aldrig genom att köra `docker` CLI via skalet).

## Körningsform

- **Express + Handlebars** renderar sidor på serversidan. Det finns ingen SPA; webbläsarens JS i `public/js/`
  är handskriven progressiv förbättring. Ett esbuild-steg (`pnpm run build:js`) paketerar och
  minifierar det till `public/dist/js/`; appen serverar det paketet när det finns och den råa
  källkoden annars, så en utvecklingskörning utan byggnation fungerar fortfarande.
- **`node:sqlite`** (inbyggt i Node; panelen kräver Node ≥ 24) är databasen – synkron,
  inga externa moduler, WAL-läge. En liten versionshanterad migreringskörare tillämpar `src/db/migrations/*` vid
  uppstart. Förberedda satser cachas i `src/db/index.js` med SQL-texten som nyckel.
- **`ws`** hanterar strömmarna för livekonsol och statistik. Båda är **förmedlade**: en uppströms
  `docker logs --follow` (eller `docker stats`) per server, demuxad en gång och förgrenad till varje
  ansluten flik, snarare än en uppströms per visare. Konsolförmedlaren behåller en liten återspelningsbuffert
  för sent anslutna flikar och släpper en prenumerant vars socket hamnar för långt efter snarare än
  att sakta ner den delade strömmen.
- **dockerode** är det enda sättet appen kommunicerar med Docker. Ändpunkten upptäcks automatiskt per plattform
  (Windows namngiven pipe vs. unix socket).
- **All beständig data finns under en enda katalog** (`$DATA_DIR`, standard `./data`). Att kopiera den
  katalogen migrerar hela panelen.

## Lagerindelning

Beroenden flödar i en riktning:

```
                 ┌─────────────────────────────┐
   HTTP  ───────▶│  web/routes/*  (+ middleware)│   parsa & validera input, forma svar
                 └──────────────┬──────────────┘
                                │
                 ┌──────────────▼──────────────┐
                 │         services/*          │   domänlogik (de faktiska funktionerna)
                 └───┬─────────┬─────────┬─────┘
                     │         │         │
        ┌────────────▼──┐ ┌────▼────┐ ┌──▼──────────┐
        │   docker/*    │ │  db/*   │ │  storage/*  │   infrastruktur
        └───────────────┘ └─────────┘ └─────────────┘
```

- **`web/routes/`** - en router per domän (`servers`, `players`, `worlds`, `crashes`, `blueprints`,
  `files`, …), monterad i `web/app.js`. Routrar validerar med zod, anropar en tjänst och returnerar JSON
  eller renderar en vy. Affärslogik hör inte hemma här. Två routrar monteras i den **offentliga zonen**,
  före `requireAuth`: `routes/status.js` (valfria HTML-status sidor per server) och
  `routes/apiV1.js` (`/api/v1`, ett skrivskyddat JSON API autentiserat av en administratörsgenererad Bearer-token
  från `services/apiTokens.js`, avstängt om det inte är aktiverat i Inställningar; se `docs/public-api.md`).
- **`services/`** - hjärtat i appen. Varje tjänst äger en domän och kan bero på
  infrastruktur och på andra tjänster.
- **`docker/`** - dockerode-inpackningar: `connect` (ändpunktsdetektering + daemon-hälsa), `containers`
  (skapa/starta/stoppa/återskapa med bind-mounts, minnes-/CPU-gränser och etiketter), `logs`, `stats`,
  `images`, och en `watcher` som omvandlar Docker-händelser till historik + kraschdetektering.
- **`db/`** - SQLite-inpackningen och migreringsköraren.
- **`storage/`** - `./data`-starten, **sökvägsvakten** (`safeJoin`, ryggraden för filsäkerhet), och den bakomliggande storleksindexeraren + kvothantering.

Övergripande:

- **`config/`** - miljökonfiguration plus **fältkatalogen**: den enda sanningskällan för
  serverinställningar. Varje itzg-miljövariabel katalogiseras (etikett, hjälp, typ, enhet, standard,
  validering, sektion, faro-flaggor). Guiden, inställningsformulären och zod-valideringen härleds alla
  från den, så att exponera en ny inställning är en dataändring, inte ny UI-dragning.
- **`events/`** - `recordEvent()` är den enda ingångspunkten för historikloggen; livscykelhändelser fångar också
  utdrag från containerloggar till `data/logs/<id>/events/`.
- **`ws/`** - autentiserade konsol + statistik WebSockets (sessionscookie verifierad vid uppgradering, `Origin`
  kontrollerad för att blockera cross-site hijacking), förmedlad per server (se "Körningsform").
- **`logger.js` + `instrument.js`** - `require('./logger')(label)` returnerar en per-modul
  [Pino](https://getpino.io)-logger; nivå från `LOG_LEVEL`, `makeFailureThrottle()` håller en
  ihållande felande bakgrundsslinga till en loggrad plus en "återställd" rad.
  `src/utils/logSanitize.js` redigerar nycklar med format för autentiseringsuppgifter och webhook-tokens från den strukturerade
  metadatan; `src/config/logLevel.js` är den delade tillåtna nivån (hålls separat för att undvika en kravcykel med `config`). `src/instrument.js` är en vilande Sentry-söm, laddad först i
  `src/server.js`. `src/web/middleware/requestLog.js` skriver en accessloggrad per begäran
  (hoppar över `/healthz` och statiska tillgångar). ESLint tvingar `no-console` under `src/**`, med
  `preflight.js`, `instrument.js`, och `config/index.js` undantagna (de körs innan loggern finns).
- **Rate limiting** - `src/web/middleware/rateLimit.js` placerar `express-rate-limit` framför `/api`
  (`RATE_LIMIT_API_PER_MIN`, standard 1200) och inloggnings- / 2FA- / setup POST-begäranden
  (`RATE_LIMIT_AUTH_PER_15MIN`, standard 100); `0` inaktiverar en begränsare. Den nycklar på `req.ip`, så
  `TRUST_PROXY` spelar roll bakom en proxy. `/api/v1` har sin egen begränsare per token
  (`RATE_LIMIT_PUBLIC_API_PER_MIN`, standard 120), nycklad på en hash av Bearer-token med IP som fallback. En separat mjuk räknare per konto i
  `src/web/middleware/auth.js` hanterar inloggningslåsningen (per IP och globalt per konto, avtagande).

## Viktiga domänbeteenden

- **Modpacks är alltid fastlåsta.** Imagen uppgraderar automatiskt olåsta paket vid varje omstart, så
  panelen löser "senaste" till ett konkret versions-ID vid installation och låser det. Uppgraderingar är ett
  explicit orkestrerat flöde (`updates/`): förhandsgranskning → säkerhetskopiering före uppdatering → graciös stopp → omlåsning →
  återskapande → hälsoövervakning → återställning med ett klick.
- **Överlagringen för anpassade mods** hanteras av panelen: användartillagda mods hamnar i det deduplicerade biblioteket och
  länkas hårt in i servern så att de överlever pack-uppdateringar. Avaktivering är klassmedveten.
- **Portar** allokeras från ett bas-schema (spel från `PORT_GAME_START` och uppåt, RCON = spel +
  `PORT_RCON_OFFSET`, Bedrock från `PORT_BEDROCK_START`), provas för tillgänglighet och reserveras i
  databasen.
- **Disk-kvoter** upprätthålls av panelen eftersom Docker inte kan begränsa användningen av bind-mounts: indexeraren
  cachar storlekar per katalog och disk-växande operationer begränsas av dem.
- **Hemligheter** (RCON-lösenord, API-nycklar, TOTP-hemligheter, Discord webhook-URL) krypteras i vila med AES-256-GCM med en dedikerad slumpmässig nyckel vid `$DATA_DIR/.secret-key` (läge `0600`,
  automatiskt genererad). Den är oberoende av `SESSION_SECRET`; en nyckel härledd från `SESSION_SECRET` behålls som en fallback endast för dekryptering för värden som skrivits innan den dedikerade nyckeln fanns, och
  `src/services/secretsMigration.js` krypterar om dessa under den dedikerade nyckeln en gång vid uppstart.
  En `.secret-key` som finns men inte kan parsas är ett allvarligt uppstartsfel (den genereras aldrig tyst
  över befintlig). Blåkopior tar bort alla hemligheter vid export.

## Data- och trådformat

- **`data/panel.db`** - SQLite-databasen. Ögonblicksbilder tas dagligen via `VACUUM INTO` till
  `data/backups/_panel/` (senaste 14 behålls); `PRAGMA integrity_check` körs vid uppstart.
- **`data/.session-secret`** - den automatiskt genererade hemligheten för cookie-signering, skapad vid första körningen om
  `SESSION_SECRET` är odefinierad. Att ta bort den roterar hemligheten (vilket ogiltigförklarar sessioner).
- **`data/.secret-key`** - den dedikerade 32-byte krypteringsnyckeln i vila (läge `0600`), automatiskt skapad
  vid första körningen. Oberoende av `SESSION_SECRET`; att ta bort den gör varje lagrad autentiseringsuppgift
  okrypterbar, så den hör hemma med dina säkerhetskopior.
- **Blåkopior (`.mcserver.zip`)** - en zip med en `manifest.json` som beskriver konfiguration, resurser,
  den fastlåsta pack-referensen, överlagringsmanifestet (käll-URL:er + sha256), valda konfigurationsfiler och
  eventuellt en värld. Import laddar ner igen och hash-verifierar varje mod och tilldelar nya portar.
- **Docker-containrar** som skapas av panelen namnges och etiketteras så att övervakaren kan hitta dem;
  panelen äger deras fullständiga livscykel.

## Uppstartssekvens

1. `require('./instrument')` (Sentry-sömmen) före allt annat, sedan `require('./preflight')`
   för att tydligt misslyckas vid en inkompatibel Node-version.
2. Ladda konfiguration; säkerställ/generera `.session-secret` **och** `.secret-key`.
3. `ensureDataRoot()` - skapa `./data`-layouten, rensa `tmp/`.
4. Kör DB-migreringar, sedan `PRAGMA integrity_check` (loggar högt, pekar på `data/backups/_panel`
   vid fel).
5. Kryptera om eventuella äldre hemligheter nycklade med `SESSION_SECRET` under `.secret-key` (`secretsMigration`).
6. Fyll på start-blåkopior (skyddad).
7. Starta HTTP + WS-servern. Vid en exponerad bindning, skriv ut den första körningens `/setup` PIN-kod.
8. Installera körningsvakten efter uppstart (fångar ohanterade fel; `MSM_EXIT_ON_FATAL=1` gör att den avslutas hårt för övervakade driftsättningar).
9. Starta bakgrundstjänster: WS-förmedlare, lagringsindexerare, krasch- och inventeringsövervakare, schemaläggare,
   Discord-händelsebrygga och **dagliga underhållstimern** (rensa gamla analysrader + ögonblicksbild av
   `panel.db`).
10. Initiera Docker **i bakgrunden**. Gränssnittet är fullt användbart medan demonen är nere;
    Docker-funktioner aktiveras när den blir nåbar. När ansluten, `refreshStatuses({ boot })`
    synkroniserar cachade statusar, skickar en engångshändelse `offline-after-restart` för en server som var
    igång innan panelen startades om och inte kommer att startas igen, och uppstartsloopen startar
    `auto_start`-servrar plus återställer `auto_restart`-servrar som hittats kraschade under avbrottet
    (med hänsyn till backoff vid kraschloop).

> Ordningen instrument-före-preflight är en medveten avvägning: den tillåter en framtida Sentry-koppling
> att patcha körningen först, till priset av ett något mindre vänligt meddelande vid en riktigt gammal Node.

## Byggpipeline

`pnpm run build` = `build:css` (Tailwind → `public/css/app.css`) + `build:js` (esbuild →
`public/dist/js/`, ESM med koddelning). `postinstall` kör **endast CSS**. `public/css/app.css`
och `public/dist/` är gitignorerade byggartefakter; Dockerfile-byggstadiet kör hela
`pnpm run build` och kopierar `public/` in i körningsimagen. Statiska tillgångar serveras
med `immutable`/lång cache för fingerprintade filer, kort cache för CSS/JS, och `no-cache` för HTML och
`/api`.
