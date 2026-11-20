---
title: 'Szerverenkénti Minecraft chatbot'
description: 'A panel minden felügyelt Minecraft szerverhez egy rendszergazda által konfigurált chatbotot kínál, amely a szerver Beállítások → Chatbot lapján állítható be.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/chatbot.md'
---

[← Vissza a dokumentumokhoz](/docs/)

A panel minden felügyelt Minecraft szerverhez egy rendszergazda által konfigurálható chatbotot kínál, amely a szerver **Beállítások → Chatbot** lapján állítható be. Ez egy OpenAI-kompatibilis chat-completions végponthoz csatlakozik, beleértve az Ollama-t egy másik LAN-os gazdagépen. Minden szervernek saját végpontja, modellje, meghívóneve, személyisége, átirat-politikája, kihelyezési üzenetei és teljesítménypolitikája van. Az alapértelmezett meghívó a `@wizard`, az alapértelmezett személyiség pedig egy ősi, játékos kedvű, a játék világában játszódó varázslót mutat be; mindkettő szerkeszthető.

![Chatbot beállítások](/docs/images/integrations-chatbot.png)

## Játékos élmény

- Bármely játékos használhatja a `@wizard <üzenet>` (vagy a konfigurált meghívót) parancsot beszélgetéshez és determinisztikus, Minecraft verzió-tudatos vanilla recept súgóhoz.
- A csatlakozási üdvözlések és egy konfigurálható, egyszeri játék-munkamenet ellenőrzés emlékezteti a játékosokat a chatbot elérhetőségére. A `@wizard chat` parancs megnyit egy rövid, opt-in beszélgetési ablakot; a `@wizard bye` parancs bezárja azt.
- **Alap felhasználók** meghívhatnak engedélyezett önmaguknak vagy világnak szóló képességeket. **Teljesítményvezérlők** külön validált műveleteket hajthatnak végre, amelyek egy másik online játékost érintenek. Az egyik csoportba sem tartozó játékosok csak beszélgetésre korlátozódnak.
- Az alap felhasználók önmaguknak szóló ajándékai egy elem engedélyezési listát használnak. A vezérlők bármilyen érvényes névterű vanilla vagy modded elemet adhatnak egy másik játékosnak, a mennyiségi korlátozások és egyéb teljesítménybiztonsági intézkedések betartásával.

![Chatbot átiratok](/docs/images/chatbot-transcripts.png)

## Tervezés és biztonság

A konfiguráció és az átiratok csak rendszergazdák számára érhetők el. A modell soha nem kap nyers RCON vagy tetszőleges parancs végrehajtást. Egy üzenet csak az egyetlen, rögzített eszközt teszi elérhetővé, amely megfelel annak kifejezett szándékának; a szerver kódja érvényesíti az engedélyezést, az argumentumokat, a zászlókat, a mennyiségeket, a hűtési időket és az online játékosok pontos neveit, mielőtt egy meglévő szolgáltatási műveletet végrehajtana. A Minecraft kiválasztók elutasításra kerülnek, a játékosok közötti műveletek nem célozhatják meg a hívót, a képességek szárazfutás módban indulnak, és minden megkísérelt képesség auditálva van. A nem támogatott eszközmeghívó modellek csak beszélgetésre esnek vissza.

A válaszok korlátozottak a Minecraft csevegéshez. Az ismert vanilla receptek a mellékelt, verziószámozott receptadatokból származnak, és stabil 2x2/3x3 sorokban jelennek meg; az LLM nem bízható meg a recept elrendezések kitalálásában. Az ismeretlen vagy modded receptek a JEI/REI-hez irányítják a játékost a válasz kitalálása helyett.

## Fő implementációs fájlok

- `src/services/wizard.js`: szerverenkénti konfiguráció, OpenAI-kompatibilis kérések, csevegés kezelése, kihelyezés, átirat megőrzés, és válaszkorlátok.
- `src/services/wizardPowers.js`: szerepkör ellenőrzések, szándékspecifikus eszközsémák, validálás, végrehajtás, hűtési idők, és teljesítmény auditálás.
- `src/services/wizardRecipes.js`: determinisztikus, verziószámozott recept keresés és rács formázás. A recept- és elemadatok a mellékelt [`minecraft-data`](https://github.com/PrismarineJS/minecraft-data) csomagból származnak. (Egy korábbi dokumentumtervezet egy `src/data/recipes/` mappára mutatott, amely soha nem lett commit-olva; nincs ilyen mappa, és az adatok a csomagban találhatók. Lásd "Dependency footprint".)
- `src/analytics/ingest.js`: továbbítja a feldolgozott csatlakozásokat, kilépéseket és játékos csevegéseket a chatbotnak.
- `src/web/routes/wizard.js`, `public/js/pages/integrations.js`, és `views/partials/server/integrations.hbs` (a `chatbot.hbs` keresztül): rendszergazdai API és a szerverenkénti Beállítások → Chatbot lap.
- `src/db/migrations/011_wizard_chat.js`, `013_wizard_invocation_name.js`, `015_wizard_powers.js`, `017_wizard_outreach.js`, és `019_wizard_power_controllers.js`: perzisztens séma.
- `test/wizard.test.js`: engedélyezési, eszközhatár, megőrzési, kihelyezési és csevegési viselkedési tesztek.

A belső `wizard` útvonal/modul/tábla nevek megmaradnak a frissítési és API kompatibilitás érdekében; a "chatbot" a felhasználóbarát terméknév. Hasonlóképpen, a tárolt `power_testers_json` mező a felhasználói felület **Alap felhasználók** csoportjának felel meg.

## Függőség lábnyom (`minecraft-data`)

A recept súgó a `minecraft-data` csomagot használja. Nagy helyet foglal a lemezen (kb. 429 MB telepítve), és a production image-ben van, mert futásidejű függőség, nem fejlesztői. Szándékosan tartjuk meg, hogy a recept súgó offline módban működjön minden Minecraft kiadáshoz, hálózati hívás nélkül.

Megjegyzések a következő szemlélőnek (ember vagy AI), hogy a méret ne okozzon meglepetést:

- Jelenleg csak a Java (`pc`) adatok használatosak. A `wizardRecipes.js` a `minecraftData.versions.pc` és az verziónkénti `recipes`, `items`, és `blocks` táblákat olvassa. Az általa ténylegesen érintett fájlok összesen kb. 15 MB-ot tesznek ki minden pc verzión keresztül.
- A csomag mintegy 330 MB-ja a `data/bedrock` mappa, és jelenleg semmi sem olvassa. Szándékosan hagyjuk ott. Ha a panel valaha is hozzáadja a Bedrock Minecraft támogatást, a Bedrock recept- és elemadatok már ott lesznek, így a recept funkció bővíthető lesz Bedrock szerverek lefedésére anélkül, hogy új függőséget kellene hozzáadni. A `minecraftData.versions.bedrock` alapján kell elindulni, és követni kell ugyanazt az alakot, mint a pc útvonal.
- Ha a méretet le kell csökkenteni a Bedrock támogatás érkezése előtt, már van erre minta ebben a repositoryban. A `src/services/itemRegistry.js` lekéri a `minecraft-data` fájlokat a jsDelivr CDN-ről, amikor szüksége van rájuk, és a `api_cache`-ben tárolja őket. Vagy ez a megközelítés, vagy egy kis, kézzel válogatott `src/data/recipes/` alcsoport, amely néhány gyakori verziót fed le, jelentősen csökkentené a kép méretét.

## Helyi tárolás és manuális ellenőrzés

Minden beállítás és megőrzött átirat a panel SQLite adatbázisában található a `/data/panel.db` címen a panel konténeren belül. A standard Compose mount-tal a host elérési útja `${DATA_DIR_HOST}/panel.db` (például `/opt/msm/data/panel.db`). A releváns táblák a `wizard_configs`, `wizard_transcripts`, és `wizard_outreach`; a teljesítmény auditok az `events` tábla sorai, `wizard-power` típussal. Az opcionális LLM API kulcs AES-256-GCM titkosítással van védve a panel at-rest kulcsával, a `.secret-key` a data mappában (külön a `SESSION_SECRET`-től).

Biztonsági mentést kell készíteni az adatbázisról, és le kell állítani a panelt a közvetlen SQLite szerkesztések előtt, hogy a WAL biztonságosan kezelve legyen. A rendszergazdai UI/API használata javasolt, mert érvényesítést és titkosítást alkalmaz. Tartsa együtt a `panel.db`, `panel.db-wal`, és `panel.db-shm` fájlokat, amikor egy élő adatbázist másol.
