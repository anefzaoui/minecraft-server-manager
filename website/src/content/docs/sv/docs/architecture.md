---
title: 'Arkitektur'
description: 'Minecraft Server Manager är en Node.js-applikation med en enda process, server-renderad.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/architecture.md'
---

[← Tillbaka till dokumentindex](/docs/)

Minecraft Server Manager är en fristående, server-renderad Node.js-applikation. Den hanterar
Minecraft-servrar som körs som Docker-containrar med hjälp av
[itzg/docker-minecraft-server](https://github.com/itzg/docker-minecraft-server)-imagen, och kommunicerar
med Docker-demonen via dess API (aldrig genom att köra `docker` CLI via skalet).

## Körtidsstruktur

- **Express + Handlebars** renderar sidor på serversidan. Det finns ingen SPA; webbläsarens JS i `public/js/`
  är handskriven progressiv förbättring. Ett esbuild-steg (`pnpm run build:js`) paketerar och
  minifierar det till `public/dist/js/`; appen serverar det paketet när det finns och den råa
  källkoden annars, så en utvecklingskörning utan byggnation fungerar fortfarande.
- **`node:sqlite`** (inbyggt i Node; panelen kräver Node ≥ 24) är databasen – synkron,
  noll externa moduler, WAL-läge. En liten versionshanterad migrationskörning tillämpar `src/db/migrations/*` vid
  uppstart. Förberedda satser cachas i `src/db/index.js` med SQL-texten som nyckel.
- **`ws`** hanterar live-konsol- och statistikströmmarna. Båda är **förmedlade**: en uppströms
  `docker logs --follow` (eller `docker stats`) per server, demuxad en gång och distribuerad till varje
  ansluten flik, snarare än en uppströms per tittare. Konsolförmedlaren behåller en liten återspelningsbuffert
  för sent anslutna flikar och släpper en prenumerant vars socket hamnar för långt efter, snarare än
  att sakta ner den delade strömmen.
- **`dockerode`** är det enda sättet appen pratar med Docker. Ändpunkten upptäcks automatiskt per plattform
  (Windows namngiven pipe vs. unix socket).
- **All persistent data finns under en enda katalog** (`$DATA_DIR`, standard `./data`). Att kopiera den
  katalogen migrerar hela panelen.

## Lagerindelning

Beroenden flödar i en riktning:

```
                 ┌─────────────────────────────┐
   HTTP  ───────▶│  web/routes/*  (+ middleware)│   parsar & validerar input, formar svar
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

- **`web/routes/`** - en router per domän (`players`, `worlds`, `crashes`, `blueprints`, `files`, …).
  `web/app.js` monterar de översta nivåerna (`api.js`, sessionens JSON API som också innehåller kärnserver-routerna och monterar domänrouterna per server; `index.js`, sidorna; `auth`, `account`,
  `tasks`, …). Routrar validerar med zod, anropar en tjänst och returnerar JSON
  eller renderar en vy. Affärslogik hör inte hemma här. Två routrar monteras i **offentliga zonen**, före `requireAuth`: `routes/status.js` (valfri HTML-status per server) och
  `routes/apiV1.js` (`/api/v1`, ett skrivskyddat JSON API autentiserat av en administratörsgenererad Bearer-token från `services/apiTokens.js`, avstängt om det inte är aktiverat i Inställningar; se `docs/public-api.md`).
- **`services/`** - hjärtat i appen. Varje tjänst äger en domän och kan bero på
  infrastruktur och på andra tjänster.
- **`docker/`** - dockerode-inpackningar: `connect` (ändpunktsdetektering + demonhälsa), `containers`
  (skapa/starta/stoppa/återskapa med bind-mounts, minnes-/CPU-gränser och etiketter), `logs`, `stats`,
  `images`, `networks` (upptäckt av värdnätverk), `hostPath` (rotar om bind-vägar under
  `DATA_DIR_HOST`), och en `watcher` som omvandlar Docker-händelser till historik + kraschdetektering.
- **`db/`** - SQLite-inpackningen och migrationskörningen.
- **`storage/`** - `./data`-bootstrappen, **väktaren för sökvägar** (`safeJoin`, ryggraden för filsäkerhet), och bakgrundsindexeraren + kvothanteringen.

Övergripande:

- **`config/`** - miljökonfiguration plus **katalogkatalogen**: den enda sanningskällan för
  serverinställningar. Varje itzg-miljövariabel är katalogiserad (etikett, hjälp, typ, enhet, standard,
  validering, sektion, faroetiketter). Guiden, inställningsformulären och zod-valideringen härleds alla
  från den, så att exponera en ny inställning är en dataändring, inte ny UI-dragning.
- **`events/`** - `recordEvent()` är den enda ingångspunkten för historikloggen; livscykelhändelser
  fångar också utdrag från containerloggar till `data/logs/<id>/events/`.
- **`ws/`** - autentiserade WebSockets för konsol + statistik (sessionscookie verifierad vid uppgradering, `Origin` kontrollerad för att blockera cross-site hijacking), förmedlad per server (se "Körtidsstruktur").
- **`logger.js` + `instrument.js`** - `require('./logger')(label)` returnerar en per-modul
  [Pino](https://getpino.io)-logger; nivå från `LOG_LEVEL`, `makeFailureThrottle()` håller en
  ihållande misslyckad bakgrundsslinga till en loggrad plus en "återställd" rad.
  `src/utils/logSanitize.js` redigerar nycklar med format för autentiseringsuppgifter och webhook-token från den strukturerade metadatan; `src/config/logLevel.js` är den delade nivås tillåtna lista (hålls separat för att undvika en kravcykel med `config`). `src/instrument.js` är en vilande Sentry-söm, laddad först i
  `src/server.js`. `src/web/middleware/requestLog.js` skriver en åtkomstloggrad per begäran
  (hoppar över `/healthz` och statiska tillgångar). ESLint tvingar `no-console` under `src/**`, med
  `preflight.js`, `instrument.js`, och `config/index.js` undantagna (de körs innan loggern finns).
- **Rate limiting** - `src/web/middleware/rateLimit.js` placerar `express-rate-limit` framför `/api`
  (`RATE_LIMIT_API_PER_MIN`, standard 1200) och inloggnings- / 2FA- / inställnings-POST-begäranden
  (`RATE_LIMIT_AUTH_PER_15MIN`, standard 100); `0` inaktiverar en begränsare. Den nycklar på `req.ip`, så
  `TRUST_PROXY` är viktigt bakom en proxy. `/api/v1` har sina egna begränsare: ett tak per klient-IP
  (fem gånger budgeten per token) som körs innan token verifieras, sedan en budget per token
  (`RATE_LIMIT_PUBLIC_API_PER_MIN`, standard 120) nycklad på den verifierade tokenens ID. En
  separat mjuk räknare per konto i
  `src/web/middleware/auth.js` hanterar inloggningslåsningen (per IP och globalt för kontot, avtagande).
- **Auktorisering**: två lager. Den globala rollen (`requireAuth` → `requireRole` / `requireWrite` i
  `src/web/middleware/auth.js`) styr panelomfattande åtgärder och är standard för varje server. Behörigheter per server
  (`src/services/permissions.js`, nio kapaciteter lagrade som en JSON-lista per
  `(användare, server)` i `user_server_permissions`) förfinar standarden för en server; varje
  `/api/servers/:id`-rutt, sub-router-montering, sida, WebSocket och flottomfattande listning går igenom
  `src/web/middleware/serverAccess.js` (`serverScope`, monterad på prefixet `/servers/:id` för både
  API:et och sidroutern, döljer en server utan `view` som en 404; `requireCap(cap)` namnger
  kapaciteten en rutt behöver). Skrivningar som namnger sin server i kroppen (scheman, världsextraktion och installation, blueprint-export) öppnas för tittare av `requireWrite` endast för den servern, och varje sådan rutt kontrollerar kapaciteten själv. `test/permissions-routes.test.js` går igenom de levande routerstackarna och misslyckas om en server-omfattande skrivrutt, montering eller sida saknar en grind.

## Viktiga domänbeteenden

- **Modpacks är alltid fastlåsta.** Imagen uppgraderar automatiskt olåsta paket vid varje omstart, så panelen löser "senaste" till ett konkret versions-ID vid installation och låser det. Uppgraderingar är ett explicit orkestrerat flöde (`updates/`): förhandsgranskning → säkerhetskopiering före uppdatering → graciös stopp → om-låsning → återskapande → hälsomonitor → återställning med ett klick.
- **Överlagringen för anpassade moddar** hanteras av panelen: användartillagda moddar hamnar i det deduplicerade biblioteket och länkas hårt in i servern så att de överlever paketuppdateringar. Inaktivering är klassmedveten. Eftersom biblioteket behåller varje nedladdad byggnation, registrerar en uppdatering den ersatta byggnationen
  (`server_content.previous_*`) och kan återställas från lokala filer ensam. Att inaktivera en paketmod
  skriver paketets exkluderingsmiljövariabel istället; `packs.applyPack` hanterar det och resten av paketinställningarna (`PACK_TUNING_KEYS`) över en versionsändring av samma paket, och tar bort det när paketet ändras.
- **En uppgradering av Minecraft-versionen måste förtjänas.** `services/compat.js` skannar serverns moddar – lösta från panelinstallerade rader, sedan CurseForge-paketmanifestet, sedan efter innehållshash mot Modrinth/CurseForge – och bygger en (laddare, Minecraft-version) supportmatris per projekt ur CurseForges `latestFilesIndexes` (200 projekt per begäran) och Modrinths versionslista per projekt (en begäran per projekt, vilket är vad som håller laddare och version ihopkopplade). Uppdateringskontrollern erbjuder endast den nyaste versionen SOM VARJE mod stöder, och erbjuder ingenting alls när svaret inte kan fastställas: ingen skanning, en skanning för en annan version eller laddare, en som aldrig avslutades, eller en jar som ingen av registren känner igen. Skanningar är endast manuella, och deras framsteg och partiella resultat finns i `version_compat` (inte i minnesbaserade `services/tasks.js`), så en uppdatering eller en panelomstart fortsätter istället för att hänga på en spinner; `reconcileScans()` markerar skanningar som föräldralösa vid en avstängning vid nästa uppstart.
- **Modladdarens version är en fastlåsning, som allt annat.** `services/loaderPin.js` läser den installerade byggnationen från imagen egen installationsmanifest (`.forge-manifest.json` och liknande) och skriver fastlåsningen: laddarens itzg-variabel på en vanlig server (`FORGE_VERSION`, …), eller
  `CF_MOD_LOADER_VERSION` på ett Forge- eller Fabric CurseForge-paket, vilket åsidosätter den version paketet deklarerar. Imagen CurseForge-installatör ignorerar det åsidosättandet för NeoForge, och Modrinth- och FTB-paket har ingen, så deras laddare följer paketet. `packs.applyPack` tar bort alla `CF_`-variabler vid en paketuppdatering eller återställning, vilket tar bort ett åsidosättande med resten. En typad byggnation kontrolleras mot registrets fullständiga lista först (`services/loaderVersions.js`; Forges kommer från dess maven-metadata, som hoppar över nummer; en miss kontrolleras igen en gång mot registret självt), sedan är ändringen säkerhetskopiering → fastlåsning (över miljön som den är efter säkerhetskopieringen) → återbyggnad.
- **Portar** allokeras från ett bas-schema (spel från `PORT_GAME_START` och uppåt, RCON = spel +
  `PORT_RCON_OFFSET`, Bedrock från `PORT_BEDROCK_START`), provas för tillgänglighet och reserveras i
  databasen. "Upptaget" är unionen av varje servers anspråk (live-portar, plus ett väntande par nedan),
  varje värdport som en Docker-container publicerar (`containers.publishedHostPorts`: körande
  containrars live-bindningar plus varje stoppad containers konfigurerade, eftersom en OS-bind-provning
  från insidan av panelens egen container bara ser den containerns nätverksnamnrymd), och OS-provet. Docker-delen cachas i 3 s och begränsas: en lista som inte svarar på 2,5 s släpper bara Docker-delen, och en långsam inspektion kostar bara den containerns portar. Server-skapelser och
  `servers.changeGamePort` väljer portar genom en serialiseringskedja som bara täcker valet
  och dess anspråk (radskrivningen för en skapelse, minnesreservationen för en portändring);
  BlueMaps portväljare och de extra port-åsidosättningarna är inte med i den och
  konsulterar inte Docker. En portändring på en befintlig server (`servers.changeGamePort`, under serverns op-lås) tillämpas omedelbart, eftersom Docker fixar portbindningar vid container-skapande:
  det nya paret (RCON alltid spel + `PORT_RCON_OFFSET`) kontrolleras och reserveras i minnet
  (`ports.reserve`, både det gamla och det nya paret, respekteras av varje annat val) under port-låset. Det vägras (409 `PENDING_CHANGES`) medan andra inställningar väntar på en återbyggnad, så det återbygger bara en container som redan körts, på en ny port; och en körande server ändras bara när begäran säger `restart: true` (annars 409 `NEEDS_CONFIRM`). Imagen dras och ett anpassat containernamn kontrolleras innan något vidrörs. En körande server stoppas; sedan skrivs det nya paret med `pending_recreate = 1` (så en panelkrasch därifrån lämnar en ärlig "återbyggnad väntar"), containern tas bort, återbyggs på det nya paret och startas. Om något steg efter stoppet misslyckas, skriver `putBackOnOldPort` tillbaka det gamla paret, återbygger (och startar om, om den kördes) på det och registrerar vilket steg som misslyckades; historik och varningar säger om även det misslyckades, vilket lämnar servern stoppad tills någon startar den. `settings`-kapaciteten räcker, inklusive körande server. Icke-administratörer får bara välja från `PORT_GAME_START` och uppåt.
  (Kolumnerna `port_*_pending` från migration 029 tillhör en tidigare, ej släppt design och används inte; 031 rensar dem.) En låskollision svarar 409 med `code: 'BUSY'`, vilket de anropande anroparen nedan kontrollerar snarare än formuleringen. En automatisk omstart vid krasch
  (`watcher.restartAfterCrash`) och en schemalagd säkerhetskopiering eller start (`scheduler.runTaskWithRetry`)
  som hittar servern upptagen med en annan åtgärd försöker igen var 20:e sekund / 60:e sekund i upp till 30 minuter,
  och en paketuppdatering eller återställning försöker sina låsta steg på samma sätt (`opLock.retryWhileBusy`);
  en kraschomstart eller en väntande schemalagd start ger upp när någon har stoppat, dödat eller
  startat servern sedan dess (`events.lifecycleActionSince`), och kraschomstarten också när
  automatisk omstart är avstängd eller servern är borta. Schemalagda omstarter, stopp och kommandon
  försöks inte igen, och ett schema vars sista körning fortfarande väntar hoppar över sin nästa avfyrning.
- **Disk-kvoter** upprätthålls av panelen eftersom Docker inte kan begränsa användningen av bind-mounts: indexeraren cachar storlekar per katalog och disk-växande operationer begränsas av dem.
- **Hemligheter** (RCON-lösenord, API-nycklar, TOTP-hemligheter, Discord webhook-URL) krypteras vid vila med AES-256-GCM med en dedikerad slumpmässig nyckel vid `$DATA_DIR/.secret-key` (läge `0600`,
  automatiskt genererad). Den är oberoende av `SESSION_SECRET`; en nyckel härledd från `SESSION_SECRET` behålls som en fallback endast för dekryptering för värden som skrivits innan den dedikerade nyckeln fanns, och
  `src/services/secretsMigration.js` krypterar om dessa under den dedikerade nyckeln en gång vid uppstart.
  En `.secret-key` som finns men inte kan parsas är ett allvarligt uppstartsfel (den genereras aldrig tyst
  över den). Blueprints tar bort alla hemligheter vid export.
- **`server.properties` ägs av panelen men skuggas av miljövariabler.** itzg-imagen återhävdar varje
  miljöbaserad egenskap vid varje start (`OVERRIDE_SERVER_PROPERTIES` standard true), så ett värde som
  panelen redigerar direkt – Världskontroller PvP/svårighetsgrad, vitlistningsväxeln, Filredigeraren –
  skulle tyst återställas vid nästa start om inte motsvarande miljövariabel tas bort och
  containern återskapas. Varje direkt egenskapsskrivning går via `writeServerProperties()` (hela filen)
  eller `setServerProperty()` (en nyckel) i `src/services/servers.js`, som atomärt skriver om
  filen, avmarkerar miljövariabeln bakom varje ändrad nyckel (via attributet `prop:` på katalogfält, kontrollerat i tester mot imagen egna egendefinitioner), och flaggar
  `pending_recreate`. Svårighetsgrad skrivs till filen såväl som skickas över RCON, eftersom en
  dedikerad server återanvänder `difficulty`-egenskapen vid varje uppstart. Minecraft självt sparar om
  server.properties från sina startvärden vid `whitelist on/off`, vilket skulle ångra redigeringar gjorda medan servern körs, så den körande vitlistningsväxeln ögonblicksbildar filen först och skriver tillbaka den med endast `white-list` ändrad. Miljövariablerna
  förblir fullt konfigurerbara vid skapandet (guiden renderar dem och de tillämpas en gång); de
  låser upp sig först första gången panelen redigerar den underliggande egenskapen. MOTD har samma kontrakt: en direkt redigering av `motd`-filen avmarkerar den, så den sista skrivningen vinner.

## Data- och trådformat

- **`data/panel.db`** - SQLite-databasen. Ögonblicksbildas dagligen via `VACUUM INTO` till
  `data/backups/_panel/` (senaste 14 behålls); `PRAGMA integrity_check` körs vid uppstart.
- **`data/.session-secret`** - den automatiskt genererade hemligheten för sessionscookies, skapad vid första körningen om `SESSION_SECRET` är odefinierad. Att ta bort den roterar hemligheten (vilket ogiltigförklarar sessioner).
- **`data/.secret-key`** - den dedikerade 32-byte krypteringsnyckeln vid vila (läge `0600`), automatiskt skapad vid första körningen. Oberoende av `SESSION_SECRET`; att ta bort den gör varje lagrad autentiseringsuppgift okrypterbar, så den hör hemma med dina säkerhetskopior.
- **Blueprints (`.mcserver.zip`)** - en zip med en `manifest.json` som beskriver konfiguration, resurser, den fastlåsta paketreferensen, överlagringsmanifestet (käll-URL:er + sha256), valda konfigurationsfiler och eventuellt en värld. Import laddar ner och hash-verifierar varje mod och tilldelar nya portar.
- **Docker-containrar** som skapas av panelen namnges och märks så att vakten kan hitta dem;
  panelen äger deras fulla livscykel.

## Uppstartssekvens

1. `require('./instrument')` (Sentry-sömmen) före allt annat, sedan `require('./preflight')`
   för att tydligt misslyckas vid en inkompatibel Node-version.
2. Ladda konfiguration; säkerställ/generera `.session-secret` **och** `.secret-key`.
3. `ensureDataRoot()` - skapa `./data`-layouten, rensa `tmp/`.
4. Kör DB-migrationer, sedan `PRAGMA integrity_check` (loggar högt, pekar på `data/backups/_panel`
   vid fel).
5. Kryptera om eventuella äldre `SESSION_SECRET`-nyckelbaserade hemligheter under `.secret-key` (`secretsMigration`).
6. Importera API-nycklar från miljön en gång (`apiKeys.importFromEnvOnce()`), lås eventuell server som fortfarande bär en olåst modpack-väljare (`packPins.pinUnpinnedServers()`), markera versionskompatibilitetsskanningar som lämnats igång av en tidigare process som avbrutna
   (`compat.reconcileScans()`), sedan fröa start-blueprints (skyddad).
7. Starta HTTP + WS-servern. Vid en exponerad bindning, skriv ut den första körningens `/setup` PIN-kod.
8. Installera körtidsskyddet efter uppstart (fångar okontrollerade fel; `MSM_EXIT_ON_FATAL=1` gör att den avslutas hårt för övervakade distributioner).
9. Starta bakgrundstjänster: WS-förmedlare, lagringsindexerare, krasch- och inventarievakter, schemaläggare,
   Discord-händelsebrygga, chattbot-utåtriktad vakt, och **dagliga underhållstimern** (rensa gamla
   analysrader, chattbot-transkriptioner, händelsehistorik (365 dagar) och API-cache-rader, sedan ögonblicksbilda
   `panel.db`).
10. Initiera Docker **i bakgrunden**. Gränssnittet är fullt användbart medan demonen är nere;
    Docker-funktioner tänds när den blir nåbar. När ansluten, `refreshStatuses({ boot })`
    synkroniserar cachade statusar, skickar en engångshändelse `offline-after-restart` för en server som var igång innan panelen startades om och inte kommer att startas om, och uppstartsloopen startar
    `auto_start`-servrar plus återställer `auto_restart`-servrar som hittats kraschade under avbrottet
    (respekterar krasch-loop-backoff).

> Ordningen instrument-före-preflight är en medveten kompromiss: den låter en framtida Sentry-koppling
> lappa körningen först, till priset av ett något mindre vänligt meddelande vid en verkligt gammal Node.

## Byggpipeline

`pnpm run build` = `build:css` (Tailwind → `public/css/app.css`) + `build:js` (esbuild →
`public/dist/js/`, ESM med koddelning). `postinstall` kör **endast CSS**. `public/css/app.css`
och `public/dist/` är gitignorerade byggartefakter; Dockerfile-byggstadiet kör hela
`pnpm run build` och kopierar `public/` in i körningsimagen. Statiska tillgångar serveras
med `immutable`/lång cache för fingerprintade filer, kort cache för CSS/JS, och `no-cache` för HTML och
`/api`.
