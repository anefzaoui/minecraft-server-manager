---
title: 'Vanilla, Paper, Fabric, Forge, NeoForge, Quilt: melyiket?'
description: 'Vanilla, Paper, Fabric, Forge, NeoForge vagy Quilt: melyik Minecraft szervertípus fusson, attól függően, mit telepítenek a játékosok.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/guide-choosing-a-loader.md'
---

[← Vissza a dokumentumokhoz](/docs/)

Válassz aszerint, hogy mit szeretnél, hogy a játékosok telepítsenek, ne aszerint, hogy mi hangzik a leggyorsabbnak.

| Mit szeretnél                                             | Ezt futtasd          | A játékosok telepítsék |
| --------------------------------------------------------- | -------------------- | ---------------------- |
| Túlélő mód barátokkal, semmi rendhagyó                    | Vanilla              | Semmit                 |
| Nyilvános szerver rangokkal, területekkel és moderációval | Paper                | Semmit                 |
| Egy specifikus modpack a CurseForge-ról vagy Modrinth-ról | Amit mondanak        | A pack                 |
| Egy saját magad által épített modern modpack              | Fabric vagy NeoForge | Ugyanazokat a modokat  |
| Egy régi pack az 1.7-től 1.12-es korszaktól               | Forge                | Ugyanazokat a modokat  |

Ez a legtöbb ember számára a teljes döntés. Az oldal többi része pedig az okokat magyarázza.

## A pluginok és a modok nem ugyanazok

Ez az a különbség, amire minden más épül.

**Pluginok** csak a szerveren futnak. A Paper, Spigot és Bukkit tölti be őket. A játékosok egy szokásos,
módosítatlan klienssel csatlakoznak, és soha nem is tudnak róla. Minden, ami alapvetően a szabályokról,
engedélyekről, gazdaságokról, területekről, minijátékokról vagy moderációról szól, az egy plugin, és
ez az oka annak, hogy szinte minden nyilvános szerver Paper-t futtat.

**Modok** magát a játékot változtatják meg: új blokkok, új dimenziók, új gépek. A kliensnek ugyanazokat
a modokat kell betöltenie, mint a szervernek, különben nem tudja értelmezni, amit a szerver mond neki.
Bárki, aki egy modolt szerverhez csatlakozik, először telepíti a packot.

Egy szerver nem lehet értelmesen mindkettő. Léteznek hibrid projektek, amelyek egy mod betöltőre
csatolnak egy plugin API-t, és ezek működnek, amíg nem működnek, általában a legrosszabb pillanatban.
Ha mindkettőre szükséged van, futtass egy proxy-t egy modolt szerverrel és egy plugin szerverrel mögötte,
ahelyett, hogy egy hibridet használnál.

## A plugin oldal

**Paper** az alapértelmezett válasz. A Spigot egy forkja, rengeteg éves teljesítményoptimalizálással és
egy konfigurációs fájllal szinte minden olyan viselkedéshez, ami valaha is idegesített egy rendszergazdát.
A Bukkit korszakból származó Vanilla pluginok nagyrészt még mindig működnek.

**Purpur** a Paper egy forkja, még több kapcsolóval, beleértve a játékmeneti kapcsolókat is. Válaszd ezt,
ha ezeket a specifikus kapcsolókat szeretnéd; egyébként a Paper-t.

**Vanilla** akkor érdemes futtatni, ha a lényeg a változatlan játék. Sok játékossal lassabb, és nincs
engedélyrendszere, így a moderáció kézi.

A Paper alapértelmezetten megváltoztat néhány vanilla viselkedést a teljesítmény érdekében. Ha egy
redstone szerkezet egy videóból nem működik a szerveren, az általában ennek az oka, és általában egy
beállítás.

## A mod oldal

**Fabric** kicsi, napokon belül frissül egy új Minecraft verzióra, és a legtöbb modern teljesítményt
javító modot tartalmazza. Szinte minden Fabric mod igényli a Fabric API-t is, ami egy külön letöltés.
Ha a célod egy gyors szerver kevés minőség-javító moddal, akkor ez a megfelelő.

**NeoForge** az a hely, ahol a régi Forge ökoszisztéma most dolgozik az aktuális verziókhoz. Szétvált a
Forge-tól a 1.20.1 során, és a legtöbb nagy pack, amit 1.20.2-re és későbbre építettek, ezt célozza.
Ha ma egy új, nagyteljesítményű packot indítasz, akkor ez a megfelelő.

**Forge** még mindig a múltat birtokolja. Minden az 1.7.10, 1.12.2 és 1.16.5 korszakból, ami rengeteg
szeretett packot jelent, Forge, és mindig is az lesz. Tartsd meg ezekhez.

**Quilt** a Fabric egy forkja, ami a legtöbb Fabric modot futtatja. Jó okai vannak a létezésének, de ha
nincs konkrét okod a választására, válaszd a Fabric-ot.

Az egyik betöltőhöz készült modok nem futnak a másikon. Egy mod oldal, ami azt mondja, hogy Fabric, azt
jelenti, hogy Fabric.

## Ha egy packot telepítesz, a pack dönt

Ne te választasz. A pack felsorolja a betöltőjét és a pontos Minecraft verzióját, és mindkettőnek
egyeznie kell.
Az "elég közel" itt nem létezik: egy 1.20.1-es pack nem fut 1.20.4-en, és egy 1.20.1-es NeoForge
pack nem fut 1.20.1-es Forge-on.

Telepítsd a packot az ID-ja vagy linkje alapján, ahelyett, hogy kézzel válogatnád a modokat, és rögzítsd
a verziót. A packok frissülnek, és egy frissítés, ami a szezon közepén érkezik alád, az a módja,
hogy a világok megsérüljenek.

## Melyik Java verzió

A Minecraft követelményei a játékkal együtt mozognak, és a rossz verzió futtatása egy nem segítő
`UnsupportedClassVersionError` üzenetet eredményez egyértelmű üzenet helyett.

| Minecraft verzió     | Java |
| -------------------- | ---- |
| 1.16.5 és korábbi    | 8    |
| 1.17                 | 16   |
| 1.18 és 1.19         | 17   |
| 1.20-tól 1.20.4-ig   | 17   |
| 1.20.5-től 1.21.x-ig | 21   |
| 26.1 és későbbi      | 25   |

A régi packok valóban Java 8-at igényelnek; ez az egyik azon kevés helyek egyike a szoftverekben, ahol
a legújabb verzió a rossz.

## A Minecraft Server Manager-ben

Az alkotó varázsló megkérdezi, hogy mit szeretnél futtatni, és kiválasztja a Java verziót a fenti
táblázatból, így a nem egyezés soha nem történik meg véletlenül. A Vanilla, Paper és Purpur a
**Vanilla** fülön található; a **From Mods** fül fogadja a Fabric, Forge, NeoForge vagy Quilt
verziókat, a Minecraft verziójával és egy betöltő build-del (a legújabb, vagy egy általad rögzített).
Egy pack telepítése a CurseForge-ról, Modrinth-ról vagy a GT New Horizons-ról egy pontos verzióra
rögzíti azt. Az upgrade csak akkor történik meg, amikor alkalmazod (vagy a napi ellenőrzés után, ha
a szerver frissítési szabályzata **Auto-Update**), mindig készít egy biztonsági másolatot először,
és visszaállítható.

A mod böngésző tudja, hogy egy szerver melyik betöltőt futtatja, és ennek megfelelően szűri a
kínálatot, így egy Fabric jar nem kerülhet véletlenül egy NeoForge szerverre.

Kapcsolódó: [szerverek létrehozása és kezelése](/docs/servers/), [modpackok](/docs/modpacks/),
[mennyi RAM-ra van szüksége egy szervernek](/docs/guide-server-memory/).
