---
title: 'Frissítések'
description: 'Kövesse nyomon és alkalmazza a Minecraft verziók, modpackok, modok és bővítmények frissítéseit minden szerveren, szerverenkénti szabályzattal.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/updates.md'
---

[← Vissza a dokumentumokhoz](/docs/)

A **Frissítések** oldal egy helyen követi nyomon, hogy mi avult el a szerverparkodban:

- **Modpack** verziók ([modpackok](/docs/modpacks/)) a Modrinth / CurseForge / GTNH kiadási indexével szemben.
- Saját magad által hozzáadott **egyedi tartalom** (modok, datapackok, resource packok, pluginok), mindegyik a forrásával szemben: Modrinth, CurseForge, Hangar, SpigotMC (Spiget) vagy GitHub Releases. A GitHub lekérdezések ETag érvényesítést használnak, így a napi ellenőrzések alig terhelik a sebességkorlátot.
- **Docker image** elavultsága: minden szerver konténer image azonosítója egy frissen lehúzott taggal szemben (azonosítva a szerverek között ugyanazon a tagon), csak újraépítésként kínált frissítésként.
- **Önálló verzió rögzítések**: egy felügyelt csomag nélküli szerver esetében egy explicit `mc_version` rögzítés a Mojang manifestumával szemben, és egy explicit loader-build környezeti változó (`PAPER_BUILD`, `FORGE_VERSION` és hasonló) a loader nyilvántartásával szemben. A Paper buildek a PaperMC aktuális **Fill v3 API**-jából származnak (a régi v2 végpont már nem kap új Minecraft verziókat). Modokkal rendelkező szerveren egy újabb Minecraft verzió csak akkor kínálkozik fel, ha egy [verzióellenőrzés](#minecraft-version-compatibility) kimutatta, hogy minden telepített modhoz létezik hozzá build. Egy rögzített Forge szerverhez a Forge ajánlott buildje kínálkozik fel, soha nem egy régebbi build, mint amire rögzítve van, és egy kiadáshoz rögzített szerverhez soha nem kínálkozik fel előzetes kiadás (egy béta verzióra már rögzített szerver kaphat újabb béta vagy kiadási verziót). Loader build alkalmazása előtt biztonsági mentést készít. A Forge vagy NeoForge szerver új Minecraft verzióra váltása törli a rögzített loader build számát, mert egy build csak egy Minecraft verzióhoz készül; egy kulcsszó, mint a `latest`, megmarad, mivel az önmagában követi a verziót. Egy konkrét build kiválasztásához lásd: [a mod loader verziójának módosítása](#changing-the-mod-loader-version).

![Frissítések](/docs/images/updates.png)

## Hogyan működik

A panel összeveti az egyes szerverek rögzített verzióit a forrásrendszerekkel, és kilistázza az újonnan elérhető kiadásokat. A számláló a [vezérlőpult](/docs/dashboard/)'on is megjelenik a "Frissítések elérhetők" csempén.

Az ellenőrzések alapértelmezetten naponta futnak egy [ütemezés](/docs/schedules/) szerint, és igény szerint a **Mindent most ellenőriz** gombbal. Az adott sorban lévő **Kihagyás** megállítja az adott verzió felajánlását; egy újabb verzió ismét felajánlásra kerül. A frissítési **szabályzat** szerverekre vonatkozik: a panel mindent manuálisan hagy (alapértelmezett, ami miatt a szerver nem jelenik meg ezen az oldalon), csak értesít, vagy maga alkalmazza a csomagfrissítéseket ([frissítési szabályzat](/docs/modpacks/#update-policy)).

## Minecraft verzió kompatibilitás

Egy újabb Minecraft verzió nem jelent frissítést, ha a modjaid nem tudnak veled tartani. Minden szervernek van saját **Verziók** (Modok alatt) fülje, amely megválaszolja ezt a kérdést:

- A szerver jelenleg futó verziója, és a **legmagasabb verzió, amelyhez minden telepített modnak van buildje**.
- Egy összecsukható sor minden jövőbeli Minecraft verzióhoz, amely megmutatja, hány mod készen áll, és hányhoz nem jelent meg még semmi. Nyiss meg egy sort, hogy lásd, mely modok maradnak le, és melyek rendben vannak.

![Verzió kompatibilitás](/docs/images/server-versions.png)

Nyomd meg a **Jövőbeli verziók ellenőrzése** gombot a futtatáshoz. Semmi sem szkennel önmagától: egy ellenőrzés beolvassa a szerver mod mappájában lévő összes jar fájlt, és megkérdezi a Modrinth-ot és a CurseForge-ot minden egyes fájlról, így ez csak akkor történik meg, amikor te kéred. A folyamat és az ideiglenes eredmények íródnak, így az oldal bezárása vagy az oldal frissítése semmit sem vesz el, és egy megszakadt ellenőrzés jelzi, hogy felajánlja az újrafuttatást. Minden, amit egy megszakadt ellenőrzés már feldolgozott, megmarad, így az újrafuttatás nem ismétli meg a munkát.

Egy jelentés csak a hozzá tartozó szervert írja le. Változtasd meg a Minecraft verziót, a loadert, vagy magukat a modokat (adj hozzá egyet, távolíts el egyet, frissíts egyet), és a jelentés elavultnak jelölődik, és addig nem használható, amíg újra nem futtatod az ellenőrzést.

A modokat a modpack saját fájllistájából azonosítjuk, ahol van ilyen, és egyébként a fájl tartalmából, ugyanúgy, ahogy egy launcher felismeri a jar fájlokat. Kétféle mod esetében nem adható válasz, és egyik sem kerül kitalálásra:

- **Nem sikerült azonosítani**: kézzel készített jar vagy privát build, amelyet egyik nyilvántartás sem ismer fel.
- **Nem sikerült ellenőrizni**: mod a GitHub Releases, Hangar vagy SpigotMC oldalról, vagy olyan, amelynek projektjét eltávolították. Ezek nem tesznek közzé listát arról, hogy melyik Minecraft verzióhoz melyik build tartozik.

Amíg bármelyik telepítve van, a panel egyáltalán nem kínál egy kattintásos Minecraft verzió frissítést, mert nem tudja őszintén megmondani, mi törhetne el. A modok által támogatottnál magasabb verzió alkalmazása megtagadva, és megnevezi a blokkoló modokat.

A **letiltott** modok nem vesznek részt: a szerver nem tölti be őket, így egy mod kikapcsolása valós módja a blokkoló elkerülésének. Egy mod be- vagy kikapcsolása jelöli a jelentést az újbóli ellenőrzéshez.

Ez vonatkozik a modokat futtató szerverekre: Fabric, Forge, NeoForge és Quilt. A Paper-stílusú plugin szerverek megtartják a sima legújabb kiadású viselkedést, és nincs Verziók fülük, mert a pluginok két forrása nem tesz közzé olyan listát, amit egy ellenőrzés el tudna olvasni.

![Egy verzió kibontva, megmutatva, mely modok maradnának le](/docs/images/server-versions-expanded.png)

Egy verzió megnyitása először a hozzá nem tartozó buildekkel rendelkező modokat listázza (ezek határozzák meg a választ), és a készen állókat egy kattintás mögé rejti. A nagy csomagok oldalanként töltik be a modokat, így egy 300 modos szerver ugyanolyan gyorsan nyílik meg, mint egy ötmódos.

## A mod loader verziójának módosítása

A **Verziók** fülön található egy **Loader verzió** kártya is. Megmutatja, hogy a szerver melyik Forge, NeoForge, Fabric vagy Quilt buildet használja, és ahol módosítható, egy választó a másikra váltáshoz.

- **Forge, NeoForge, Fabric vagy Quilt szerver** bármely közzétett buildet futtathat. A választó a szerver Minecraft verziójához tartozó legutóbbi buildeket listázza, a Forge ajánlott és legújabb buildekkel megjelölve. Az **Egyéb build…** bármely régebbi buildet elfogad a számával, a **Gyári** pedig visszaállítja a szerver választását.
- **Forge vagy Fabric CurseForge modpack** a saját manifestuma által deklarált loader verziót telepíti, így a szokásos módja a módosításnak a csomag frissítése. Amikor a csomag maga rossz verziót listáz (egy benne lévő mod újabb Forge-ot kér, mint amit a csomag telepít), a kártya felülírhatja azt, és a **A modpack verziója** eltávolítja a felülírást. A csomag frissítése is eltávolítja, mert az új verzió saját loadert deklarál. Ha az új verzió továbbra is rosszat listáz, állítsd be újra a felülírást.
- **NeoForge CurseForge modpack, vagy Modrinth modpack** megmutatja a loaderét, de nem írható felül: a szerver image csak a Forge és Fabric csomagokra alkalmazza a felülírást. A loader a csomag verzióját követi, ezért frissítsd a csomagot. Az FTB csomag loaderét sem lehet itt módosítani. A kártyája általában nem jelenik meg, mert az FTB saját telepítője olyan nyilvántartásokat vezet, amelyeket a panel nem olvas.

A panel ellenőrzi, hogy a build létezik-e, mielőtt bármit is kérdez. Egy Forge vagy NeoForge build csak egy Minecraft verzióhoz készül, így egy legújabb kiadást követő szerveren egy ilyen rögzítése a szervert is a jelenlegi Minecraft verzióján tartja (a megerősítés ezt mondja). A **Gyári** kiválasztása utána eltávolítja a rögzítést, de megtartja azt a Minecraft verziót. Egy legújabb kiadást követő szerver is átkerülhet egy másik Java image-re, amikor újraépül, amit az a verzió igényel. Egy ilyen, soha el nem indított szervert először el kell indítani, hogy a panel tudja, melyik verzió. A Forge kihagyja a build számokat (nincs 47.4.14 a 47.4.13 és 47.4.15 között), így egy "47.4.14 vagy magasabb" követelményű modot a következő build elégít ki, és a megtagadás megnevezi azt. A változtatás biztonsági mentést készít, majd újraépíti a szervert. Az új build a következő indításkor települ, és a kártya addig ezt jelzi.

## Mod frissítés visszavonása

Minden mod, amelyről egy mod frissül, a megosztott könyvtárban marad, így egy hibás frissítés visszafordítható. A **Modok** fülön lévő mod sorában egy **Visszaállítás** gomb található, amely visszaállítja az előző buildet. Nincs letöltés, így akkor is működik, ha a projektet azóta eltávolították a nyilvántartásból. A build, amelyről visszaállítottál, nem lesz felajánlva, amíg egy újabb nem jelenik meg.

![Mod visszaállítása a frissítés előtti buildre](/docs/images/mods-revert.png)

## Frissítés alkalmazása

A frissítések soha nem néma. Amikor úgy döntesz, hogy frissíted a csomagot (vagy [átváltasz egy másik verzióra](/docs/modpacks/#changing-the-pack-version), akár régebbi verziókra is), a panel:

1. Készít egy **frissítés előtti biztonsági mentést** (így visszafordítható; alapértelmezetten szerverenként az utolsó 10 frissítés előtti biztonsági mentés megmarad, lásd [megtartás](/docs/backups/#retention)).
2. Rögzíti az új verziót.
3. Újraépíti a szervert, szükség esetén újra feloldva a Java futtatókörnyezetet.
4. Figyeli az első indítást, platformonkénti időkerettel.

Ha nem indul el megfelelően, visszaállítod a frissítés előtti biztonsági mentést. Egy stabil verziót követő szerver soha nem kap béta verziót, és a változások naplója linkje a forrás által biztosított valós, verzióspecifikus különbségre mutat. Egy sikertelen frissítés Discord [riasztást](/docs/integrations/) is küld, ha az integráció konfigurálva van.
