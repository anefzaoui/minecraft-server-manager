---
title: 'Architektúra'
description: 'A Minecraft Server Manager egy egyszálú, szerveroldalon renderelt Node.js alkalmazás.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/architecture.md'
---

[← Vissza a dokumentumokhoz](/docs/)

A Minecraft Server Manager egy egyfolyamatos, szerveroldalon renderelt Node.js alkalmazás. Docker konténerként futó Minecraft szervereket kezel a
[itzg/docker-minecraft-server](https://github.com/itzg/docker-minecraft-server) kép használatával, a
Docker daemonnal API-n keresztül kommunikál (soha nem a `docker` CLI-t hívja meg).

## Futásidejű felépítés

- **Express + Handlebars** szerveroldalon rendereli az oldalakat. Nincs SPA; a `public/js/` mappában található böngésző JS kézzel írt progresszív fejlesztés. Egy esbuild lépés (`pnpm run build:js`) összefűzi és minifikálja azt a `public/dist/js/` mappába; az alkalmazás ezt a köteget szolgálja ki, ha jelen van, egyébként a nyers forrást, így egy build nélküli fejlesztői futás is működik.
- **`node:sqlite`** (beépítve a Node-ba; a panel Node ≥ 24 verziót igényel) az adatbázis - szinkron, nulla natív modul, WAL mód. Egy kis verziós migrációs futtató alkalmazza a `src/db/migrations/*` fájlokat induláskor. Az előkészített utasítások a `src/db/index.js` fájlban vannak gyorsítótárazva, az SQL szövegre kulcsolva.
- **`ws`** viszi az élő konzol és statisztika stream-eket. Mindkettő **közvetített**: egy upstream `docker logs --follow` (vagy `docker stats`) szerverenként, egyszer demuxolva és minden csatlakoztatott fülre szétosztva, ahelyett, hogy nézőnként egy upstream lenne. A konzol közvetítő egy kis visszajátszási pufferrel rendelkezik a későn csatlakozó fülek számára, és eldob egy előfizetőt, akinek a socket-je túl messzire lemarad, ahelyett, hogy megállítaná a megosztott stream-et.
- **`dockerode`** az egyetlen módja, ahogyan az alkalmazás kommunikál a Dockerrel. A végpont platformonként automatikusan felismerésre kerül (Windows named pipe vs. unix socket).
- **Minden állandó állapot egyetlen könyvtár alatt él** (`$DATA_DIR`, alapértelmezett: `./data`). Annak a könyvtárnak a másolása teljes egészében áttelepíti a panelt.

## Rétegződés

A függőségek egy irányban áramlanak:

```
                 ┌─────────────────────────────┐
   HTTP  ───────▶│  web/routes/*  (+ middleware)│   bemenet elemzése és validálása, válaszok alakítása
                 └──────────────┬──────────────┘
                                │
                 ┌──────────────▼──────────────┐
                 │         services/*          │   domain logika (a tényleges funkciók)
                 └───┬─────────┬─────────┬─────┘
                     │         │         │
        ┌────────────▼──┐ ┌────▼────┐ ┌──▼──────────┐
        │   docker/*    │ │  db/*   │ │  storage/*  │   infrastruktúra
        └───────────────┘ └─────────┘ └─────────────┘
```

- **`web/routes/`** - routerenként egy domain (`players`, `worlds`, `crashes`, `blueprints`, `files`, …).
  A `web/app.js` mountolja a legfelső szintűeket (`api.js`, a session JSON API, amely szintén tartalmazza a fő szerver útvonalakat és mountolja a szerverenkénti domain routereket; `index.js`, az oldalak; `auth`, `account`,
  `tasks`, …). A routerek zod-dal validálnak, egy szolgáltatást hívnak, és JSON-t adnak vissza
  vagy nézetet renderelnek. Az üzleti logika nem ide tartozik. Két router van mountolva a **nyilvános zónában**, a `requireAuth` előtt: `routes/status.js` (opcionális szerverenkénti HTML státuszoldalak) és `routes/apiV1.js` (`/api/v1`, egy csak olvasható JSON API, amelyet egy admin által generált Bearer token hitelesít a `services/apiTokens.js` fájlból, kikapcsolva, hacsak nincs engedélyezve a Beállításokban; lásd: `docs/public-api.md`).
- **`services/`** - az alkalmazás szíve. Minden szolgáltatás egy domain tulajdonosa, és függhet
  infrastruktúrától és más szolgáltatásoktól.
- **`docker/`** - dockerode wrapper-ek: `connect` (végpont felismerés + daemon egészség), `containers`
  (létrehozás/indítás/leállítás/újrakreálás bind mountokkal, memória/CPU korlátokkal és címkékkel), `logs`, `stats`,
  `images`, `networks` (host hálózat felfedezés), `hostPath` (bind útvonalak átgyökerezése a
  `DATA_DIR_HOST` alá), és egy `watcher`, amely Docker eseményeket alakít át történelemmé + hibakereséssé.
- **`db/`** - az SQLite wrapper és a migrációs futtató.
- **`storage/`** - a `./data` inicializálása, a **path guard** (`safeJoin`, a fájlbiztonsági gerinc), és a háttérben futó méret-indexelő + kvóta érvényesítés.

Keresztmetszetű:

- **`config/`** - környezeti konfiguráció plusz a **mező katalógus**: az egyetlen igazságforrás a
  szerverbeállításokhoz. Minden itzg környezeti változó katalógusba van foglalva (címke, súgó, típus, egység, alapértelmezett,
  validálás, szakasz, veszély zászlók). A varázsló, a beállítási űrlapok és a zod validálás mind ebből származnak, így egy új beállítás közzététele adatváltozás, nem új UI csővezeték.
- **`events/`** - `recordEvent()` az egyetlen belépési pont a történeti naplóhoz; az életciklus események a konténernapló kivonatait is rögzítik a `data/logs/<id>/events/` mappába.
- **`ws/`** - hitelesített konzol + statisztika WebSockets (session cookie ellenőrizve frissítéskor, `Origin` ellenőrizve cross-site támadások blokkolására), szerverenként közvetítve (lásd: "Futásidejű felépítés").
- **`logger.js` + `instrument.js`** - `require('./logger')(label)` egy modulonkénti
  [Pino](https://getpino.io) loggert ad vissza; szint a `LOG_LEVEL` értékből, a `makeFailureThrottle()` egy tartósan hibás háttérciklust egy naplósorra plusz egy "helyreállt" sorra tart fenn.
  A `src/utils/logSanitize.js` elrejti a hitelesítő adatokra hasonlító kulcsokat és webhook tokeneket a strukturált metaadatokból; a `src/config/logLevel.js` a megosztott szint megengedési lista (külön tartva, hogy elkerüljék a `config` fájllal való require ciklust). A `src/instrument.js` egy inaktív Sentry varrat, amely legelőször a `src/server.js` fájlban töltődik be. A `src/web/middleware/requestLog.js` minden kérésre egy hozzáférési napló sort ír (kihagyva a `/healthz` és a statikus eszközöket). Az ESLint érvényesíti a `no-console` szabályt a `src/**` alatt, kivéve a `preflight.js`, `instrument.js` és `config/index.js` fájlokat (ezek a logger létezése előtt futnak).
- **Sebességkorlátozás** - a `src/web/middleware/rateLimit.js` az `express-rate-limit` eszközt helyezi a `/api` elé
  (`RATE_LIMIT_API_PER_MIN`, alapértelmezett 1200) és a bejelentkezési / 2FA / beállítási POST kérések elé
  (`RATE_LIMIT_AUTH_PER_15MIN`, alapértelmezett 100); a `0` kikapcsol egy korlátozót. A `req.ip` alapján kulcsol, tehát
  a `TRUST_PROXY` számít egy proxy mögött. A `/api/v1` saját korlátozókkal rendelkezik: egy kliens IP-nkénti korlát
  (ötszöröse a tokenenkénti költségvetésnek), amely a token ellenőrzése előtt fut, majd egy tokenenkénti
  költségvetés (`RATE_LIMIT_PUBLIC_API_PER_MIN`, alapértelmezett 120), amely a hitelesített token azonosítójára van kulcsolva. Egy
  külön, fiókonkénti puha számláló a
  `src/web/middleware/auth.js` fájlban kezeli a bejelentkezési zárolást (IP-nkénti és globális fiókra vonatkozóan, csökkenő).
- **Engedélyezés**: két réteg. A globális szerepkör (`requireAuth` → `requireRole` / `requireWrite` a
  `src/web/middleware/auth.js` fájlban) korlátozza a panel egészére kiterjedő műveleteket, és ez az alapértelmezett minden szerveren. A szerverenkénti
  engedélyek (`src/services/permissions.js`, kilenc képesség, JSON listaként tárolva minden
  `(user, server)` párra a `user_server_permissions` táblában) finomítják ezt az alapértelmezettet egy szerverre; minden
  `/api/servers/:id` útvonal, al-router mount, oldal, WebSocket és flottaszintű lista átmegy a
  `src/web/middleware/serverAccess.js` fájlon (`serverScope`, a
  API és az oldal router `/servers/:id` előtagjára mountolva, 404-ként elrejti a szervert `view` engedély nélkül; `requireCap(cap)` nevezi meg a képességet, amelyre egy útvonalnak szüksége van). Az írások, amelyek a törzsben megnevezik a szerverüket (ütemezések, világ extrakció és telepítés, blueprint exportálás) a nézők számára csak a `requireWrite` által nyitottak meg az adott szerverre, és minden ilyen útvonal maga ellenőrzi a képességet. A `test/permissions-routes.test.js` végigmegy az élő router veremeken, és hibát jelez, ha egy szerver-scoped írási útvonal, mount vagy oldal nem rendelkezik kapuval.

## Főbb domain viselkedések

- **Modpackok mindig rögzítve vannak.** A kép automatikusan frissíti a rögzítetlen csomagokat minden újraindításkor, így a panel telepítéskor feloldja a "latest" értéket egy konkrét verzióazonosítóra, és rögzíti azt. A frissítések egy explicit, vezérelt folyamat (`updates/`): előnézet → frissítés előtti biztonsági mentés → gracefull leállítás → újra rögzítés → újrakreálás → egészségfigyelő → egy kattintásos visszavonás.
- **Az egyedi mod overlay** panel által kezelt: a felhasználó által hozzáadott modok a deduplikált könyvtárba kerülnek, és keményen hivatkozva vannak a szerverbe, így a csomagfrissítések túlélnek. A letiltás osztálytudatos. Mivel a könyvtár minden letöltött build-jét megtartja, egy frissítés rögzíti a helyettesített build-et (`server_content.previous_*`) és helyi fájlokból visszaállítható. Egy csomag mod letiltása helyette a csomag kizárási környezeti változóját írja; a `packs.applyPack` ezt és a többi csomaghangolást (`PACK_TUNING_KEYS`) viszi át egy azonos csomag verzióváltozása során, és eldobja, amikor a csomag megváltozik.
- **Egy Minecraft verziófrissítést ki kell érdemelni.** A `services/compat.js` beolvassa a szerver modjait - feloldva a panel által telepített sorokból, majd a CurseForge csomag manifesztjéből, majd tartalom hash alapján a Modrinth/CurseForge ellen - és létrehoz egy (loader, Minecraft verzió) támogatási mátrixot projektként a CurseForge `latestFilesIndexes` (200 projekt kérésenként) és a Modrinth projektlistája (projektként egy kérés, ami összekapcsolja a loadert és a verziót) alapján. A frissítés-ellenőrző csak a legújabb verziót kínálja, amelyet MINDEN mod támogat, és semmit sem kínál, amikor az eredmény nem állapítható meg: nincs szkennelés, egy szkennelés egy másik verzióra vagy loaderre, egy, amely soha nem fejeződött be, vagy egy jar, amelyet egyik nyilvántartás sem ismer fel. A szkennelések csak manuálisak, és a folyamatuk és részeredményeik a `version_compat` fájlban élnek (nem a memóriában lévő `services/tasks.js` fájlban), így egy frissítés vagy egy panel újraindítása folytatódik ahelyett, hogy egy spinneren akadozna; a `reconcileScans()` megjelöli a szkenneléseket, amelyeket egy leállítás árva hagyott az indításkor.
- **A mod loader verzió egy rögzítés, mint minden más.** A `services/loaderPin.js` beolvassa a telepített build-et a kép saját telepítési manifesztjéből (`.forge-manifest.json` és társai), és beírja a rögzítést: a loader itzg változója egy sima szerveren (`FORGE_VERSION`, …), vagy
  `CF_MOD_LOADER_VERSION` egy Forge vagy Fabric CurseForge csomag esetén, amely felülírja a csomag által deklarált verziót. A kép CurseForge telepítője figyelmen kívül hagyja ezt a felülírást a NeoForge esetében, és a Modrinth és az FTB csomagoknak nincs ilyenje, így a loaderük követi a csomagot. A `packs.applyPack` minden `CF_` változót eltávolít egy csomagfrissítés vagy visszavonás során, amely a többi mellett eldob egy felülírást. Egy típusos build ellenőrzésre kerül a nyilvántartás teljes listájával szemben (a `services/loaderVersions.js`; a Forge-é az
  maven metadata-jából származik, amely kihagyja a számokat; egy hiányt egyszer újra ellenőriznek magával a nyilvántartással szemben), majd a változás biztonsági mentés → rögzítés (a környezeten keresztül, ahogy az a biztonsági mentés után van) → újraépítés.
- **Portok** egy alap séma szerint kerülnek kiosztásra (játék a `PORT_GAME_START` fölött, RCON = játék +
  `PORT_RCON_OFFSET`, Bedrock a `PORT_BEDROCK_START`tól), elérhetőségükre tesztelve, és az adatbázisban foglalva. A "foglalt" minden szerver követelésének uniója (élő portok, plusz egy függő pár alább),
  minden host port, amelyet egy Docker konténer közzétesz (`containers.publishedHostPorts`: futó konténerek élő kötései plusz minden leállított konténer konfigurált kötései, mert egy OS bind teszt a panel saját konténerén belül csak az adott konténer hálózati névterét látja), és az OS
  teszt. A Docker rész 3 másodpercig gyorsítótárazott és korlátozott: egy lista, amely nem válaszol 2,5 másodpercen belül, csak a Docker részt dobja el, és egy lassú inspect csak az adott konténer portjait költségezi. Szerver létrehozások és a
  `servers.changeGamePort` egyetlen szerializációs láncon keresztül választanak portokat, amely csak a választást és annak foglalását fedi le (egy létrehozás sorának írása, egy portváltozás memóriabeli foglalása);
  a BlueMap portválasztója és az extra port felülírások nincsenek benne, és nem
  konzultálnak a Dockerrel. Egy portváltozás egy meglévő szerveren (`servers.changeGamePort`, a
  szerver op lock alatt) azonnal alkalmazásra kerül, mert a Docker a portkötéseket a konténer létrehozásakor rögzíti:
  az új pár (RCON mindig játék + `PORT_RCON_OFFSET`) memóriában ellenőrzésre és foglalásra kerül
  (`ports.reserve`, mind az öreg, mind az új pár, amelyet minden más választás tiszteletben tart) a port
  lock alatt. Megtagadják (409 `PENDING_CHANGES`), amíg más beállítások egy újraépítésre várnak, így csak
  akkor épít újra egy konténert, amely már futott, egy új porton; és egy futó szerver csak akkor változtatható meg,
  amikor a kérés `restart: true` értéket tartalmaz (különben 409 `NEEDS_CONFIRM`). A kép letöltésre kerül, és egy
  egyéni konténernév ellenőrzésre kerül, mielőtt bármihez hozzáérnénk. Egy futó szerver leáll; majd az új pár beírásra kerül `pending_recreate = 1` értékkel (így egy panel összeomlás innen egy becsületes "újraépítés függő" állapotot hagy), a konténer eltávolítva, az új párral újraépítve és elindítva. Ha a leállítás utáni bármely lépés meghibásodik, a `putBackOnOldPort` visszaírja a régi párt, újraépíti (és újraindítja, ha futott) azon, és rögzíti, hogy melyik lépés hibásodott meg; a történet és a riasztások jelzik, ha még az is meghibásodott, ami a szervert leállítva hagyja, amíg valaki el nem indítja. A `settings` képesség elegendő, beleértve a futó szervert is. A nem adminok csak a `PORT_GAME_START` tartományból választhatnak.
  (A 029-es migrációból származó `port_*_pending` oszlopok egy korábbi, nem kiadott dizájnhoz tartoznak, és nem használatosak; a 031 törli őket.) Egy lock ütközés 409-et ad vissza `code: 'BUSY'` értékkel, amelyet az alábbi újrahívó hívók ellenőriznek a szöveg helyett. Egy hibás automatikus újraindítás
  (`watcher.restartAfterCrash`) és egy ütemezett biztonsági mentés vagy indítás (`scheduler.runTaskWithRetry`), amelyek úgy találják, hogy a szerver foglalt egy másik művelettel, 20 másodpercenként / 60 másodpercenként próbálkoznak újra legfeljebb 30 percig, és egy csomagfrissítés vagy visszavonás ugyanígy próbálkozik újra a zárolt lépésekkel (`opLock.retryWhileBusy`);
  egy hibás újraindítás vagy egy várakozó ütemezett indítás feladja, amint valaki leállította, megölte vagy elindította a szervert azóta (`events.lifecycleActionSince`), és a hibás újraindítás akkor is, ha az automatikus újraindítás ki van kapcsolva, vagy a szerver eltűnt. Az ütemezett újraindítások, leállítások és parancsok nem kerülnek újra próbálkozásra, és egy ütemezés, amelynek utolsó futása még várakozik, kihagyja a következő indítását.
- **Lemezkvóták** érvényesítésre kerülnek a panel által, mert a Docker nem tudja korlátozni a bind-mount használatot: az indexelő könyvtáronkénti méreteket gyorsítótáraz, és a lemezbővítési műveletek ezekre vannak korlátozva.
- **Titkok** (RCON jelszavak, API kulcsok, TOTP titkok, a Discord webhook URL) titkosítva vannak tárolva AES-256-GCM segítségével, egy dedikált véletlenszerű kulccsal a `$DATA_DIR/.secret-key` fájlban (mód `0600`, automatikusan generálva). Ez független a `SESSION_SECRET`-től; egy `SESSION_SECRET`-ből származó kulcs dekódolás-csak tartalék marad a dedikált kulcs létezése előtt írt értékekhez, és
  a `src/services/secretsMigration.js` ezeket egyszer újra titkosítja a dedikált kulcs alatt induláskor.
  Egy létező, de nem értelmezhető `.secret-key` kemény indítási hibát okoz (soha nem generálódik újra csendesen felül). A Blueprint-ek minden titkot eltávolítanak exportáláskor.
- **`server.properties` a panel tulajdona, de környezeti változókkal árnyékolt.** Az itzg kép minden
  környezeti változó által támogatott tulajdonságot újra érvényesít minden indításkor (`OVERRIDE_SERVER_PROPERTIES` alapértelmezett true), így egy olyan érték, amelyet a panel közvetlenül szerkeszt - World Controls PvP/difficulty, a whitelist kapcsoló, a Files szerkesztő - csendesen visszaállna a következő indításkor, hacsak a megfelelő környezeti változót el nem távolítják és a konténert újra nem hozzák létre. Minden közvetlen tulajdonságírás a `writeServerProperties()` (egész fájl) vagy a `setServerProperty()` (egy kulcs) funkciókon keresztül történik a `src/services/servers.js` fájlban, amelyek atomikusan írják újra
  a fájlt, törlik a környezeti változót minden megváltozott kulcs mögül (a katalógus mezők `prop:` attribútumán keresztül, amelyet a tesztek a kép saját tulajdonságdefiníciói ellen ellenőriznek), és jelölik a
  `pending_recreate` állapotot. A nehézség a fájlba íródik, valamint RCON-on keresztül küldésre kerül, mert egy dedikált szerver minden indításkor újra alkalmazza a `difficulty` tulajdonságot. Maga a Minecraft újra elmenti a server.properties fájlt az indítási értékeiből a `whitelist on/off` parancsoknál, ami visszavonná a futó szerver közben végzett szerkesztéseket, így a futó whitelist kapcsoló először pillanatképet készít a fájlról, és csak a `white-list` megváltoztatásával írja vissza. A környezeti
  változók a létrehozáskor továbbra is teljesen konfigurálhatók (a varázsló megjeleníti őket, és egyszer érvényesek); csak akkor válnak le a rögzítésről, amikor a panel először szerkeszti az alapul szolgáló tulajdonságot. Az MOTD ugyanaz a szerződés: egy közvetlen `motd` fájl szerkesztés eltávolítja azt, így az utolsó írás nyer.

## Adat- és drótküldési formátumok

- **`data/panel.db`** - az SQLite adatbázis. Naponta naplóba mentve `VACUUM INTO` paranccsal a
  `data/backups/_panel/` mappába (a legújabb 14 megőrizve); az `PRAGMA integrity_check` induláskor fut.
- **`data/.session-secret`** - az automatikusan generált cookie-aláíró titok, első futáskor jön létre, ha a
  `SESSION_SECRET` nincs beállítva. Törlése elforgatja a titkot (ami érvényteleníti a munkameneteket).
- **`data/.secret-key`** - a dedikált 32-bájtos titkosítási kulcs tároláskor (mód `0600`), első futáskor automatikusan létrehozva. Független a `SESSION_SECRET`-től; törlése minden tárolt hitelesítő adatot
  dekódolhatatlanná tesz, így a biztonsági mentésekkel együtt kell tárolni.
- **Blueprintok (`.mcserver.zip`)** - egy zip fájl egy `manifest.json` fájllal, amely leírja a konfigurációt, erőforrásokat, a rögzített csomagreferenciát, az overlay manifesztet (forrás URL-ek + sha256), a kiválasztott konfigurációs fájlokat és opcionálisan egy világot. Az importálás újratölti és hash-ellenőrzi minden modot, és friss portokat rendel hozzá.
- **A panel által létrehozott Docker konténerek** elnevezettek és címkézettek, hogy a figyelő megtalálhassa őket;
  a panel teljes életciklusukat birtokolja.

## Indítási sorrend

1. `require('./instrument')` (a Sentry varrat) mindenekelőtt, majd `require('./preflight')` a nem támogatott Node verzió esetén egyértelmű hiba jelzéséhez.
2. Konfiguráció betöltése; `.session-secret` **és** `.secret-key` biztosítása/generálása.
3. `ensureDataRoot()` - a `./data` elrendezés létrehozása, a `tmp/` törlése.
4. DB migrációk futtatása, majd `PRAGMA integrity_check` (hangosan naplóz, hibás esetben a `data/backups/_panel` mappára mutat).
5. Bármilyen örökölt `SESSION_SECRET`-kulcsú titok újra titkosítása a `.secret-key` alatt (`secretsMigration`).
6. API kulcsok importálása a környezetből egyszer (`apiKeys.importFromEnvOnce()`), bármely szerver rögzítése, amely még mindig rögzítetlen modpack választót tartalmaz (`packPins.pinUnpinnedServers()`), a verzió
   kompatibilitási szkennelések, amelyeket egy korábbi folyamat futva hagyott, megszakítottként jelölése
   (`compat.reconcileScans()`), majd az indító blueprintok feltöltése (védett).
7. Az HTTP + WS szerver indítása. Egy kitett kötés esetén, nyomtassa ki az első futáskor a `/setup` PIN kódot.
8. Az indítás utáni futásidejű védő telepítése (elfogja a nem kezelt hibákat; a `MSM_EXIT_ON_FATAL=1` beállítás kemény kilépést okoz felügyelt telepítések esetén).
9. Háttérszolgáltatások indítása: WS közvetítő, tárolási indexelő, hibakereső + leltár figyelők, ütemező,
   Discord eseményhíd, chatbot kimenő figyelő, és a **napi karbantartási időzítő** (régi
   analitikai sorok, chatbot átiratok, eseménytörténet (365 nap) és API gyorsítótár sorok törlése, majd a `panel.db` naplózása).
10. Docker inicializálása **háttérben**. A felhasználói felület teljesen használható, amíg a daemon le van állítva;
    a Docker funkciók akkor aktiválódnak, amikor elérhetővé válik. Csatlakozás után a `refreshStatuses({ boot })` összeegyezteti a gyorsítótárazott státuszokat, egy egyszeri `offline-after-restart` eseményt bocsát ki egy olyan szerverre, amely a panel újraindítása előtt fel volt kapcsolva, és nem fog visszakerülni, és az indítási ciklus elindítja a
    `auto_start` szervereket, plusz helyreállítja a hibásan leállt `auto_restart` szervereket a kimaradás során
    (figyelembe véve a hiba-ciklus visszapattanást).

> A preflight előtti instrumentálás sorrendje egy tudatos kompromisszum: lehetővé teszi egy jövőbeli Sentry bekötésnek a futásidejű első javítását, egy kissé kevésbé barátságos üzenet árán egy igazán ősi Node esetén.

## Build pipeline

`pnpm run build` = `build:css` (Tailwind → `public/css/app.css`) + `build:js` (esbuild →
`public/dist/js/`, ESM kód-osztással). A `postinstall` **csak CSS** futtat. A `public/css/app.css`
és a `public/dist/` git-ben ignorált build artefaktumok; a Dockerfile build szakasz futtatja a teljes
`pnpm run build` parancsot, és bemásolja a `public/` mappát a futásidejű képbe. A statikus eszközök
`immutable`/hosszú gyorsítótárral kerülnek kiszolgálásra az ujjlenyomat-fájlokhoz, rövid gyorsítótárral a CSS/JS-hez, és `no-cache` a HTML és az `/api` számára.
