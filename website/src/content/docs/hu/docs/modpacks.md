---
title: 'Modpackok'
description: 'Telepíts CurseForge, Modrinth, FTB és GT New Horizons modpackokat szerverként, mindig egy pontos csomagverzióhoz rögzítve.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/modpacks.md'
---

[← Vissza a dokumentumokhoz](/docs/)

A **Modpackok** oldal (és a [létrehozási varázsló](/docs/servers/) **Modpackból** fül) egy modpackot telepít szerverként, mindig **egy pontos csomagverzióhoz rögzítve**, így egy újraindítás soha nem frissítheti csendben a csomagot.

![Modpackok](/docs/images/modpacks.png)

## Támogatott platformok

- **CurseForge**: név alapján keresés. CurseForge API kulcs szükséges (add hozzá a **Beállítások → API kulcsok** alatt).
- **Modrinth**: név alapján keresés.
- **FTB**: Feed The Beast csomagok, csak API-n keresztül (numerikus csomagazonosító plusz egy explicit verzióazonosító). A panel még nem ellenőrzi az FTB csomagokat frissítésekre.
- **GT New Horizons**: az 1.7.10-es szakértői csomag, a GTNH saját kiadási indexéből telepítve. A GTNH csomagonként választja meg a Java futtatókörnyezetét a csomagverzió szerint (a 2.8.0+ a **Java 25**-ön fut a mellékelt lwjgl3ify javításokon keresztül, a régebbi kiadások Java 21-en vagy 17-en), és a varázsló emeli a szerver RAM-ját és tárhelyét az ésszerű minimumokra.
- **Egyéni zip**: egyáltalán nem egy közzétett csomag. Tölts fel egy **CurseForge modpack exportot** (a `manifest.json` fájlt tartalmazó zip, amelyet a CurseForge alkalmazása előre kiválasztott modkészlethez hoz létre), egy **Modrinth `.mrpack`** fájlt, vagy **bármilyen mod jar fájlokból álló zipet**. A panel tömegesen feloldja a manifestet (vagy azonosítja az egyes jar fájlokat hash/ujjlenyomat/metaadatok alapján), előnézetet készít arról, ami illeszkedik, és egyetlen feladatban telepít mindent, beleértve a csomag `overrides/` konfigurációit is, ha ezt választod. Azok a modok, amelyek szerzői nem engedélyezik az automatizált letöltéseket, böngészőhivatkozással és manuális feltöltési hellyel jelennek meg a telepítés meghiúsulása helyett.

## A rögzítés működése

Amikor kiválasztasz egy csomagot, a panel feloldja a pontos verziót, rögzíti azt, és telepíti. A **Frissítések** oldalon értesítést kapsz, ha újabb verzió érhető el (kivéve, ha a szerver [frissítési szabályzata](#update-policy) **Csak manuális**), a frissítés egy szándékos, őrzött művelet, előzetes biztonsági mentéssel és visszaállítással. A stabil verziókat követő szerverek soha nem kapnak béta verziót. A szerver saját **Verziók** füle válaszol a kérdés másik felére: mely jövőbeli Minecraft verziókat követhetik a benne lévő modok ([frissítések](/docs/updates/#minecraft-version-compatibility)).

A mod betöltő verziója is a csomaggal érkezik: a szerver telepíti a Forge, NeoForge vagy Fabric buildet, amelyet a csomag deklarál. Ha egy Forge vagy Fabric CurseForge csomag olyat deklarál, ami túl régi a saját modjaihoz, a **Verziók** fül felülírhatja azt, amíg a csomag javításra nem kerül; a csomagfrissítés eltávolítja a felülírást, mivel az új verzió saját maga deklarálja azt ([a mod betöltő verziójának módosítása](/docs/updates/#changing-the-mod-loader-version)).

Nagyon régi panel verziókon (0.9.7 előtt) létrehozott szerverek **nem rögzítettek** maradhatnak, ami azt jelenti, hogy a konténerkép minden indításkor csendben telepíti a legújabb csomagverziót. A panel most ezeket indításkor javítja: minden egyes szervert a telepített verzióhoz rögzít (a panel saját nyilvántartásából vagy a kép telepítési manifestjéből olvasva, soha nem egy frissen feloldott "legújabb"-ból), és naplóz egy eseményt. Ha nem tudja megállapítani, mi van telepítve, a szerver Beállítások oldala figyelmeztetést jelenít meg egy **Verzió kiválasztása…** gombbal (CurseForge, Modrinth és GTNH csomagok), amely megnyitja a [verzióválasztót](#changing-the-pack-version), és minden rögzítetlen modpack konfiguráció mentési kísérletét elutasítjuk.

## Frissítési szabályzat

Minden szerver rendelkezik egy **Frissítési Szabályzat** kártyával a **Beállítások → Konfiguráció** fülén, és mindhárom opció azt jelenti, amit mondanak:

- **Csak manuális** (alapértelmezett): semmi sem változik önmagától, és a szerver teljesen kimarad a frissítési jelvényből és a Frissítések oldalról. Az "hagyj békén" mód: ideális egy kézzel hangolt vagy importált csomaghoz, amelyet soha nem akarsz érinteni. Nem rögzíti a verziót: a [**Verzió módosítása…**](#changing-the-pack-version) minden szabályzat alatt működik. Az új verziókról való értesítéshez és az egy kattintással történő alkalmazáshoz válaszd az **Értesíts engem** opciót.
- **Értesíts engem**: a napi ellenőrzés elérhető frissítéseket jelenít meg jelvényként és a Frissítések oldalon; azok alkalmazása mindig a te kattintásod.
- **Automatikus frissítés**: a napi ütemezett ellenőrzés után a függőben lévő **csomag** frissítések ugyanazon az őrzött útvonalon keresztül kerülnek alkalmazásra, mint egy manuális frissítés: előzetes biztonsági mentés, állapotfigyelés és automatikus visszaállítás, ha az új verzió nem indul el sikeresen. Azok a frissítések, amelyek a szervert egy másik Minecraft verzióra váltanák, mindig kihagyásra kerülnek egy esemény helyett: a világ végleges konvertálása olyan döntés, amelyet a panel nem hoz meg helyetted. A manuális **Most ellenőrizze** gombok csak ellenőriznek; soha nem indítanak automatikus frissítéseket.

## Csomag frissítése

Egy rögzített szerverről egyetlen művelettel frissíthetsz egy újabb verzióra. A panel először biztonsági mentést készít, kicseréli a rögzített verziót, újraépíti a szervert (újra feloldja a Java-t, ha az új verzió eltérő futtatókörnyezetet igényel), és figyeli az első indítást, bőséges időablakkal a nagy csomagok, mint a GTNH számára, amelyek letöltenek pár gigabájtot és létrehoznak egy több száz modot tartalmazó világot az első indításkor.

## Csomagverzió módosítása

Egy adott verzió futtatásához, újabb vagy régebbi, használd a **Verzió módosítása…** gombot a szerver **Áttekintés** fülén található csomagkártyán. A **Modpackok** oldalon egy telepített csomag kártyájának megnyitása ugyanazt a választást kínálja: válaszd ki a verziót a legördülő menüben, és kattints a **Váltás erre a verzióra** gombra. Mindkettőhöz a szerver **Tartalom** engedélye szükséges, és mindkettő elérhető a CurseForge, Modrinth és GTNH csomagokhoz (az FTB csomagoknak még nincs verziólistája). A lista a 25 legújabb verziót mutatja a CurseForge és Modrinth számára, és minden GTNH kiadást.

A váltás ugyanazon az őrzött útvonalon halad át, mint egy frissítés: előzetes biztonsági mentés, az új rögzítés, újraépítés és egy figyelt első indítás, egy kattintással történő visszaállítással, ha a szerver nem indul el megfelelően. Az egyéni modjaid átkerülnek, akárcsak a letiltott csomagmodok, valamint a csomag egyéb telepítési beállításai (bekényszerített modok, figyelmen kívül hagyott fájlok, extra projektek). Egy másik csomag telepítése ezeket a beállításokat frissen kezdi, mert csak a csomaghoz illenek, amelyhez készültek.

Minden verzió a futtatott Minecraft verziójával van felsorolva, összehasonlítva azzal a verzióval, amellyel a világod utoljára mentve lett:

- **Azonos Minecraft verzió**: váltás normál megerősítés után. Régebbi csomagverzióra való visszatérés blokkokat és elemeket dobhat el azokból a modokból, amelyekkel az a verzió nem rendelkezik, így a biztonsági mentés mindkét esetben a Biztonsági mentések fülön marad.
- **Újabb Minecraft verzió**: megerősítés után engedélyezett, amely figyelmeztet, hogy a világ véglegesen konvertálva lett. Az első elkészített biztonsági mentés az egyetlen út a régi világba.
- **Régebbi Minecraft verzió**: nem elérhető. A Minecraft nem tud betölteni egy világot egy régebbi verzióról, mint amelyik utoljára mentette, ezért a panel elutasítja, ahelyett, hogy egy indításkor összeomló szervert hagyna.
