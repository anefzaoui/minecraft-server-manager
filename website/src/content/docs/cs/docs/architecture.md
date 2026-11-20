---
title: 'Architektura'
description: 'Minecraft Server Manager je jednoprocesová, serverově renderovaná Node.js aplikace.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/architecture.md'
---

[← Zpět na index dokumentace](/docs/)

Minecraft Server Manager je jednoprocesová, serverově renderovaná Node.js aplikace. Spravuje
Minecraft servery běžící jako Docker kontejnery pomocí obrazu
[itzg/docker-minecraft-server](https://github.com/itzg/docker-minecraft-server), komunikuje s Docker
daemonem přes jeho API (nikdy nevolejte `docker` CLI).

## Architektura za běhu

- **Express + Handlebars** renderují stránky na straně serveru. Nejedná se o SPA; prohlížečový JS v
  `public/js/` je ručně psané progresivní vylepšení. Krok esbuild (`pnpm run build:js`) jej
  spojí a zmenší do `public/dist/js/`; aplikace obsluhuje tento balíček, když je přítomen, a
  syrový zdroj jinak, takže vývojový běh bez sestavení stále funguje.
- **`node:sqlite`** (vestavěný v Node; panel vyžaduje Node ≥ 24) je databáze - synchronní,
  bez nativních modulů, režim WAL. Malý verzovaný runner migrací aplikuje `src/db/migrations/*`
  při startu. Připravené příkazy jsou cachovány v `src/db/index.js` s klíčem podle textu SQL.
- **`ws`** přenáší živé streamy konzole a statistik. Oba jsou **zprostředkované**: jeden upstream
  `docker logs --follow` (nebo `docker stats`) na server, jednou demuxovaný a rozeslaný do každé
  připojené karty, spíše než jeden upstream na prohlížeče. Broker konzole udržuje malou vyrovnávací
  paměť pro pozdní připojení a zahodí odběratele, jehož soket zaostává příliš daleko, místo aby
  zpomalil sdílený stream.
- **dockerode** je jediný způsob, jak aplikace komunikuje s Dockerem. Koncový bod je automaticky
  detekován podle platformy (pojmenovaná pipe ve Windows vs. unixový soket).
- **Veškerý trvalý stav žije pod jedním adresářem** (`$DATA_DIR`, výchozí `./data`). Kopírování
  tohoto adresáře migruje celý panel.

## Vrstvení

Závislosti tečou jedním směrem:

```
                 ┌─────────────────────────────┐
   HTTP  ───────▶│  web/routes/*  (+ middleware)│   parsuje a validuje vstup, tvaruje odpovědi
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

- **`web/routes/`** - jeden router na doménu (`players`, `worlds`, `crashes`, `blueprints`, `files`, …).
  `web/app.js` připojuje ty nejvyšší úrovně (`api.js`, JSON API pro relace, které také drží hlavní
  serverové routy a připojuje doménové routy pro jednotlivé servery; `index.js`, stránky; `auth`, `account`,
  `tasks`, …). Routy validují pomocí zod, volají službu a vracejí JSON
  nebo renderují pohled. Obchodní logika sem nepatří. Dva routry jsou připojeny v **veřejné zóně**,
  před `requireAuth`: `routes/status.js` (volitelné HTML stavové stránky pro jednotlivé servery) a
  `routes/apiV1.js` (`/api/v1`, JSON API pouze pro čtení ověřené administrátorem vydaným Bearer tokenem
  z `services/apiTokens.js`, vypnuté, pokud není povoleno v Nastavení; viz `docs/public-api.md`).
- **`services/`** - srdce aplikace. Každá služba vlastní jednu doménu a může záviset na
  infrastruktuře a na jiných službách.
- **`docker/`** - obaly pro dockerode: `connect` (detekce koncového bodu + stav daemonu), `containers`
  (vytváření/spouštění/zastavování/re-vytváření s bind mounty, limity paměti/CPU a štítky), `logs`, `stats`,
  `images`, `networks` (objevování hostitelské sítě), `hostPath` (přesměrování bind cest pod
  `DATA_DIR_HOST`) a `watcher`, který převádí události Dockeru na historii + detekci pádů.
- **`db/`** - obal SQLite a runner migrací.
- **`storage/`** - bootstrap `./data`, **strážce cest** (`safeJoin`, páteř bezpečnosti souborů) a
  indexátor velikosti na pozadí + vynucování kvót.

Průřezové:

- **`config/`** - konfigurace prostředí plus **katalog polí**: jediný zdroj pravdy pro
  nastavení serveru. Každá itzg proměnná prostředí je katalogizována (štítky, nápověda, typ, jednotka, výchozí,
  validace, sekce, příznaky nebezpečí). Průvodce, formuláře nastavení a validace zod jsou všechny odvozeny
  z něj, takže zpřístupnění nového nastavení je změna dat, nikoli nové potrubí UI.
- **`events/`** - `recordEvent()` je jediný vstupní bod pro log historie; události životního cyklu také
  zachycují úryvky logů kontejneru do `data/logs/<id>/events/`.
- **`ws/`** - ověřené WebSockety pro konzoli + statistiky (ověření cookie relace při upgradu, kontrola `Origin`
  pro zablokování útoků přes weby), zprostředkované na server (viz "Architektura za běhu").
- **`logger.js` + `instrument.js`** - `require('./logger')(label)` vrací modulární
  [Pino](https://getpino.io) logger; úroveň z `LOG_LEVEL`, `makeFailureThrottle()` udržuje
  trvale selhávající smyčku na pozadí na jeden řádek logu plus řádek "obnoveno".
  `src/utils/logSanitize.js` odstraňuje klíče ve tvaru pověření a tokeny webhooků ze strukturovaných
  metadat; `src/config/logLevel.js` je sdílený povolený seznam úrovní (držený odděleně, aby se zabránilo cyklu
  vyžadování s `config`). `src/instrument.js` je neaktivní šev Sentry, načtený první v
  `src/server.js`. `src/web/middleware/requestLog.js` zapisuje jeden řádek access-logu na požadavek
  (vynechává `/healthz` a statická aktiva). ESLint vynucuje `no-console` pod `src/**`, s
  `preflight.js`, `instrument.js` a `config/index.js` jako výjimkami (běží před existencí loggeru).
- **Omezení rychlosti** - `src/web/middleware/rateLimit.js` umisťuje `express-rate-limit` před `/api`
  (`RATE_LIMIT_API_PER_MIN`, výchozí 1200) a přihlašovací / 2FA / nastavovací POSTy
  (`RATE_LIMIT_AUTH_PER_15MIN`, výchozí 100); `0` omezovač vypne. Klíčuje na `req.ip`, takže
  `TRUST_PROXY` je důležité za proxy. `/api/v1` má své vlastní omezovače: limit na klienta IP
  (pětinásobek rozpočtu na token), který běží před ověřením tokenu, pak rozpočet na token
  (`RATE_LIMIT_PUBLIC_API_PER_MIN`, výchozí 120) s klíčem podle ID ověřeného tokenu. Samostatný měkký čítač na účet v
  `src/web/middleware/auth.js` zpracovává uzamčení přihlášení (na IP a globálně na účet, rozpadající se).
- **Autorizace**: dvě vrstvy. Globální role (`requireAuth` → `requireRole` / `requireWrite` v
  `src/web/middleware/auth.js`) řídí akce v celém panelu a je výchozí na každém serveru. Oprávnění na server
  (`src/services/permissions.js`, devět schopností uložených jako JSON seznam na
  `(uživatel, server)` v `user_server_permissions`) zpřesňuje tuto výchozí hodnotu pro jeden server; každý
  směrovač `/api/servers/:id`, připojený podsměrovač, stránka, WebSocket a seznam napříč flotilou prochází
  `src/web/middleware/serverAccess.js` (`serverScope`, připojený na prefix `/servers/:id` jak
  API, tak směrovače stránek, skrývá server bez `view` jako 404; `requireCap(cap)` pojmenovává
  schopnost, kterou požadavek potřebuje). Zápisy, které pojmenovávají svůj server v těle (plány, extrakce a
  instalace světa, export blueprintů), jsou otevřeny pro prohlížeče pouze pomocí `requireWrite` pro daný server, a každý
  takový požadavek sám kontroluje schopnost. `test/permissions-routes.test.js` prochází živé zásobníky směrovačů a selže, pokud zápisový požadavek, připojení nebo stránka vázaná na server nemá bránu.

## Klíčové chování domény

- **Modpacky jsou vždy připnuté.** Obraz automaticky upgraduje nepřipnuté balíčky při každém restartu, takže
  panel při instalaci vyřeší "nejnovější" na konkrétní ID verze a připne jej. Upgrady jsou explicitní orchestrace
  (`updates/`): náhled → záloha před aktualizací → plynulé zastavení → re-pin →
  re-vytvoření → monitor stavu → vrácení jedním kliknutím.
- **Překryvná vrstva vlastních modů** je spravována panelem: uživatelem přidané mody přistanou do deduplikované knihovny a
  jsou pevně propojeny se serverem, takže přežijí aktualizace balíčku. Zakázání je třídně uvědomělé. Protože
  knihovna uchovává každou sestavu, kterou stáhla, aktualizace zaznamená sestavu, kterou nahradila
  (`server_content.previous_*`) a lze ji vrátit pouze z lokálních souborů. Zakázání modu balíčku zapíše proměnnou prostředí pro vyloučení balíčku místo toho; `packs.applyPack` přenáší tuto a zbytek ladění balíčku (`PACK_TUNING_KEYS`) přes změnu verze stejného balíčku a zahodí ji při změně balíčku.
- **Upgrade verze Minecraftu musí být zasloužený.** `services/compat.js` prohledá mody serveru -
  vyřešené z řádků nainstalovaných panelem, pak z manifestu balíčku CurseForge, pak podle hashe obsahu proti
  Modrinth/CurseForge - a sestaví matici podpory (loader, verze Minecraftu) na projekt
  z `latestFilesIndexes` CurseForge (200 projektů na požadavek) a seznam verzí Modrinth na projekt
  (jeden požadavek na projekt, což udržuje loader a verzi spárované). Kontrolka aktualizací nabízí pouze nejnovější verzi, kterou PODPORUJE KAŽDÝ mod, a nenabízí nic, když odpověď nelze stanovit: žádné skenování, skenování pro jinou verzi nebo loader, které nikdy neskončilo, nebo jar, který žádný registr nerozpozná. Skenování je pouze manuální a jeho průběh a částečné výsledky žijí v `version_compat` (nikoli v paměti `services/tasks.js`), takže obnovení nebo restart panelu pokračuje místo zobrazení spinneru; `reconcileScans()` označuje skeny opuštěné vypnutím při příštím spuštění.
- **Verze mod loaderu je připnutí, jako všechno ostatní.** `services/loaderPin.js` čte nainstalovanou sestavu z vlastního manifestu instalace obrazu (`.forge-manifest.json` a podobně) a zapisuje připnutí: itzg proměnnou loaderu na běžném serveru (`FORGE_VERSION`, …), nebo
  `CF_MOD_LOADER_VERSION` na balíčku CurseForge Forge nebo Fabric, což přepíše verzi deklarovanou balíčkem. Instalátor CurseForge obrazu ignoruje toto přepínání pro NeoForge a balíčky Modrinth a FTB žádné nemají, takže jejich loader následuje balíček. `packs.applyPack` odstraní všechny `CF_` proměnné při aktualizaci nebo vrácení balíčku, což spolu se zbytkem zahodí přepínání. Typovaná sestava je nejprve zkontrolována proti úplnému seznamu registru (`services/loaderVersions.js`; Forge pochází z jeho maven metadat, která přeskočí čísla; chybějící se znovu zkontroluje jednou proti samotnému registru), pak změna je záloha → připnutí (přes env, jak je po záloze) → přestavba.
- **Porty** jsou alokovány ze základního schématu (hra od `PORT_GAME_START` nahoru, RCON = hra +
  `PORT_RCON_OFFSET`, Bedrock od `PORT_BEDROCK_START`), testovány na dostupnost a rezervovány v
  databázi. "Obsazeno" je sjednocení všech nároků serveru (živé porty, plus čekající pár níže),
  každý hostitelský port, který jakýkoli Docker kontejner publikuje (`containers.publishedHostPorts`: živá propojení běžících kontejnerů plus nakonfigurovaná u každého zastaveného kontejneru, protože test bind portu zevnitř vlastního kontejneru panelu vidí pouze síťový prostor tohoto kontejneru) a test OS. Část Dockeru je cachována po dobu 3 sekund a omezena: seznam, který neodpoví za 2,5 sekundy, zahodí pouze část Dockeru a pomalá inspekce stojí pouze porty tohoto kontejneru. Vytváření serverů a
  `servers.changeGamePort` vybírají porty prostřednictvím jednoho řetězce serializace, který pokrývá pouze výběr
  a jeho nárok (zápis řádku pro vytvoření, rezervace v paměti pro změnu portu);
  BlueMapův výběr portů a přepínání dodatečných portů nejsou v něm a ne
  konzultují Docker. Změna portu na existujícím serveru (`servers.changeGamePort`, pod zámkem operací serveru) je aplikována najednou, protože Docker opravuje propojení portů při vytváření kontejneru:
  nový pár (RCON vždy hra + `PORT_RCON_OFFSET`) je zkontrolován a rezervován v paměti
  (`ports.reserve`, jak starý, tak nový pár, respektovaný každým jiným výběrem) pod zámkem portu. Je odmítnuto (409 `PENDING_CHANGES`), zatímco ostatní nastavení čekají na přestavbu, takže přestavuje pouze kontejner, který již běžel, na novém portu; a běžící server je změněn pouze tehdy, když požadavek říká `restart: true` (jinak 409 `NEEDS_CONFIRM`). Obraz je stažen a název vlastního kontejneru je zkontrolován před jakýmkoli dotykem. Běžící server je zastaven; pak je nový pár zapsán s `pending_recreate = 1` (takže pád panelu odtud zanechá poctivou "přestavbu čekající"), kontejner je odstraněn, přestavěn na novém páru a spuštěn. Pokud jakýkoli krok po zastavení selže, `putBackOnOldPort` zapíše starý pár zpět, přestaví (a restartuje, pokud běžel) na něm a zaznamená, který krok selhal; historie a upozornění říkají, zda selhalo i to, což zanechá server zastavený, dokud jej někdo nestartuje.
  Schopnost `settings` je dostatečná, včetně běžícího serveru. Neadministrátoři mohou vybírat pouze z `PORT_GAME_START` nahoru.
  (Sloupce `port_*_pending` z migrace 029 patří k dřívějšímu, nevydanému designu a jsou nepoužité; 031 je vymaže.) Kolize zámku odpovídá 409 s `code: 'BUSY'`, což opakující se volající níže kontrolují spíše než text. Automatický restart po pádu
  (`watcher.restartAfterCrash`) a naplánovaná záloha nebo start (`scheduler.runTaskWithRetry`),
  které zjistí, že server je zaneprázdněn jinou akcí, se pokoušejí znovu každých 20 s / 60 s po dobu až 30 minut,
  a aktualizace nebo vrácení balíčku opakuje své uzamčené kroky stejným způsobem (`opLock.retryWhileBusy`);
  restart po pádu nebo čekající naplánovaný start se vzdá, jakmile někdo server od té doby zastavil, zabil nebo spustil (`events.lifecycleActionSince`), a restart po pádu také, když je automatický restart vypnutý nebo server neexistuje. Naplánované restarty, zastavení a příkazy se neopakují a plán, jehož poslední běh stále čeká, přeskočí své další spuštění.
- **Diskové kvóty** jsou vynucovány panelem, protože Docker nemůže omezit použití bind-mountů: indexátor
  cachuje velikosti adresářů a operace růstu disku jsou na nich blokovány.
- **Tajné klíče** (hesla RCON, API klíče, TOTP tajné klíče, URL Discord webhooku) jsou šifrovány v klidu pomocí AES-256-GCM s dedikovaným náhodným klíčem na `$DATA_DIR/.secret-key` (režim `0600`,
  automaticky generovaný). Je nezávislý na `SESSION_SECRET`; klíč odvozený z `SESSION_SECRET` je uchováván jako záložní možnost pouze pro dešifrování pro hodnoty zapsané před existencí dedikovaného klíče a
  `src/services/secretsMigration.js` je při startu znovu šifruje pod dedikovaným klíčem.
  `.secret-key`, který existuje, ale nelze jej analyzovat, je tvrdá chyba při startu (nikdy není tiše
  přegenerován). Blueprinty odstraňují všechna tajná data při exportu.
- **`server.properties` je vlastněn panelem, ale stínován proměnnými prostředí.** itzg obraz znovu potvrzuje každou
  vlastnost založenou na prostředí při každém startu (`OVERRIDE_SERVER_PROPERTIES` výchozí hodnota je true), takže hodnota, kterou panel upravuje přímo - Ovládání světa PvP/obtížnost, přepínač whitelistu, editor souborů -
  by byla tiše vrácena při příštím startu, pokud by odpovídající proměnná prostředí nebyla odstraněna a kontejner znovu vytvořen. Každý přímý zápis vlastnosti prochází `writeServerProperties()` (celý soubor) nebo `setServerProperty()` (jeden klíč) v `src/services/servers.js`, které atomicky přepisují
  soubor, odstraní proměnnou prostředí za každým změněným klíčem (přes atribut `prop:` v polích katalogu, kontrolováno v testech proti definicím vlastností samotného obrazu) a označí
  `pending_recreate`. Obtížnost je zapsána do souboru i poslána přes RCON, protože dedikovaný server znovu aplikuje vlastnost `difficulty` při každém spuštění. Samotný Minecraft znovu ukládá server.properties ze svých hodnot při spuštění při zapnutí/vypnutí `whitelist`, což by zrušilo úpravy provedené během běhu serveru, takže běžící přepínač whitelistu nejprve uloží soubor a zapíše jej zpět se změněným pouze `white-list`. Proměnné prostředí
  zůstávají plně konfigurovatelné při vytváření (průvodce je vykreslí a aplikují se jednou); odepnou se pouze při prvním úpravě panelu podkladové vlastnosti. MOTD má stejnou smlouvu: přímá úprava souboru `motd` ji odepne, takže platí poslední zápis.

## Datové a přenosové formáty

- **`data/panel.db`** - databáze SQLite. Denně zálohováno pomocí `VACUUM INTO` do
  `data/backups/_panel/` (nejnovějších 14 uchováno); `PRAGMA integrity_check` běží při startu.
- **`data/.session-secret`** - automaticky generovaný tajný klíč pro podepisování cookies, vytvořený při prvním spuštění, pokud je `SESSION_SECRET` nenastaven. Jeho smazání otočí tajný klíč (což zneplatní relace).
- **`data/.secret-key`** - dedikovaný 32bajtový klíč pro šifrování v klidu (režim `0600`), automaticky vytvořený při prvním spuštění. Nezávislý na `SESSION_SECRET`; jeho smazání učiní každý uložený údaj
  nečitelným, takže patří k vašim zálohám.
- **Blueprinty (`.mcserver.zip`)** - zip s `manifest.json` popisujícím konfiguraci, zdroje, připnutý odkaz na balíček, manifest překryvné vrstvy (zdrojové URL + sha256), vybrané konfigurační soubory a volitelně svět. Import znovu stáhne a ověří hash každého modu a přiřadí nové porty.
- **Docker kontejnery** vytvořené panelem jsou pojmenovány a označeny štítky, aby je watcher mohl najít;
  panel vlastní jejich plný životní cyklus.

## Sekvence spouštění

1. `require('./instrument')` (švu Sentry) před čímkoli jiným, pak `require('./preflight')`
   pro jasné selhání při nepodporované verzi Node.
2. Načtení konfigurace; zajištění/generování `.session-secret` **a** `.secret-key`.
3. `ensureDataRoot()` - vytvoření rozložení `./data`, vymazání `tmp/`.
4. Spuštění migrací databáze, pak `PRAGMA integrity_check` (hlasitě loguje, ukazuje na `data/backups/_panel`
   při selhání).
5. Znovu zašifrování všech starých tajných klíčů pod `SESSION_SECRET` pod `.secret-key` (`secretsMigration`).
6. Jednorázový import API klíčů z prostředí (`apiKeys.importFromEnvOnce()`), připnutí všech serverů stále
   nesoucích nepřipnutý výběr modpacku (`packPins.pinUnpinnedServers()`), označení skenů kompatibility verzí ponechaných běžících předchozím procesem jako přerušené
   (`compat.reconcileScans()`), pak naplnění počátečních blueprintů (chráněno).
7. Spuštění HTTP + WS serveru. Na vystaveném bindu vytiskne PIN pro první spuštění `/setup`.
8. Instalace strážce běhového prostředí po spuštění (zachytává nezachycené chyby; `MSM_EXIT_ON_FATAL=1` způsobí tvrdé ukončení pro spravovaná nasazení).
9. Spuštění služeb na pozadí: WS broker, indexátor úložiště, watchery pádů + inventáře, plánovač,
   most událostí Discord, watcher pro oslovení chatbotů a **denní časovač údržby** (pročištění starých
   řádků analytiky, přepisů chatbotů, historie událostí (365 dní) a řádků cache API, pak snapshot
   `panel.db`).
10. Inicializace Dockeru **na pozadí**. UI je plně použitelné, zatímco daemon je dole;
    funkce Dockeru se rozsvítí, jakmile se stane dosažitelným. Po připojení `refreshStatuses({ boot })`
    synchronizuje cachované stavy, emituje jednorázovou událost `offline-after-restart` pro server, který byl zapnutý před restartem panelu a nebude obnoven, a smyčka spouštění spustí
    servery `auto_start` plus obnoví servery `auto_restart` nalezené jako padlé během výpadku
    (s ohledem na zpětný útlum pádů).

> Pořadí instrument-před-preflight je záměrný kompromis: umožňuje budoucímu drátování Sentry
> opravit runtime jako první, za cenu mírně méně přátelské zprávy na skutečně staré verzi Node.

## Sestavovací pipeline

`pnpm run build` = `build:css` (Tailwind → `public/css/app.css`) + `build:js` (esbuild →
`public/dist/js/`, ESM s rozdělením kódu). `postinstall` spouští **pouze CSS**. `public/css/app.css`
a `public/dist/` jsou artefakty sestavení ignorované v gitu; fáze sestavení Dockerfile spouští plný
`pnpm run build` a kopíruje `public/` do runtime obrazu. Statická aktiva jsou obsluhována
`immutable`/dlouhá cache pro soubory s otiskem prstu, krátká cache pro CSS/JS a `no-cache` pro HTML a
`/api`.
