---
title: 'Architectuur'
description: 'Minecraft Server Manager is een single-process, server-rendered Node.js-applicatie.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/architecture.md'
---

[← Terug naar de documentatie-index](/docs/)

Minecraft Server Manager is een single-process, server-gerenderde Node.js-applicatie. Het beheert
Minecraft-servers die draaien als Docker-containers met behulp van de
[itzg/docker-minecraft-server](https://github.com/itzg/docker-minecraft-server) image, en communiceert
met de Docker daemon via de API (nooit door de `docker` CLI aan te roepen).

## Runtime structuur

- **Express + Handlebars** renderen pagina's aan de serverzijde. Er is geen SPA; de browser JS in `public/js/`
  is handgeschreven progressieve verbetering. Een esbuild stap (`pnpm run build:js`) bundelt en
  minificeert het naar `public/dist/js/`; de app serveert die bundel wanneer deze aanwezig is en anders de
  ruwe broncode, zodat een ontwikkelingsrun zonder build nog steeds werkt.
- **`node:sqlite`** (ingebouwd in Node; het paneel vereist Node ≥ 24) is de database - synchroon,
  nul native modules, WAL-modus. Een kleine versie-migratie-runner past `src/db/migrations/*` toe bij
  het opstarten. Prepared statements worden in `src/db/index.js` in de cache opgeslagen, gesleuteld op de SQL-tekst.
- **`ws`** draagt de live console- en statistiekstreams. Beide zijn **gefaciliteerd**: één upstream
  `docker logs --follow` (of `docker stats`) per server, éénmalig gedemuxed en uitgesplitst naar elke
  verbonden tab, in plaats van één upstream per kijker. De console-broker houdt een kleine replay-buffer
  aan voor laat-aangekomen tabbladen en laat een abonnee vallen wiens socket te ver achterop raakt, in plaats van
  de gedeelde stream te vertragen.
- **dockerode** is de enige manier waarop de app met Docker praat. Het eindpunt wordt automatisch gedetecteerd per platform
  (Windows named pipe versus unix socket).
- **Alle persistente staat bevindt zich onder één map** (`$DATA_DIR`, standaard `./data`). Het kopiëren van die
  map migreert het hele paneel.

## Gelaagdheid

Afhankelijkheden stromen in één richting:

```
                 ┌─────────────────────────────┐
   HTTP  ───────▶│  web/routes/*  (+ middleware)│   parse & valideer input, vorm responses
                 └──────────────┬──────────────┘
                                │
                 ┌──────────────▼──────────────┐
                 │         services/*          │   domeinlogica (de daadwerkelijke functies)
                 └───┬─────────┬─────────┬─────┘
                     │         │         │
        ┌────────────▼──┐ ┌────▼────┐ ┌──▼──────────┐
        │   docker/*    │ │  db/*   │ │  storage/*  │   infrastructuur
        └───────────────┘ └─────────┘ └─────────────┘
```

- **`web/routes/`** - één router per domein (`servers`, `players`, `worlds`, `crashes`, `blueprints`,
  `files`, …), gemount in `web/app.js`. Routers valideren met zod, roepen een service aan en retourneren JSON
  of renderen een weergave. Bedrijfslogica hoort hier niet thuis. Twee routers zijn gemount in de **publieke
  zone**, vóór `requireAuth`: `routes/status.js` (optionele HTML-statuspagina's per server) en
  `routes/apiV1.js` (`/api/v1`, een alleen-lezen JSON API geauthenticeerd door een door de admin uitgegeven Bearer-token
  van `services/apiTokens.js`, uitgeschakeld tenzij ingeschakeld in Instellingen; zie `docs/public-api.md`).
- **`services/`** - het hart van de app. Elke service beheert één domein en kan afhankelijk zijn van
  infrastructuur en van andere services.
- **`docker/`** - dockerode wrappers: `connect` (eindpuntdetectie + daemon-gezondheid), `containers`
  (creëren/starten/stoppen/opnieuw creëren met bind mounts, geheugen/CPU-limieten en labels), `logs`, `stats`,
  `images`, en een `watcher` die Docker-gebeurtenissen omzet in geschiedenis + crashdetectie.
- **`db/`** - de SQLite wrapper en migratie-runner.
- **`storage/`** - de `./data` bootstrap, de **padbewaker** (`safeJoin`, de ruggengraat voor bestandsveiligheid), en de achtergrond-grootte-indexer + quotumhandhaving.

Cross-cutting:

- **`config/`** - omgevingsconfiguratie plus de **veldencatalogus**: de enige bron van waarheid voor
  serverinstellingen. Elke itzg omgevingsvariabele is gecatalogiseerd (label, hulp, type, eenheid, standaard,
  validatie, sectie, gevaren vlaggen). De wizard, instellingsformulieren en zod-validatie worden hier allemaal van afgeleid,
  dus het blootstellen van een nieuwe instelling is een gegevenswijziging, geen nieuwe UI-installatie.
- **`events/`** - `recordEvent()` is het enige toegangspunt voor het geschiedenislogboek; levenscyclusgebeurtenissen
  leggen ook container-logfragmenten vast in `data/logs/<id>/events/`.
- **`ws/`** - geauthenticeerde console + statistieken WebSockets (sessiecookie geverifieerd bij upgrade, `Origin`
  gecontroleerd om cross-site hijacking te blokkeren), gefaciliteerd per server (zie "Runtime structuur").
- **`logger.js` + `instrument.js`** - `require('./logger')(label)` retourneert een per-module
  [Pino](https://getpino.io) logger; niveau van `LOG_LEVEL`, `makeFailureThrottle()` houdt een
  permanent falende achtergrondlus bij tot één logregel plus een "herstelde" regel.
  `src/utils/logSanitize.js` maskeert credential-vormige sleutels en webhook-tokens uit de gestructureerde
  metadata; `src/config/logLevel.js` is de gedeelde niveau-toegestane lijst (apart gehouden om een vereiste cyclus met
  `config` te vermijden). `src/instrument.js` is een slapende Sentry-naad, als eerste geladen in
  `src/server.js`. `src/web/middleware/requestLog.js` schrijft één access-logregel per verzoek
  (waarbij `/healthz` en statische assets worden overgeslagen). ESLint handhaaft `no-console` onder `src/**`, met
  `preflight.js`, `instrument.js`, en `config/index.js` vrijgesteld (deze worden uitgevoerd voordat de logger bestaat).
- **Rate limiting** - `src/web/middleware/rateLimit.js` plaatst `express-rate-limit` vóór `/api`
  (`RATE_LIMIT_API_PER_MIN`, standaard 1200) en de login / 2FA / setup POSTs
  (`RATE_LIMIT_AUTH_PER_15MIN`, standaard 10); `0` schakelt een limiter uit. Het is gebaseerd op `req.ip`, dus
  `TRUST_PROXY` is belangrijk achter een proxy. `/api/v1` heeft zijn eigen limiter per token
  (`RATE_LIMIT_PUBLIC_API_PER_MIN`, standaard 120), gebaseerd op een hash van het Bearer-token met een IP-fallback. Een aparte per-account zachte teller in
  `src/web/middleware/auth.js` beheert de login-vergrendeling (per-IP en globaal per account, vervallend).

## Belangrijkste domeingedragingen

- **Modpacks worden altijd vastgezet.** De image upgrade automatisch niet-vastgezette packs bij elke herstart, dus
  het paneel lost "latest" op naar een concrete versie-ID bij installatie en zet deze vast. Upgrades zijn een
  expliciete georkestreerde flow (`updates/`): preview → pre-update backup → gracieuze stop → opnieuw vastzetten →
  opnieuw creëren → gezondheidsmonitor → rollback met één klik.
- **De custom-mod overlay** wordt beheerd door het paneel: door de gebruiker toegevoegde mods komen in de deduplicerende bibliotheek en
  worden hard-gelinkt in de server, zodat ze pack-updates overleven. Uitschakelen is klasse-bewust.
- **Poorten** worden toegewezen uit een basisregeling (game vanaf `PORT_GAME_START` omhoog, RCON = game +
  `PORT_RCON_OFFSET`, Bedrock vanaf `PORT_BEDROCK_START`), gecontroleerd op beschikbaarheid, en gereserveerd in
  de DB.
- **Schijfquota's** worden afgedwongen door het paneel omdat Docker geen bind-mount-gebruik kan beperken: de indexeerder
  cachet groottes per map en schijfgroei-operaties worden hierop gebaseerd.
- **Geheimen** (RCON-wachtwoorden, API-sleutels, TOTP-geheimen, de Discord webhook URL) worden versleuteld opgeslagen
  met AES-256-GCM met behulp van een speciale willekeurige sleutel op `$DATA_DIR/.secret-key` (modus `0600`,
  automatisch gegenereerd). Het is onafhankelijk van `SESSION_SECRET`; een van `SESSION_SECRET` afgeleide sleutel wordt bewaard als
  een alleen-ontsleutelende fallback voor waarden die zijn geschreven voordat de speciale sleutel bestond, en
  `src/services/secretsMigration.js` versleutelt die opnieuw onder de speciale sleutel bij het opstarten.
  Een `.secret-key` die bestaat maar niet kan worden geparsed, is een harde opstartfout (het wordt nooit stilzwijgend
  opnieuw gegenereerd). Blauwdrukken strippen alle geheimen bij export.

## Data & wire formats

- **`data/panel.db`** - de SQLite database. Dagelijks gesnapt via `VACUUM INTO` naar
  `data/backups/_panel/` (laatste 14 bewaard); `PRAGMA integrity_check` wordt uitgevoerd bij het opstarten.
- **`data/.session-secret`** - het automatisch gegenereerde cookie-ondertekeningsgeheim, aangemaakt bij de eerste run als
  `SESSION_SECRET` niet is ingesteld. Het verwijderen ervan roteert het geheim (wat sessies ongeldig maakt).
- **`data/.secret-key`** - de speciale 32-byte encryptiesleutel voor data-at-rest (modus `0600`), automatisch aangemaakt
  bij de eerste run. Onafhankelijk van `SESSION_SECRET`; het verwijderen ervan maakt elk opgeslagen geheim
  onontsleutelbaar, dus het hoort bij uw back-ups.
- **Blauwdrukken (`.mcserver.zip`)** - een zip met een `manifest.json` die configuratie, bronnen, de
  vastgezette pack-referentie, de overlay-manifest (bron-URL's + sha256), gekozen configuratiebestanden, en
  optioneel een wereld beschrijft. Import downloadt opnieuw en verifieert de hash van elke mod en wijst nieuwe poorten toe.
- **Docker containers** aangemaakt door het paneel worden benoemd en gelabeld zodat de watcher ze kan vinden;
  het paneel beheert hun volledige levenscyclus.

## Opstartvolgorde

1. `require('./instrument')` (de Sentry-naad) vóór al het andere, dan `require('./preflight')`
   om duidelijk te falen bij een niet-ondersteunde Node-versie.
2. Laad configuratie; zorg voor/genereer `.session-secret` **en** `.secret-key`.
3. `ensureDataRoot()` - maak de `./data` structuur aan, wis `tmp/`.
4. Voer DB-migraties uit, dan `PRAGMA integrity_check` (logt luid, wijst naar `data/backups/_panel`
   bij falen).
5. Versleutel eventuele legacy `SESSION_SECRET`-gesleutelde geheimen opnieuw onder `.secret-key` (`secretsMigration`).
6. Zaai starter-blauwdrukken (beschermd).
7. Start de HTTP + WS server. Op een blootgestelde bind, print de eerste-run `/setup` PIN.
8. Installeer de runtime-bewaker na het opstarten (vangt niet-gevangen fouten op; `MSM_EXIT_ON_FATAL=1` zorgt voor een harde exit voor beheerde implementaties).
9. Start achtergrondservices: WS-broker, opslag-indexer, crash- en inventaris-watchers, scheduler,
   Discord event bridge, en de **dagelijkse onderhoudstimer** (verwijder oude analytics-rijen + snapshot
   `panel.db`).
10. Initialiseer Docker **op de achtergrond**. De UI is volledig bruikbaar terwijl de daemon uit staat;
    Docker-functies lichten op wanneer deze bereikbaar wordt. Eenmaal verbonden, `refreshStatuses({ boot })`
    reconcilieert de gecachte statussen, geeft een eenmalig `offline-after-restart` gebeurtenis uit voor een server die
    aan stond voordat het paneel opnieuw opstartte en niet zal worden teruggezet, en de opstartlus start
    `auto_start` servers plus herstelt `auto_restart` servers die tijdens de storing gecrasht zijn gevonden
    (met inachtneming van crash-loop backoff).

> De instrument-vóór-preflight volgorde is een bewuste afweging: het laat een toekomstige Sentry-bedrading
> de runtime eerst patchen, ten koste van een iets minder vriendelijke boodschap bij een werkelijk oude Node.

## Build pipeline

`pnpm run build` = `build:css` (Tailwind → `public/css/app.css`) + `build:js` (esbuild →
`public/dist/js/`, ESM met code-splitting). `postinstall` voert **alleen CSS** uit. `public/css/app.css`
en `public/dist/` zijn git-genegeerde build-artefacten; de Dockerfile build-fase voert de volledige
`pnpm run build` uit en kopieert `public/` naar de runtime-image. Statische assets worden geserveerd
met `immutable`/lange cache voor bestanden met fingerprint, korte cache voor CSS/JS, en `no-cache` voor HTML en
`/api`.
