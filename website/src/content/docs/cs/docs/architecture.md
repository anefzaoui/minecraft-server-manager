---
title: 'Architektura'
description: 'Minecraft Server Manager je jednoprocesová, serverově renderovaná Node.js aplikace.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/architecture.md'
---

[← Zpět na index dokumentace](/docs/)

Minecraft Server Manager je jednoprocesová, serverově vykreslovaná Node.js aplikace. Spravuje
Minecraft servery, které běží jako Docker kontejnery pomocí image
[itzg/docker-minecraft-server](https://github.com/itzg/docker-minecraft-server), komunikuje s Docker
daemonem přes jeho API (nikdy nevolejte `docker` CLI).

## Běhové uspořádání

- **Express + Handlebars** vykreslují stránky na straně serveru. Nejedná se o SPA; prohlížečové JS v
  `public/js/` je ručně psané pro postupné vylepšování. Krok `esbuild` (`pnpm run build:js`) jej
  spojí a zmenší do `public/dist/js/`; aplikace tento balíček obsluhuje, pokud existuje, a jinak
  syrový zdroj, takže vývojový běh bez sestavení stále funguje.
- **`node:sqlite`** (vestavěný v Node; panel vyžaduje Node ≥ 24) je databáze - synchronní,
  bez nativních modulů, režim WAL. Malý verzovaný spouštěč migrací aplikuje `src/db/migrations/*`
  při spuštění. Připravené příkazy jsou cachovány v `src/db/index.js` s klíčem podle textu SQL.
- **`ws`** přenáší živé streamy konzole a statistik. Oba jsou **zprostředkované**: jeden upstream
  `docker logs --follow` (nebo `docker stats`) na server, jednou demuxovaný a rozeslaný do každé
  připojené karty, spíše než jeden upstream na prohlížeče. Zprostředkovatel konzole udržuje malou
  vyrovnávací paměť pro pozdní připojení karet a zahodí odběratele, jehož soket zaostává příliš
  daleko, místo aby zpomaloval sdílený stream.
- **dockerode** je jediný způsob, jak aplikace komunikuje s Dockerem. Koncový bod je automaticky
  detekován podle platformy (pojmenovaná pipa Windows vs. unixový soket).
- **Veškerý trvalý stav žije v jednom adresáři** (`$DATA_DIR`, výchozí `./data`). Kopírování
  tohoto adresáře migruje celý panel.

## Vrstvení

Závislosti plynou jedním směrem:

```
                 ┌─────────────────────────────┐
   HTTP  ───────▶│  web/routes/*  (+ middleware)│   parsování a validace vstupů, tvarování odpovědí
                 └──────────────┬──────────────┘
                                │
                 ┌──────────────▼──────────────┐
                 │         services/*          │   doménová logika (skutečné funkce)
                 └───┬─────────┬─────────┬─────┘
                     │         │         │
        ┌────────────▼──┐ ┌────▼────┐ ┌──▼──────────┐
        │   docker/*    │ │  db/*   │ │  storage/*  │   infrastruktura
        └───────────────┘ └─────────┘ └─────────────┘
```

- **`web/routes/`** - jeden router na doménu (`servers`, `players`, `worlds`, `crashes`, `blueprints`,
  `files`, …), připojený v `web/app.js`. Routry validují pomocí zod, volají službu a vracejí JSON
  nebo vykreslují pohled. Obchodní logika sem nepatří. Dva routry jsou připojeny v **veřejné zóně**,
  před `requireAuth`: `routes/status.js` (volitelné HTML stránky stavu na server) a
  `routes/apiV1.js` (`/api/v1`, pouze pro čtení JSON API autentizované tokenem Bearer vydaným administrátorem
  z `services/apiTokens.js`, vypnuté, pokud není povoleno v Nastavení; viz `docs/public-api.md`).
- **`services/`** - srdce aplikace. Každá služba vlastní jednu doménu a může záviset na
  infrastruktuře a na jiných službách.
- **`docker/`** - obaly dockerode: `connect` (detekce koncového bodu + stav daemonu), `containers`
  (vytváření/spouštění/zastavování/převytváření s bind mounty, limity paměti/CPU a štítky), `logs`, `stats`,
  `images` a `watcher`, který převádí události Dockeru na historii + detekci havárií.
- **`db/`** - obal SQLite a spouštěč migrací.
- **`storage/`** - bootstrap `./data`, **strážce cest** (`safeJoin`, páteř bezpečnosti souborů)
  a indexer velikosti na pozadí + vynucování kvót.

Průřezové:

- **`config/`** - konfigurace prostředí plus **katalog polí**: jediný zdroj pravdy pro
  nastavení serveru. Každá proměnná prostředí itzg je katalogizována (štítek, nápověda, typ, jednotka, výchozí,
  validace, sekce, příznaky nebezpečí). Průvodce, formuláře nastavení a validace zod jsou všechny odvozeny
  z něj, takže zpřístupnění nového nastavení je změna dat, nikoli nové potrubí UI.
- **`events/`** - `recordEvent()` je jediný vstupní bod pro log historie; události životního cyklu také
  zachycují výňatky z logů kontejnerů do `data/logs/<id>/events/`.
- **`ws/`** - autentizované WebSockety konzole + statistik (ověření cookie relace při upgradu, kontrola
  `Origin` pro blokování útoků přes weby), zprostředkované na server (viz "Běhové uspořádání").
- **`logger.js` + `instrument.js`** - `require('./logger')(label)` vrací per-modulový
  [Pino](https://getpino.io) logger; úroveň z `LOG_LEVEL`, `makeFailureThrottle()` udržuje
  trvale selhávající smyčku na pozadí na jeden řádek logu plus řádek "obnoveno".
  `src/utils/logSanitize.js` odstraňuje klíče ve formátu přihlašovacích údajů a tokeny webhooků ze strukturovaných
  metadat; `src/config/logLevel.js` je sdílený povolený seznam úrovní (udržovaný odděleně, aby se zabránilo cyklu
  vyžadování s `config`). `src/instrument.js` je nečinné místo Sentry, načtené jako první v
  `src/server.js`. `src/web/middleware/requestLog.js` zapisuje jeden řádek přístupového logu na požadavek
  (vynechává `/healthz` a statická aktiva). ESLint vynucuje `no-console` pod `src/**`, s výjimkou
  `preflight.js`, `instrument.js` a `config/index.js` (ty se spouštějí před existencí loggeru).
- **Omezení rychlosti** - `src/web/middleware/rateLimit.js` umisťuje `express-rate-limit` před `/api`
  (`RATE_LIMIT_API_PER_MIN`, výchozí 1200) a přihlášení / 2FA / nastavení POSTy
  (`RATE_LIMIT_AUTH_PER_15MIN`, výchozí 100); `0` zakáže omezovač. Klíčuje na `req.ip`, takže
  `TRUST_PROXY` je důležité za proxy. `/api/v1` má svůj vlastní omezovač na token
  (`RATE_LIMIT_PUBLIC_API_PER_MIN`, výchozí 120), klíčovaný na hash tokenu Bearer s IP jako zálohou.
  Samostatný měkký čítač na účet v
  `src/web/middleware/auth.js` zpracovává uzamčení přihlášení (na IP a globálně na účet, rozpadající se).

## Klíčové chování domény

- **Modpacky jsou vždy připnuté.** Image automaticky upgraduje nepřipnuté balíčky při každém restartu,
  takže panel při instalaci vyřeší "latest" na konkrétní ID verze a připne jej. Upgrady jsou explicitní
  orchestrovaný tok (`updates/`): náhled → záloha před aktualizací → plynulé zastavení →
  připnutí → přetvoření → monitor stavu → vrácení jedním kliknutím.
- **Překryvná vrstva vlastních modů** je spravována panelem: uživatelem přidané mody přistanou do
  deduplikované knihovny a jsou pevně propojeny do serveru, takže přežijí aktualizace balíčků.
  Zakázání je třídně uvědomělé.
- **Porty** jsou alokovány z hlavní schématu (hra od `PORT_GAME_START` nahoru, RCON = hra +
  `PORT_RCON_OFFSET`, Bedrock od `PORT_BEDROCK_START`), zjišťovány pro dostupnost a rezervovány v
  databázi.
- **Diskové kvóty** jsou vynucovány panelem, protože Docker nemůže omezit použití bind-mountů: indexer
  cachuje velikosti adresářů a operace zvětšení disku jsou na nich blokovány.
- **Tajné klíče** (hesla RCON, API klíče, tajné klíče TOTP, URL Discord webhooku) jsou šifrovány v klidu
  pomocí AES-256-GCM s dedikovaným náhodným klíčem na `$DATA_DIR/.secret-key` (režim `0600`,
  automaticky generováno). Je nezávislý na `SESSION_SECRET`; klíč odvozený z `SESSION_SECRET` je
  uchováván jako záloha pouze pro dešifrování pro hodnoty zapsané před existencí dedikovaného klíče a
  `src/services/secretsMigration.js` je při spuštění jednou znovu šifruje pod dedikovaným klíčem.
  `.secret-key`, který existuje, ale nelze jej analyzovat, je tvrdá chyba při spuštění (nikdy není
  tiše znovu generován přes vrstvu). Modré tisky odstraňují všechny tajné klíče při exportu.

## Datové a přenosové formáty

- **`data/panel.db`** - databáze SQLite. Denně snímkovaná pomocí `VACUUM INTO` do
  `data/backups/_panel/` (zachováno 14 nejnovějších); `PRAGMA integrity_check` se spouští při spuštění.
- **`data/.session-secret`** - automaticky generovaný tajný klíč pro podepisování cookie, vytvořený při prvním spuštění, pokud je `SESSION_SECRET` nenastaven. Jeho smazání otočí tajný klíč (což zneplatní relace).
- **`data/.secret-key`** - dedikovaný 32bajtový klíč pro šifrování v klidu (režim `0600`), automaticky vytvořený při prvním spuštění. Nezávislý na `SESSION_SECRET`; jeho smazání způsobí, že všechny uložené přihlašovací údaje budou nešifrovatelné, takže patří k vašim zálohám.
- **Modré tisky (`.mcserver.zip`)** - zip s `manifest.json` popisujícím konfiguraci, zdroje, připnutý odkaz na balíček, manifest překryvné vrstvy (zdrojové URL + sha256), vybrané konfigurační soubory a volitelně svět. Import znovu stáhne a ověří hash každého modu a přiřadí nové porty.
- **Docker kontejnery** vytvořené panelem jsou pojmenovány a označeny štítky, aby je watcher mohl najít;
  panel vlastní jejich plný životní cyklus.

## Sekvence spuštění

1. `require('./instrument')` (místo Sentry) před čímkoli jiným, pak `require('./preflight')`
   pro jasné selhání na nepodporované verzi Node.
2. Načtení konfigurace; zajištění/generování `.session-secret` **a** `.secret-key`.
3. `ensureDataRoot()` - vytvoření rozložení `./data`, vymazání `tmp/`.
4. Spuštění migrací databáze, pak `PRAGMA integrity_check` (hlasitě loguje, při selhání ukazuje na `data/backups/_panel`).
5. Znovu zašifrování všech starých tajných klíčů pod `SESSION_SECRET` pod `.secret-key` (`secretsMigration`).
6. Naplnění startovacích modrých tisků (chráněno).
7. Spuštění HTTP + WS serveru. Na vystaveném bindu vytiskne PIN pro první spuštění `/setup`.
8. Instalace strážce běhového prostředí po spuštění (zachytává nepolapitelné chyby; `MSM_EXIT_ON_FATAL=1` způsobí tvrdé ukončení pro spravovaná nasazení).
9. Spuštění služeb na pozadí: zprostředkovatel WS, indexer úložiště, watchery havárií + inventáře, plánovač,
   most událostí Discord a **denní časovač údržby** (pročištění starých řádků analytiky + snímek
   `panel.db`).
10. Inicializace Dockeru **na pozadí**. UI je plně použitelné, zatímco daemon je dole;
    funkce Dockeru se rozsvítí, jakmile se stane dosažitelným. Po připojení `refreshStatuses({ boot })`
    synchronizuje cachované stavy, emituje jednorázovou událost `offline-after-restart` pro server, který byl
    před restartem panelu zapnutý a nebude obnoven, a smyčka spouštění spustí
    servery `auto_start` plus obnoví servery `auto_restart` nalezené jako havarované během výpadku
    (s respektováním zpoždění smyčky havárií).

> Pořadí instrument-před-preflight je záměrný kompromis: umožňuje budoucímu zapojení Sentry
> nejprve opravit běhové prostředí, za cenu mírně méně přátelské zprávy na skutečně starém Node.

## Sestavovací pipeline

`pnpm run build` = `build:css` (Tailwind → `public/css/app.css`) + `build:js` (esbuild →
`public/dist/js/`, ESM s rozdělením kódu). `postinstall` spouští **pouze CSS**. `public/css/app.css`
a `public/dist/` jsou artefakty sestavení ignorované v gitu; fáze sestavení Dockerfile spouští plný
`pnpm run build` a kopíruje `public/` do obrazu běhového prostředí. Statická aktiva jsou obsluhována
s `immutable`/dlouhou cache pro soubory s otisky prstů, krátkou cache pro CSS/JS a `no-cache` pro HTML a
`/api`.
