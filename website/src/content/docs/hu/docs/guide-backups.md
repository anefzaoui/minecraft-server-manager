---
title: 'Minecraft szervermentések, amelyek valóban visszaállíthatók'
description: 'Hogyan készítsünk Minecraft szervermentéseket, amelyek valóban visszaállíthatók: konzisztens másolatok, máshol tárolva, és legalább egyszer tesztelve.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/guide-backups.md'
---

[← Vissza a dokumentumokhoz](/docs/)

A legtöbb szerver rendelkezik biztonsági mentésekkel. Sokkal kevesebbnek vannak működő biztonsági mentései, és a különbséget csak a legrosszabb napon fedezik fel. Három dolog különbözteti meg őket: a másolat konzisztens, máshol van tárolva, és valaki legalább egyszer már visszaállította.

## Másolja le a világot írás közben

Egy futó szerver folyamatosan írja a régiófájlokat. Másolja le őket írás közben, és egy félig régi, félig új fájlt kap, amely vagy nem töltődik be, vagy egy lyukkal a földben töltődik be, ahol valaki bázisa volt. Semmi sem figyelmeztet, mert a másolás sikeres volt.

Két helyes módja van a másolat készítésének:

1.  **Állítsa le a szervert**, másolja le, majd indítsa újra. Egyszerű, becsületes és népszerűtlen a leállás miatt.
2.  **Mondja meg a játéknak, hogy először állítsa le az írást.** Futtassa a `save-off` parancsot, majd a `save-all flush` parancsot, várja meg, amíg befejeződik, másolja le, majd futtassa a `save-on` parancsot. A világ teljes és csendes a másolás időtartama alatt.

Soha ne ugorjon egyenesen a másolásra. Fájlrendszeri vagy kötet szintű pillanatkép csak akkor megfelelő, ha valóban atomi, és egy `cp -r` parancs, miközben a játékosok blokkokat helyeznek el, nem az.

## Többet mentsen, mint a világot

A világ visszaállítása önmagában csak a terepet adja vissza, és elveszíti a szervert. Szüksége van még:

- `server.properties`, és bármi más, ami meghatározza a szabályokat.
- A mod vagy plugin fájlok, a futó verziók pontos másolataiban. Egy világ nem fog betöltődni a modok nélkül, amelyek létrehozták a blokkjait.
- Játékos adatok, beleértve a `whitelist.json`, `ops.json` fájlokat, valamint a statisztikák és az eredmények mappáit.
- A csomag verziója, ha egy csomagból származott. Ennek leírása is számít.

Bármely biztonsági mentés leggyorsabb ellenőrzése: újjá tudná építeni ezt a szervert egy új gépen csak az archívumból? Ha a válaszhoz egy olyan mondatra van szükség, amely így kezdődik: "és akkor újratelepíteném", akkor az nem teljes biztonsági mentés.

## Egy másolat ugyanazon a lemezen nem biztonsági mentés

Egy biztonsági mentés, amely azon a gépen él, amelyet véd, pontosan egy hibát fed le: valamit törölt. Nem fedezi le a lemez meghibásodását, a szolgáltató az account felfüggesztését, vagy egy olyan hibát, amely az egész könyvtárat törli.

Inkább legyen egyszerű, mint tökéletes:

- Egy helyi másolat, a gyakori esetekre, mint például valaki rongálása vagy egy rossz frissítés.
- Egy másolat máshol. Egy másik gép, egy objektumtároló, vagy egy otthoni NAS, amely éjszakánként SSH-n keresztül húzza le az adatokat.
- Elegendő történelem ahhoz, hogy túléljen egy olyan problémát, amelyet nem vett észre azonnal. A sérülést gyakran napokkal később találják meg, és ha három napnyi biztonsági mentést tartasz, már felülírtad a jót.

Hét napi másolat plusz négy heti másolat szinte minden valós esetet lefed, és nagyon kevés helyet foglal.

## Tesztelje a visszaállítást, mielőtt szüksége lenne rá

Válasszon ki egy biztonsági mentést, állítsa vissza egy tartalék szerverre, és csatlakozzon. Ez a teljes teszt, tizenöt percet vesz igénybe, és minden klasszikus hibát észrevesz: az archívum hiányolja a modok mappáját, egy olyan világot, amelyhez olyan verzióra van szüksége, amelyet már nem futtat, engedélyeket, amelyek olvashatatlanná teszik a fájlokat, egy csonka feltöltést.

Tegye meg egyszer, amikor beállítja a biztonsági mentéseket, és még egyszer minden nagyobb szerverváltozás után.

## Méret, és hogyan lehet ésszerűen tartani

A világok azért növekednek, mert a játékosok felfedeznek. Egy olyan világ, ahol valaki tízezer blokkot repült egyenes vonalban, magával viszi az összes csempeket azon a vonalon örökre, és a legtöbb csempe soha többé nem lesz látogatva.

Három kar, a visszaadás mértéke szerint csökkenő sorrendben:

1.  **Vágja ki a nem látogatott csempéket.** Az utoljára érintett idő alapján metsző eszközök általában a jól bejárt világ nagy részét eltávolítják, látható hatás nélkül a játékban.
2.  **Tömörítse megfelelően.** A régiófájlok jól tömöríthetők; az archívumok nem profitálnak semmi egzotikusból.
3.  **Ne tartson meg minden óránkénti másolatot egy évig.** A megtartás felülmúlja a tömörítést.

## A Minecraft Server Managerben

A biztonsági mentések a `save-off`, flush, másolás, `save-on` útvonalat követik, és egy leállítás vagy újraindítás, amelyet a biztonsági mentés közben kérnek, megtagadva, amíg a másolás be nem fejeződik, ahelyett, hogy versenyezne vele. Az archívum lefedi a teljes szerverkönyvtárat, így a modok, a konfiguráció és a játékos adatok együtt utaznak a világgal.

A biztonsági mentések ütemezetten futhatnak újraindítások és parancsok mellett, és minden új szerver napi biztonsági mentési ütemezéssel indul. A megtartás minden típust külön számol, így a tíz ütemezett másolat, amely önmagában felhalmozódik, nem tudja kiszorítani azt, amelyet kézzel vett egy kockázatos változás előtt, és az életkor- és méretkorlátok is érvényesek. A rendszergazdák mindezt a Beállítások oldalon, vagy szerverenként a Biztonsági mentések lapon módosíthatják. A visszaállítás először egy friss biztonsági mentést vesz igénybe, így egy rossz időpontra történő visszaállítás maga is visszavonható. Egy világ zsugorítható önmagában vagy egy biztonsági mentés részeként, ami a méret szempontjából a legfontosabb kar.

A teljes panel, beleértve minden biztonsági mentést, egyetlen könyvtár alatt él. Ennek a könyvtárnak a máshová másolása a gépen kívüli tárolás fele, és ez szándékosan az egyetlen dolog, amit másolnia kell.

Kapcsolódó: [biztonsági mentések a panelen](/docs/backups/), [ütemezések](/docs/schedules/), [világ zsugorítása](/docs/world-shrink/), [szerver áthelyezése másik hosztra](/docs/guide-moving-a-server/).
