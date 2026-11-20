---
title: 'Mennyi RAM-ra van szüksége egy Minecraft szervernek?'
description: 'Mennyi RAM-ra van szüksége egy Minecraft szervernek a vanilla, Paper, könnyű modok és nagy modpackok esetén, és mennyi maradjon a gépnek.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/guide-server-memory.md'
---

[← Vissza a dokumentumokhoz](/docs/)

Rövid válasz, egy szerverhez, amin játszani is fognak:

| Amit futtatsz                             | Java heap | A gépnek adj |
| ----------------------------------------- | --------- | ------------ |
| Vanilla vagy Paper, max. 10 játékos       | 2 GB      | 4 GB         |
| Paper modokkal, 10-30 játékos             | 4 GB      | 6 GB         |
| Könnyű modpack, 40-80 mod                 | 4 GB      | 6 GB         |
| Nagy "kitchen-sink" pack, 150-300 mod     | 6-8 GB    | 10 GB        |
| GregTech New Horizons és hasonló szörnyek | 8-12 GB   | 16 GB        |

Két szám, nem egy. Ez az a rész, amit a legtöbb útmutató kihagy, és ez az oka annak, hogy az emberek vesznek egy 4 GB-os szervert, adnak a Javának 4 GB-ot, majd nézik, ahogy az meghal.

## A heap és a gép különböző számok

A Java heap (`-Xmx`) az a memória, amit a játék maga használhat a világ, entitások és mod adatok számára. A gépnek, vagy a konténernek, ezt a heap-et **plusz** minden mást is tárolnia kell, amire a Javának szüksége van: osztály metaadatok, szálvermek, szemétgyűjtő könyvelés, hálózati pufferek és maga a JVM. Ez a többlet nagyjából 0,5-1,5 GB egy moddolt szerver esetében.

Ha a heap megegyezik a gép memóriájával, a kernel azonnal megöli a szervert, amint a Java megpróbálja elérni ezt a többletet. Dockerben ez 137-es kilépési kóddal jelenik meg, a logokban pedig semmivel sem: a folyamat egyszerűen eltűnik félmondat közben. Az emberek általában egy modot hibáztatnak.

Biztonságos szabály: **heap plusz 25 százalék, és legalább 1 GB szabad hely.** Egy 8 GB-os heaphez 10 GB-os gép kell.

## Több RAM nem több teljesítmény

A Minecraft a legtöbb esetben egyetlen szálhoz kötött. Egy 40 modos packnak 16 GB-ot adni nem teszi gyorsabbá a chunkok generálását; minden szemétgyűjtési szünetet hosszabbá tesz, mert több mindent kell bejárni. Egy szerver, ami harminc másodpercenként akadozik, gyakran túl sok heap-pel rendelkezik, nem túl kevésel.

Csak akkor növeld a heap méretét, ha ezeket látod, és nem máskor:

- `java.lang.OutOfMemoryError: Java heap space` a logban.
- Ismétlődő "Can't keep up! Is the server overloaded?" a timerekben szemétgyűjtési szünetekkel.
- A memóriahasználat felkúszik a plafonra, és órákig ott marad.

## Miért mutat a szervered 12 GB foglaltat, miközben senki sincs online

Mert te mondtad neki. Két alapértelmezés összeesküszik:

1. A gyakori Docker kép beállítja a kezdő heap-et egyenlővé a maximummal, így az `-Xms` és az `-Xmx` is a te számod. A Java ezt azonnal lefoglalja, ahelyett, hogy növekedne.
2. A népszerű Aikar flag szett tartalmazza a `-XX:+AlwaysPreTouch` opciót, ami minden lapot bejár a heap-ből induláskor, hogy a lapok valóban le legyenek foglalva. Ez szándékos: lassabb indulást és magas üresjárati értéket cserél kevesebb későbbi szünetre.

Mérve Paper 1.21.1-en 2 GB heap-pel egy 4 GB-os konténerben, három percig mintavételezve a világ betöltődése után:

| Konfiguráció                            | Rezidens memória |
| --------------------------------------- | ---------------- |
| Nincsenek flag-ek                       | 2.60 GiB         |
| Aikar flag-ek                           | 2.59 GiB         |
| Aikar flag-ek `AlwaysPreTouch` nélkül   | 1.95 GiB         |
| Aikar flag-ek 512 MB kezdő heap-pel     | 1.38 GiB         |
| Nincsenek flag-ek 512 MB kezdő heap-pel | 1.25 GiB         |

Tehát egy szerver, ami üresjáratban "12 GB"-ot használ, általában egy 12 GB-os heap, amit előre érintettek, nem pedig egy memória szivárgás. A monitorozásod helyesen olvassa le; a szám csak nem azt jelenti, amit látszik.

Ha őszinte üresjárati értéket szeretnél, állítsd a kezdő heap-et alacsonyabbra, mint a maximumot. Ezt néhány további gyűjtéssel fizeted meg korábban. Ha inkább egyenletes képkockaidőt szeretnél, hagyd figyelmen kívül, és ne nézd a grafikonokat.

## A játékosok kevesebbet számítanak, mint gondolnád

A 10-ről 20 játékosra való duplázás sokkal kevesebbe kerül, mint ötven mod hozzáadása. A játékosok főként entitásokat és betöltött chunkokat adnak hozzá, amelyek lassan skálázódnak. A modok osztályadatokat, nyilvántartásokat, világgenerálási funkciókat és saját gyorsítótárakat adnak hozzá, amelyek nem. Méretezés először a pack alapján, majd adj hozzá nagyjából 100-200 MB-ot játékosonként egy moddolt szerveren.

A nézet távolsága a másik nagy tényező. A 12-ről 8 chunkra való csökkentés egy gigabájtot takaríthat meg egy forgalmas szerveren, és alig észrevehető a játékban.

## A Minecraft Server Managerben

Minden szervernek két külön mezője van: **Java heap** és **konténer memória limit**, pontosan azért, mert ezek különböző kérdések. Az alkotó varázsló a konténer limitet 50%-kal a heap fölé állítja neked, és a panel nem engedi menteni a szervert, amelynek konténer limitje nincs a heap fölött, mert ez a kombináció 137-es kilépési kóddal végződik, nem pedig hibaüzenettel.

A szerveren lévő memóriamérő azt mutatja, amit a konténer valójában használ, egy megjegyzéssel, ha a heap előre lett foglalva, így egy előre érintett heap nem tűnik elszabadultnak. Egy olyan szerver, amit a kernel memóriahiány miatt ölt meg, pontosan így van rögzítve a történetben, nem pedig rejtélyes összeomlásként.

Kapcsolódó: [szerverek létrehozása és kezelése](/docs/servers/),
[összeomlási jelentések](/docs/servers/#crash-reports--mclogs-analysis), [tárhely és kvóták](/docs/storage/).
