---
title: 'Architektúra'
description: 'A Minecraft Server Manager egy egyszálú, szerveroldalon renderelt Node.js alkalmazás.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/architecture.md'
---

[← Vissza a dokumentumokhoz](/docs/)

A Minecraft Server Manager egy egyfolyamatos, szerveroldalon renderelt Node.js alkalmazás. Docker konténerként futó Minecraft szervereket kezel a
[itzg/docker-minecraft-server](https://github.com/itzg/docker-minecraft-server) kép használatával, a Docker daemonnal az API-ján keresztül kommunikál (soha nem a `docker` CLI parancssori futtatásával).

## Futásidejű felépítés

- **Express + Handlebars** szerveroldalon rendereli az oldalakat. Nincs SPA; a `public/js/` könyvtárban található böngésző JS kézzel írt, fokozatos fejlesztés. Egy esbuild lépés (`pnpm run build:js`) összefűzi és minifikálja azt a `public/dist/js/` könyvtárba; az alkalmazás ezt a köteget szolgálja ki, ha jelen van, egyébként a nyers forrást, így egy build nélküli fejlesztői futás is működik.
- **`node:sqlite`** (beépítve a Node-ba; a panel Node ≥ 24 verziót igényel) az adatbázis - szinkron, nulla natív modul, WAL mód. Egy kis verziós migrációs futtató alkalmazza a `src/db/migrations/*` fájlokat induláskor. Az előkészített utasítások a `src/db/index.js` fájlban vannak gyorsítótárazva, az SQL szöveg alapján kulcsolva.
- **`ws`** hordozza az élő konzol és statisztika stream-eket. Mindkettő **közvetített**: egy fel stream `docker logs --follow` (vagy `docker stats`) szerverenként, egyszer demuxolva és minden csatlakoztatott fülre szétosztva, ahelyett, hogy egy fel stream lenne nézőnként. A konzol közvetítő kis visszajátszási pufferrel rendelkezik a későn csatlakozó fülek számára, és eldob egy előfizetőt, akinek a socket-je túl messzire lemarad, ahelyett, hogy megállítaná a megosztott stream-et.
- **`dockerode`** az egyetlen módja, ahogyan az alkalmazás kommunikál a Dockerrel. A végpont platformonként automatikusan felismerésre kerül (Windows named pipe vs. unix socket).
- **Minden állandó állapot egyetlen könyvtárban él** (`$DATA_DIR`, alapértelmezett: `./data`). Annak a könyvtárnak a másolása migrálja a teljes panelt.

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

- **`web/routes/`** - egy router minden tartományhoz (`servers`, `players`, `worlds`, `crashes`, `blueprints`, `files`, …), a `web/app.js` fájlban csatlakoztatva. A routerek zod-dal validálnak, egy szolgáltatást hívnak, és JSON-t adnak vissza vagy nézetet renderelnek. Az üzleti logika nem ide tartozik. Két router van csatlakoztatva a **nyilvános zónában**, a `requireAuth` előtt: `routes/status.js` (opcionális, szerverenkénti HTML státuszoldalak) és `routes/apiV1.js` (`/api/v1`, egy csak olvasható JSON API, amelyet egy admin által kiállított Bearer token hitelesít a `services/apiTokens.js` fájlból, kikapcsolva, hacsak nincs engedélyezve a Beállításokban; lásd: `docs/public-api.md`).
- **`services/`** - az alkalmazás szíve. Minden szolgáltatás egy tartományt birtokol, és függhet infrastruktúrától és más szolgáltatásoktól.
- **`docker/`** - dockerode wrapper-ek: `connect` (végpont felismerés + daemon egészség), `containers` (létrehozás/indítás/leállítás/újraalkotás bind mountokkal, memória/CPU korlátokkal és címkékkel), `logs`, `stats`, `images`, és egy `watcher`, amely Docker eseményeket történelemmé + hibakereséssé alakít.
- **`db/`** - az SQLite wrapper és a migrációs futtató.
- **`storage/`** - a `./data` inicializálása, a **útvonal őr** (`safeJoin`, a fájlbiztonsági gerinc), és a háttérben futó méret-indexelő + kvóta érvényesítés.

Keresztirányú:

- **`config/`** - környezeti konfiguráció plusz a **mező katalógus**: az egyetlen igazságforrás a szerverbeállításokhoz. Minden itzg környezeti változó katalógusba van foglalva (címke, súgó, típus, egység, alapértelmezett, validálás, szakasz, veszély zászlók). A varázsló, a beállítási űrlapok és a zod validálás mind ebből származnak, így egy új beállítás közzététele adatváltozás, nem új UI csővezeték.
- **`events/`** - `recordEvent()` az egyetlen belépési pont a történeti naplóhoz; az életciklus események a konténernapló kivonatait is rögzítik a `data/logs/<id>/events/` könyvtárba.
- **`ws/`** - hitelesített konzol + statisztika WebSockets (session cookie ellenőrizve frissítéskor, `Origin` ellenőrizve a cross-site támadások blokkolására), szerverenként közvetítve (lásd: "Futásidejű felépítés").
- **`logger.js` + `instrument.js`** - `require('./logger')(label)` egy modulonkénti [Pino](https://getpino.io) loggert ad vissza; szint a `LOG_LEVEL` alapján, a `makeFailureThrottle()` egy tartósan meghibásodó háttér ciklust egy naplósorra plusz egy "helyreállított" sorra tart.
  `src/utils/logSanitize.js` eltávolítja a hitelesítő adatok alakú kulcsokat és a webhook tokeneket a strukturált metaadatokból; `src/config/logLevel.js` a megosztott szint engedélyezési lista (külön tartva, hogy elkerüljük a `config` fájllal való körkörös hivatkozást). `src/instrument.js` egy inaktív Sentry varrat, amely elsőként töltődik be a `src/server.js` fájlban. `src/web/middleware/requestLog.js` minden kérésre egy hozzáférési napló sort ír (kihagyva a `/healthz` és a statikus eszközöket). Az ESLint a `no-console` szabályt érvényesíti a `src/**` alatt, a `preflight.js`, `instrument.js` és `config/index.js` kivételekkel (ezek a logger létezése előtt futnak).
- **Sebességkorlátozás** - `src/web/middleware/rateLimit.js` az `express-rate-limit`t helyezi az `/api` elé (`RATE_LIMIT_API_PER_MIN`, alapértelmezett 1200) és a bejelentkezési / 2FA / beállítási POST kérések elé
  (`RATE_LIMIT_AUTH_PER_15MIN`, alapértelmezett 100); `0` letilt egy korlátozót. A `req.ip` alapján kulcsol, így a `TRUST_PROXY` számít egy proxy mögött. Az `/api/v1` saját, tokenenkénti korlátozóval rendelkezik
  (`RATE_LIMIT_PUBLIC_API_PER_MIN`, alapértelmezett 120), amely a Bearer token egy kivonatára kulcsol, IP fallbackkal. Egy külön, fiókonkénti puha számláló a
  `src/web/middleware/auth.js` fájlban kezeli a bejelentkezési zárolást (IP-nként és globálisan fiókonként, csökkenő).

## Kulcsfontosságú tartományi viselkedések

- **A modpackok mindig rögzítve vannak.** A kép automatikusan frissíti a nem rögzített csomagokat minden újraindításkor, így a panel telepítéskor feloldja a "latest" kifejezést egy konkrét verzióazonosítóra, és rögzíti azt. A frissítések egy explicit, orchestrált folyamat (`updates/`): előnézet → frissítés előtti biztonsági mentés → gracefull leállítás → újra rögzítés → újraalkotás → egészségfigyelő → egy kattintásos visszagörgetés.
- **Az egyéni mod overlay** a panel által kezelt: a felhasználó által hozzáadott modok a deduplikált könyvtárba kerülnek, és keményen hivatkozva lesznek a szerverbe, így túlélik a csomagfrissítéseket. A letiltás osztálytudatos.
- **Portok** egy alap séma szerint kerülnek kiosztásra (játék a `PORT_GAME_START` fölfelé, RCON = játék +
  `PORT_RCON_OFFSET`, Bedrock a `PORT_BEDROCK_START`tól), elérhetőségük ellenőrzésre kerül, és lefoglalásra az adatbázisban.
- **Lemezkvóták** érvényesítésre kerülnek a panel által, mert a Docker nem tudja korlátozni a bind-mount használatot: az indexelő gyorsítótárazza a könyvtáronkénti méreteket, és a lemezbővítési műveletek ezekre vannak korlátozva.
- **Titkok** (RCON jelszavak, API kulcsok, TOTP titkok, a Discord webhook URL) titkosítva vannak tárolva AES-256-GCM segítségével, egy dedikált véletlenszerű kulccsal a `$DATA_DIR/.secret-key` fájlban (mód `0600`, automatikusan generált). Ez független a `SESSION_SECRET`-től; egy `SESSION_SECRET`-ből származó kulcs dekódolás-csak fallbackként van tárolva azokhoz az értékekhez, amelyeket a dedikált kulcs létezése előtt írtak, és
  `src/services/secretsMigration.js` ezeket a dedikált kulcs alá újra titkosítja induláskor egyszer.
  Egy `.secret-key` fájl, amely létezik, de nem elemezhető, egy súlyos indítási hiba (soha nem generálódik csendesen felülírva). A Blueprint-ek minden titkot eltávolítanak exportáláskor.

## Adat és vezeték formátumok

- **`data/panel.db`** - az SQLite adatbázis. Naponta snapshotolva `VACUUM INTO` paranccsal a
  `data/backups/_panel/` könyvtárba (a legújabb 14 megőrizve); `PRAGMA integrity_check` fut induláskor.
- **`data/.session-secret`** - az automatikusan generált cookie-aláíró titok, első futáskor jön létre, ha a `SESSION_SECRET` nincs beállítva. Törlése forgatja a titkot (ami érvényteleníti a munkameneteket).
- **`data/.secret-key`** - a dedikált 32-bájtos tárolt titkosítási kulcs (mód `0600`), automatikusan létrehozva első futáskor. Független a `SESSION_SECRET`-től; törlése minden tárolt hitelesítő adatot
  dekódolhatatlanná tesz, ezért a biztonsági mentésekkel együtt kell tárolni.
- **Blueprintok (`.mcserver.zip`)** - egy zip fájl egy `manifest.json` fájllal, amely leírja a konfigurációt, az erőforrásokat, a rögzített csomag referencia, az overlay manifest (forrás URL-ek + sha256), a kiválasztott konfigurációs fájlok, és opcionálisan egy világ. Az import újratölti és hash-ellenőrzi minden modot, és friss portokat rendel hozzá.
- **Docker konténerek** a panel által létrehozva el vannak nevezve és címkézve, hogy a figyelő megtalálja őket;
  a panel teljes életciklusukat birtokolja.

## Indítási sorrend

1. `require('./instrument')` (a Sentry varrat) mindenekelőtt, majd `require('./preflight')` a nem támogatott Node verzió esetén egyértelmű hibaüzenet érdekében.
2. Konfiguráció betöltése; biztosítás/generálás `.session-secret` **és** `.secret-key`.
3. `ensureDataRoot()` - létrehozza a `./data` elrendezést, törli a `tmp/` könyvtárat.
4. Adatbázis migrációk futtatása, majd `PRAGMA integrity_check` (hangosan naplóz, hibás esetben a `data/backups/_panel` könyvtárra mutat).
5. Bármelyik örökölt `SESSION_SECRET`-kulcsú titok újra titkosítása a `.secret-key` alá (`secretsMigration`).
6. Indító blueprintok (védett) magvetése.
7. HTTP + WS szerver indítása. Egy elérhető kötés esetén, nyomtatja az első futású `/setup` PIN kódot.
8. A futásidejű őr telepítése indítás után (elfogja a nem kezelt hibákat; `MSM_EXIT_ON_FATAL=1` keményen kilép felügyelt telepítések esetén).
9. Háttérszolgáltatások indítása: WS közvetítő, tároló indexelő, hibakereső + leltár figyelők, ütemező,
   Discord esemény híd, és a **napi karbantartási időzítő** (régi analitikai sorok törlése + `panel.db` snapshotolása).
10. Docker inicializálása **háttérben**. A UI teljesen használható, amíg a daemon le van kapcsolva;
    a Docker funkciók akkor kapcsolódnak be, amikor elérhetővé válik. Csatlakozás után a `refreshStatuses({ boot })` összeegyezteti a gyorsítótárazott státuszokat, kibocsát egy egyszeri `offline-after-restart` eseményt egy olyan szerver számára, amely a panel újraindítása előtt fel volt kapcsolva, és nem lesz újraindítva, és az indítási ciklus elindítja a
    `auto_start` szervereket, plusz helyreállítja a hibásan leállt `auto_restart` szervereket a kimaradás során
    (figyelembe véve a hiba-ciklus visszapattanást).

> A `instrument`-et a `preflight` előtt kell betölteni egy tudatos kompromisszum: ez lehetővé teszi egy jövőbeli Sentry bekötés számára, hogy elsőként javítsa a futásidőt, egy kissé kevésbé barátságos üzenet árán egy igazán ősi Node esetén.

## Build folyamat

`pnpm run build` = `build:css` (Tailwind → `public/css/app.css`) + `build:js` (esbuild →
`public/dist/js/`, ESM kód-osztással). A `postinstall` **csak CSS-t** futtat. A `public/css/app.css`
és a `public/dist/` git-ben nem követett build artefaktumok; a Dockerfile build szakasz futtatja a teljes
`pnpm run build` parancsot, és bemásolja a `public/` könyvtárat a futásidejű képbe. A statikus eszközök
`immutable`/hosszú cache-sel vannak kiszolgálva az ujjlenyomat-fájlokhoz, rövid cache-sel a CSS/JS fájlokhoz, és `no-cache`-cel a HTML és az `/api` fájlokhoz.
