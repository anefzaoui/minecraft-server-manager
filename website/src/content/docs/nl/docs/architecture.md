---
title: 'Architectuur'
description: 'Minecraft Server Manager is een single-process, server-rendered Node.js-applicatie.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/architecture.md'
---

[← Terug naar de documentatie-index](/docs/)

Minecraft Server Manager is een single-process, server-gerenderde Node.js-applicatie. Het beheert
Minecraft-servers die draaien als Docker-containers met behulp van de
[itzg/docker-minecraft-server](https://github.com/itzg/docker-minecraft-server) image, waarbij het communiceert met de
Docker daemon via de API (nooit door de `docker` CLI aan te roepen).

## Runtime-structuur

- **Express + Handlebars** renderen pagina's aan de serverzijde. Er is geen SPA; de browser JS in `public/js/`
  is handgeschreven progressieve verbetering. Een esbuild-stap (`pnpm run build:js`) bundelt en
  minificeert het naar `public/dist/js/`; de app serveert die bundel wanneer deze aanwezig is en anders de
  ruwe bron, zodat een ontwikkelingsrun zonder build nog steeds werkt.
- **`node:sqlite`** (ingebouwd in Node; het paneel vereist Node ≥ 24) is de database - synchroon,
  nul native modules, WAL-modus. Een kleine versie-migratie-runner past `src/db/migrations/*` toe bij
  het opstarten. Prepared statements worden in `src/db/index.js` in de cache opgeslagen, met de SQL-tekst als sleutel.
- **`ws`** verzorgt de live console- en statistiekstreams. Beide zijn **gefaciliteerd**: één upstream
  `docker logs --follow` (of `docker stats`) per server, één keer gedemuxed en uitgesplitst naar elke
  verbonden tab, in plaats van één upstream per kijker. De console-faciliteit houdt een kleine replay-buffer
  aan voor laat-aangekomen tabbladen en laat een abonnee vallen wiens socket te ver achterloopt, in plaats van
  de gedeelde stream te vertragen.
- **dockerode** is de enige manier waarop de app met Docker communiceert. Het eindpunt wordt automatisch gedetecteerd per platform
  (Windows named pipe versus unix socket).
- **Alle persistente staat bevindt zich onder één map** (`$DATA_DIR`, standaard `./data`). Het kopiëren van die
  map migreert het hele paneel.

## Gelaagdheid

Afhankelijkheden stromen in één richting:

```
                 ┌─────────────────────────────┐
   HTTP  ───────▶│  web/routes/*  (+ middleware)│   parse & valideer input, vorm reacties
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

- **`web/routes/`** - één router per domein (`players`, `worlds`, `crashes`, `blueprints`, `files`, …).
  `web/app.js` koppelt de top-level routers (`api.js`, de sessie JSON API die ook de kernserverroutes bevat en de domeinrouters per server koppelt; `index.js`, de pagina's; `auth`, `account`,
  `tasks`, …). Routers valideren met zod, roepen een service aan en retourneren JSON
  of renderen een weergave. Bedrijfslogica hoort hier niet thuis. Twee routers worden in de **publieke zone** gekoppeld, vóór `requireAuth`: `routes/status.js` (optionele HTML-statuspagina's per server) en
  `routes/apiV1.js` (`/api/v1`, een alleen-lezen JSON API geauthenticeerd door een door de admin uitgegeven Bearer-token uit
  `services/apiTokens.js`, uitgeschakeld tenzij ingeschakeld in Instellingen; zie `docs/public-api.md`).
- **`services/`** - het hart van de app. Elke service beheert één domein en kan afhankelijk zijn van
  infrastructuur en andere services.
- **`docker/`** - dockerode wrappers: `connect` (eindpuntdetectie + daemonstatus), `containers`
  (creëren/starten/stoppen/hercreëren met bind mounts, geheugen/CPU-limieten en labels), `logs`, `stats`,
  `images`, `networks` (hostnetwerkdetectie), `hostPath` (herroot van bind-paden onder
  `DATA_DIR_HOST`), en een `watcher` die Docker-gebeurtenissen omzet in geschiedenis + crashdetectie.
- **`db/`** - de SQLite-wrapper en migratie-runner.
- **`storage/`** - de `./data` bootstrap, de **padbeveiliger** (`safeJoin`, de ruggengraat voor bestandsveiligheid), en de achtergrond-grootte-indexer + quotumhandhaving.

Overkoepelend:

- **`config/`** - omgevingsconfiguratie plus de **veldencatalogus**: de enige bron van waarheid voor
  serverinstellingen. Elke itzg-omgevingsvariabele is gecatalogiseerd (label, hulp, type, eenheid, standaardwaarde,
  validatie, sectie, gevaren-vlaggen). De wizard, instellingenformulieren en zod-validatie worden hier allemaal uit afgeleid,
  dus het blootstellen van een nieuwe instelling is een gegevenswijziging, geen nieuwe UI-infrastructuur.
- **`events/`** - `recordEvent()` is het enige toegangspunt voor het geschiedenislogboek; levenscyclusgebeurtenissen
  leggen ook fragmenten uit containerlogs vast in `data/logs/<id>/events/`.
- **`ws/`** - geauthenticeerde console + statistieken WebSockets (sessiecookie geverifieerd bij upgrade, `Origin`
  gecontroleerd om cross-site hijacking te voorkomen), gefaciliteerd per server (zie "Runtime-structuur").
- **`logger.js` + `instrument.js`** - `require('./logger')(label)` retourneert een per-module
  [Pino](https://getpino.io) logger; niveau uit `LOG_LEVEL`, `makeFailureThrottle()` houdt een
  permanent falende achtergrondlus bij tot één logregel plus een "herstelde" regel.
  `src/utils/logSanitize.js` maskeert credential-vormige sleutels en webhook-tokens uit de gestructureerde
  metadata; `src/config/logLevel.js` is de gedeelde niveau-toelatingslijst (apart gehouden om een
  require-cyclus met `config` te vermijden). `src/instrument.js` is een slapende Sentry-naad, als eerste geladen in
  `src/server.js`. `src/web/middleware/requestLog.js` schrijft één access-logregel per verzoek
  (waarbij `/healthz` en statische assets worden overgeslagen). ESLint handhaaft `no-console` onder `src/**`, met
  `preflight.js`, `instrument.js`, en `config/index.js` als uitzonderingen (deze worden uitgevoerd voordat de logger bestaat).
- **Rate limiting** - `src/web/middleware/rateLimit.js` plaatst `express-rate-limit` vóór `/api`
  (`RATE_LIMIT_API_PER_MIN`, standaard 1200) en de login / 2FA / setup POSTs
  (`RATE_LIMIT_AUTH_PER_15MIN`, standaard 100); `0` schakelt een limiter uit. Het gebruikt `req.ip` als sleutel, dus
  `TRUST_PROXY` is belangrijk achter een proxy. `/api/v1` heeft zijn eigen limieten: een limiet per client-IP
  (vijf keer het budget per token) die wordt uitgevoerd voordat het token is geverifieerd, daarna een budget per token
  (`RATE_LIMIT_PUBLIC_API_PER_MIN`, standaard 120) met de geverifieerde token-ID als sleutel. Een
  aparte soft-teller per account in
  `src/web/middleware/auth.js` beheert de login-uitsluiting (per IP en globaal per account, vervallend).
- **Autorisatie**: twee lagen. De globale rol (`requireAuth` → `requireRole` / `requireWrite` in
  `src/web/middleware/auth.js`) beheert paneelbrede acties en is de standaard op elke server. Per-server
  machtigingen (`src/services/permissions.js`, negen mogelijkheden opgeslagen als een JSON-lijst per
  `(gebruiker, server)` in `user_server_permissions`) verfijnen die standaard voor één server; elke
  `/api/servers/:id` route, subrouter-koppeling, pagina, WebSocket en fleet-brede lijst gaat door
  `src/web/middleware/serverAccess.js` (`serverScope`, gekoppeld aan het `/servers/:id`-prefix van zowel
  de API als de paginarouter, verbergt een server zonder `view` als een 404; `requireCap(cap)` noemt de
  mogelijkheid die een route nodig heeft). Schrijfacties die hun server in de body benoemen (schema's, wereldextractie en -installatie, blueprint-export) worden geopend voor kijkers door `requireWrite` alleen voor die server, en elke dergelijke route controleert zelf de mogelijkheid. `test/permissions-routes.test.js` doorloopt de live router-stacks en faalt als een server-scoped schrijfroute, koppeling of pagina geen poort heeft.

## Belangrijkste domeingedragingen

- **Modpacks worden altijd vastgezet.** De image upgrade automatisch niet-vastgezette packs bij elke herstart, dus het paneel lost "latest" op naar een concrete versie-ID tijdens installatie en zet deze vast. Upgrades zijn een expliciete georkestreerde stroom (`updates/`): preview → pre-update backup → gracieuze stop → her-vastzetten → hercreëren → gezondheidsmonitor → één-klik rollback.
- **De custom-mod overlay** wordt beheerd door het paneel: door de gebruiker toegevoegde mods komen in de deduplicerende bibliotheek en worden hard-linked in de server zodat ze pack-updates overleven. Uitschakelen is klasse-bewust. Omdat de bibliotheek elke gedownloade build bewaart, registreert een update de vervangen build (`server_content.previous_*`) en kan deze worden teruggedraaid met alleen lokale bestanden. Het uitschakelen van een pack-mod schrijft de uitsluitings-omgevingsvariabele van het pack in plaats daarvan; `packs.applyPack` draagt dat en de rest van de pack-tuning (`PACK_TUNING_KEYS`) mee over een versie-wijziging van hetzelfde pack, en laat het vallen wanneer het pack verandert.
- **Een Minecraft-versie-upgrade moet verdiend worden.** `services/compat.js` scant de mods van een server - opgelost uit door het paneel geïnstalleerde rijen, dan het CurseForge pack-manifest, dan op content-hash tegen Modrinth/CurseForge - en bouwt een ondersteuningsmatrix (loader, Minecraft-versie) per project uit CurseForge's `latestFilesIndexes` (200 projecten per verzoek) en Modrinth's per-project versie-lijst (één verzoek per project, wat de loader en versie aan elkaar koppelt). De update-checker biedt alleen de nieuwste versie die ELKE mod ondersteunt, en biedt helemaal niets wanneer het antwoord niet kan worden vastgesteld: geen scan, een scan voor een andere versie of loader, een die nooit is voltooid, of een jar die geen van beide registers herkent. Scans zijn alleen handmatig, en hun voortgang en gedeeltelijke resultaten bevinden zich in `version_compat` (niet in de in-memory `services/tasks.js`), dus een vernieuwing of een paneel-herstart gaat verder in plaats van te blijven hangen op een spinner; `reconcileScans()` markeert scans die door een afsluiting zijn achtergelaten bij de volgende opstart.
- **De mod-loader-versie is een pin, net als al het andere.** `services/loaderPin.js` leest de geïnstalleerde build uit het eigen installatie-manifest van de image (`.forge-manifest.json` en vergelijkbaar) en schrijft de pin: de loader's itzg-variabele op een standaardserver (`FORGE_VERSION`, …), of
  `CF_MOD_LOADER_VERSION` op een Forge of Fabric CurseForge pack, die de door het pack gedeclareerde versie overschrijft. De CurseForge-installer van de image negeert die override voor NeoForge, en Modrinth- en FTB-packs hebben er geen, dus hun loader volgt het pack. `packs.applyPack` verwijdert elke `CF_`-variabele bij een pack-update of -rollback, wat een override met de rest laat vallen. Een getypeerde build wordt eerst gecontroleerd tegen de volledige lijst van het register (`services/loaderVersions.js`; Forge's komt uit zijn maven-metadata, die nummers overslaat; een misser wordt eenmaal opnieuw gecontroleerd tegen het register zelf), daarna is de wijziging backup → pin (over de env zoals deze is na de backup) → rebuild.
- **Poorten** worden toegewezen uit een basisregeling (game vanaf `PORT_GAME_START` omhoog, RCON = game +
  `PORT_RCON_OFFSET`, Bedrock vanaf `PORT_BEDROCK_START`), gecontroleerd op beschikbaarheid, en gereserveerd in de DB. "Bezet" is de vereniging van de claims van elke server (live poorten, plus een wachtend paar hieronder),
  elke hostpoort die een Docker-container publiceert (`containers.publishedHostPorts`: live bindingen van draaiende containers plus de geconfigureerde van elke gestopte container, omdat een OS-bind probe vanaf binnen de eigen container van het paneel alleen de netwerkruimte van die container ziet), en de OS-probe. Het Docker-gedeelte wordt 3 seconden in de cache opgeslagen en begrensd: een lijst die na 2,5 seconde geen antwoord geeft, laat alleen het Docker-gedeelte vallen, en een trage inspect kost alleen de poorten van die container. Servercreaties en `servers.changeGamePort` kiezen poorten via één serialisatieketen die alleen de keuze en de claim ervan dekt (de rij-schrijfactie voor een creatie, de in-memory reservering voor een poortwijziging);
  de poortkiezer van BlueMap en de extra-poort-overrides zitten er niet in en raadplegen Docker niet. Een poortwijziging op een bestaande server (`servers.changeGamePort`, onder de op-lock van de server) wordt direct toegepast, omdat Docker poortbindingen bij containercreatie regelt: het nieuwe paar (RCON altijd game + `PORT_RCON_OFFSET`) wordt gecontroleerd en gereserveerd in het geheugen
  (`ports.reserve`, zowel het oude als het nieuwe paar, gehonoreerd door elke andere keuze) onder de poort-lock. Het wordt geweigerd (409 `PENDING_CHANGES`) zolang andere instellingen wachten op een rebuild, dus het bouwt alleen een container opnieuw die al draaide, op een nieuwe poort; en een draaiende server wordt alleen gewijzigd wanneer het verzoek `restart: true` zegt (anders 409 `NEEDS_CONFIRM`). De image wordt gepulld en een aangepaste containernaam wordt gecontroleerd voordat iets wordt aangeraakt. Een draaiende server wordt gestopt; dan wordt het nieuwe paar geschreven met `pending_recreate = 1` (zodat een paneelcrash vanaf daar een eerlijke "rebuild pending" achterlaat), de container wordt verwijderd, opnieuw gebouwd op het nieuwe paar en gestart. Als een stap na de stop mislukt, schrijft `putBackOnOldPort` het oude paar terug, bouwt opnieuw (en herstart, indien het draaide) erop en registreert welke stap is mislukt; geschiedenis en waarschuwingen geven aan of zelfs dat is mislukt, wat de server gestopt achterlaat totdat iemand hem start. De `settings`-mogelijkheid is voldoende, inclusief een draaiende server. Niet-admins mogen alleen kiezen uit `PORT_GAME_START` en hoger.
  (De `port_*_pending` kolommen uit migratie 029 behoren tot een eerder, niet-uitgebracht ontwerp en worden niet gebruikt; 031 ruimt ze op.) Een lock-botsing beantwoordt 409 met `code: 'BUSY'`, wat de herhalende aanroepers hieronder controleren in plaats van de tekst. Een automatische herstart na een crash
  (`watcher.restartAfterCrash`) en een geplande backup of start (`scheduler.runTaskWithRetry`)
  die de server bezig vinden met een andere actie, proberen het elke 20 s / 60 s opnieuw voor maximaal 30 minuten,
  en een pack-update of -rollback probeert zijn vergrendelde stappen op dezelfde manier opnieuw (`opLock.retryWhileBusy`);
  een crash-herstart of een wachtende geplande start geeft het op zodra iemand de server heeft gestopt, gedood of gestart sinds (`events.lifecycleActionSince`), en de crash-herstart ook wanneer
  automatische herstart is uitgeschakeld of de server weg is. Geplande herstarts, stops en commando's worden niet opnieuw geprobeerd, en een schema waarvan de laatste uitvoering nog wacht, slaat de volgende uitvoering over.
- **Schijfquota's** worden afgedwongen door het paneel omdat Docker de bind-mount-gebruik niet kan beperken: de indexeerder cachet per-directory-groottes en schijfgroei-operaties worden hierop gebaseerd.
- **Geheimen** (RCON-wachtwoorden, API-sleutels, TOTP-geheimen, de Discord webhook URL) worden versleuteld opgeslagen met AES-256-GCM met behulp van een speciale willekeurige sleutel op `$DATA_DIR/.secret-key` (modus `0600`, automatisch gegenereerd). Het is onafhankelijk van `SESSION_SECRET`; een uit `SESSION_SECRET` afgeleide sleutel wordt bewaard als een alleen-ontsleutelings-fallback voor waarden die zijn geschreven voordat de speciale sleutel bestond, en
  `src/services/secretsMigration.js` versleutelt die opnieuw onder de speciale sleutel één keer bij het opstarten.
  Een `.secret-key` die bestaat maar niet kan worden geparsed, is een harde opstartfout (het wordt nooit stilzwijgend
  opnieuw gegenereerd). Blauwdrukken verwijderen alle geheimen bij export.
- **`server.properties` is eigendom van het paneel maar wordt overschaduwd door de omgeving.** De itzg-image herstelt elke
  door de omgeving ondersteunde eigenschap bij elke start (`OVERRIDE_SERVER_PROPERTIES` standaard true), dus een waarde die
  het paneel direct bewerkt - Wereldcontroles PvP/moeilijkheidsgraad, de whitelist-schakelaar, de bestandseditor -
  zou stilzwijgend worden teruggedraaid bij de volgende start, tenzij de bijbehorende omgevingsvariabele wordt verwijderd en de
  container opnieuw wordt gemaakt. Elke directe eigenschapsschrijfactie gaat via `writeServerProperties()` (hele bestand)
  of `setServerProperty()` (één sleutel) in `src/services/servers.js`, die het bestand atomair herschrijven,
  de omgevingsvariabele achter elke gewijzigde sleutel ontkoppelen (via het `prop:` attribuut op catalogusvelden, gecontroleerd in tests tegen de eigen eigenschapsdefinities van de image), en
  `pending_recreate` markeren. Moeilijkheidsgraad wordt naar het bestand geschreven en ook via RCON verzonden, omdat een
  dedicated server de `difficulty` eigenschap bij elke opstart opnieuw toepast. Minecraft zelf slaat
  server.properties opnieuw op vanuit zijn opstartwaarden bij `whitelist on/off`, wat bewerkingen die zijn gemaakt
  terwijl de server draait, ongedaan zou maken, dus de draaiende whitelist-schakelaar maakt een snapshot van het bestand eerst en schrijft het terug met alleen `white-list` gewijzigd. De omgevingsvariabelen
  blijven volledig configureerbaar bij creatie (de wizard rendert ze en ze worden eenmalig toegepast); ze ontgrendelen pas
  de eerste keer dat het paneel de onderliggende eigenschap bewerkt. MOTD heeft hetzelfde contract: een directe
  `motd`-bestandbewerking ontkoppelt het, dus de laatste schrijfactie wint.

## Data- en wire-formaten

- **`data/panel.db`** - de SQLite-database. Dagelijks gesnapt via `VACUUM INTO` naar
  `data/backups/_panel/` (nieuwste 14 bewaard); `PRAGMA integrity_check` wordt uitgevoerd bij het opstarten.
- **`data/.session-secret`** - het automatisch gegenereerde cookie-ondertekeningsgeheim, aangemaakt bij de eerste uitvoering als
  `SESSION_SECRET` niet is ingesteld. Het verwijderen ervan roteert het geheim (wat sessies ongeldig maakt).
- **`data/.secret-key`** - de speciale 32-byte versleutelingssleutel voor opgeslagen gegevens (modus `0600`), automatisch aangemaakt
  bij de eerste uitvoering. Onafhankelijk van `SESSION_SECRET`; het verwijderen ervan maakt elke opgeslagen credential
  onontcijferbaar, dus het hoort bij uw backups.
- **Blauwdrukken (`.mcserver.zip`)** - een zip met een `manifest.json` die configuratie, bronnen, de
  vastgezette pack-referentie, de overlay-manifest (bron-URL's + sha256), gekozen configuratiebestanden, en
  optioneel een wereld beschrijft. Import herdownloadt en hash-verifieert elke mod en wijst nieuwe poorten toe.
- **Docker-containers** gemaakt door het paneel worden benoemd en gelabeld zodat de watcher ze kan vinden;
  het paneel beheert hun volledige levenscyclus.

## Opstartvolgorde

1. `require('./instrument')` (de Sentry-naad) vóór al het andere, dan `require('./preflight')`
   om duidelijk te falen bij een niet-ondersteunde Node-versie.
2. Laad configuratie; zorg voor/genereer `.session-secret` **en** `.secret-key`.
3. `ensureDataRoot()` - maak de `./data` lay-out aan, wis `tmp/`.
4. Voer DB-migraties uit, dan `PRAGMA integrity_check` (logt luid, wijst naar `data/backups/_panel`
   bij falen).
5. Versleutel eventuele legacy `SESSION_SECRET`-gebaseerde geheimen opnieuw onder `.secret-key` (`secretsMigration`).
6. Importeer API-sleutels eenmalig uit de omgeving (`apiKeys.importFromEnvOnce()`), zet elke server die nog steeds een niet-vastgezette modpack-selector draagt vast (`packPins.pinUnpinnedServers()`), markeer versie-compatibiliteitsscans die door een vorig proces zijn achtergelaten als onderbroken
   (`compat.reconcileScans()`), en zaai vervolgens start-blauwdrukken (beveiligd).
7. Start de HTTP + WS-server. Op een blootgestelde bind, print de eerste-run `/setup` PIN.
8. Installeer de runtime-beveiliger na het opstarten (vangt onbehandelde fouten op; `MSM_EXIT_ON_FATAL=1` zorgt voor een harde exit voor beheerde implementaties).
9. Start achtergrondservices: WS-faciliteit, opslag-indexer, crash- en inventaris-watchers, scheduler,
   Discord-eventbrug, chatbot-outreach-watcher, en de **dagelijkse onderhoudstiming** (verwijder oude
   analytische rijen, chatbot-transcripties, geschiedenis van gebeurtenissen (365 dagen) en API-cache-rijen, snapshot
   vervolgens `panel.db`).
10. Initialiseer Docker **op de achtergrond**. De UI is volledig bruikbaar terwijl de daemon uitvalt;
    Docker-functies lichten op wanneer deze bereikbaar wordt. Eenmaal verbonden, `refreshStatuses({ boot })`
    reconcilieert de gecachte statussen, geeft een eenmalig `offline-after-restart` event uit voor een server die
    draaide voordat het paneel opnieuw opstartte en niet zal worden teruggezet, en de opstartlus start
    `auto_start` servers plus herstelt `auto_restart` servers die tijdens de storing gecrasht zijn gevonden
    (met inachtneming van de backoff bij crash-loops).

> De volgorde instrument-vóór-preflight is een bewuste afweging: het laat een toekomstige Sentry-bedrading
> de runtime eerst patchen, ten koste van een iets minder vriendelijke boodschap bij een werkelijk oude Node.

## Build-pipeline

`pnpm run build` = `build:css` (Tailwind → `public/css/app.css`) + `build:js` (esbuild →
`public/dist/js/`, ESM met code-splitting). `postinstall` voert **alleen CSS** uit. `public/css/app.css`
en `public/dist/` zijn git-genegeerde build-artefacten; de Dockerfile build-fase voert de volledige
`pnpm run build` uit en kopieert `public/` naar de runtime-image. Statische assets worden geserveerd
met `immutable`/lange cache voor gefingerprinte bestanden, korte cache voor CSS/JS, en `no-cache` voor HTML en
`/api`.
