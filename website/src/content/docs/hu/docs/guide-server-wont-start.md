---
title: 'A Minecraft szervered nem indul el'
description: 'Egy Minecraft szerver, ami nem indul el, valószínűségi sorrendben javítva: a napló, a Java verzió, a memória, az EULA és a port, valamint a modok.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/guide-server-wont-start.md'
---

[← Vissza a dokumentumokhoz](/docs/)

Haladj végig ezen a listán. A gyakoriság szerint van rendezve, és az első négy lefedi a legtöbb esetet.

## 1. Olvasd el az utolsó húsz sort, ne az elsőt

Görgess a napló (log) **végére**. A Java stack trace befelé haladva, legbelülről kifelé íródik, így a szövegtenger teteje a legkevésbé érdekes rész. Amit keresel, az az utolsó `Caused by:` sor és ami utána következik. Ez az egyetlen sor általában megnevezi a problémát.

Két alakzat jelzi, hol tartasz:

- `Exception in thread "main"` vagy egy összeomlási jelentés (crash report) útvonala a végén azt jelenti, hogy maga a játék hibázott.
- A napló egyszerűen félbeszakad egy sor közepén, mindenféle kivétel (exception) nélkül, ami azt jelenti, hogy valami kívülről állította le a folyamatot. Ugorj a 3. ponthoz.

## 2. UnsupportedClassVersionError a rossz Java-t jelenti

```
java.lang.UnsupportedClassVersionError: net/minecraft/server/Main has been compiled
by a more recent version of the Java Runtime (class file version 65.0)
```

Az 52-es osztályfájl Java 8, a 60-as 16, a 61-es 17, a 65-ös 21, a 69-es 25. Az üzenet azt jelenti, hogy a szervernek újabb Java-ra van szüksége, mint amin fut; a fordítottja, egy régi csomag új Java-n, általában helyette mixin vagy reflexiós hibával hibázik.

| Minecraft verzió     | Java |
| -------------------- | ---- |
| 1.16.5 és korábbi    | 8    |
| 1.17                 | 16   |
| 1.18 és 1.19         | 17   |
| 1.20-tól 1.20.4-ig   | 17   |
| 1.20.5-től 1.21.x-ig | 21   |
| 26.1 és újabb        | 25   |

A régi csomagoknak valóban Java 8 kell. Az újabb nem jobb itt.

## 3. A 137-es kilépési kód a kernel, nem egy mod

A napló félmondatban áll meg, nincs összeomlási jelentés, és a konténer 137-et jelent. Ez egy memóriahiány miatti leállítás (out-of-memory kill): a folyamat olyan memóriát kért, amivel a gép nem rendelkezett, ezért leállították.

Szinte mindig a Java heap mérete megegyezett a gép memóriájával. A heaphez a gép memóriájának **a JVM saját overheadjétől (0,5-1,5 GB egy moddolt szerveren) mínuszolt** értéke szükséges. Csökkentsd a heapet, vagy növeld a gépet. [Mennyi RAM-ra van szüksége egy szervernek](/docs/guide-server-memory/) tartalmazza a számokat.

## 4. Az EULA és a port

Két klasszikus, egy soros javítással:

- `You need to agree to the EULA in order to run the server.` Állítsd be az `eula=true` értéket az `eula.txt`-ben, vagy a környezeti változóban, amit a beállításod használ.
- `Address already in use` vagy `FAILED TO BIND TO PORT`. Valami más foglalta el a 25565-ös portot, gyakran ugyanazon szerver egy korábbi, soha teljesen le nem állított példánya. Keresd meg és állítsd le azt, ahelyett, hogy megváltoztatnád a portot, különben kettő lesz belőle.

## 5. Egy mod hiányolja a függőségét

```
Mod X requires mod Y, which is missing
Fabric API is not installed
```

A Fabric modok túlnyomó többsége külön fájlként igényli a Fabric API-t. A Forge és a NeoForge modok magukban a hibában sorolják fel a függőségeiket. Telepítsd a megnevezett verziót, ne a legújabbat: a "requires 0.91.x" azt jelenti, hogy az a sor, és a 0.92 ugyanazt az ellenőrzést fogja megbuktatni.

Néha a hiányzó függőség maga a betöltő (loader):

```
Mod X requires forge 47.4.14 or above
Mod ID: 'forge', Requested by: 'x', Expected range: '[47.4.14,)', Actual version: '47.4.10'
```

A javítás egy újabb betöltő verzió, nem egy másik mod. A "47.4.14 or above" azt jelenti, hogy bármelyik verzió ettől felfelé, és a Forge nem tesz közzé minden számot, így a telepítendő verzió lehet a következő. Modpack esetén először frissítsd a packot: egy pack, amelynek saját betöltő verziója túl régi a modjaihoz, a szerző hibája.

## 6. Egy mod rossz betöltőhöz vagy verzióhoz való

Egy más betöltőhöz való jar nem hibázik udvariasan. Várj mixin hibát, `NoClassDefFoundError`-t, vagy egy olyan osztályon belüli összeomlást, amiről még sosem hallottál. Ellenőrizd a jar oldalát: mind a betöltőnek, mind a Minecraft verziónak pontosan meg kell egyeznie. A 1.20.1 és az 1.20.4 a modok szempontjából különböző játékok.

## 7. A világ egy újabb verzióból származik

```
This world was created by a newer version of Minecraft
```

A világok előre frissülnek, soha nem visszafelé. Állítsd vissza a biztonsági mentést az frissítés előttiről, vagy futtasd azt a verziót, amit a világ elvár. Nincs olyan visszaminősítési út, amely megőrizné a chunkokat.

## Amikor hetekig tartó futás után összeomlott

Más kérdés, általában más válasz:

- **Terhelés alatt omlott össze**, a time-ok hosszú szüneteket mutatnak: szemétgyűjtés (garbage collection), ezért nézd meg a heap méretét a modok előtt.
- **A világ ugyanazon pontján omlott össze**: egy sérült chunk vagy egy hibás entitás. Az összeomlási jelentés általában megnevezi a koordinátákat.
- **Frissítés után közvetlenül omlott össze**: a frissített mod a gyanúsított, még akkor is, ha a nyomvonal máshova mutat. Vond vissza és nézd meg.
- **Újraindításkor omlott össze, korábban rendben volt**: ellenőrizd a lemezt. A teli lemez látványos és félrevezető hibákat produkál.

## Segítség kérése, ami valóban segít

Tedd közzé a **teljes naplót**, ne csak az utolsó sort, és mondd el, mit változtattál, mielőtt eltört. Másold be egy erre alkalmas helyre, mint például [mclo.gs](https://mclo.gs), ahelyett, hogy csevegésbe tennéd. Tartalmazza a Minecraft verzióját, a betöltőt, a packot és annak verzióját, valamint hogy mennyi heapet kap a szerver. Az a jelentés, amely tartalmazza ezt a négy tényt, egy válaszban megkapja a választ; enélkül ötbe telik.

## A Minecraft Server Manager-ben

Az összeomlásokat a konténer saját kilépéséből érzékeljük, így egy szerver, amelyik hajnali háromkor meghal, a napló kivonatával kerül rögzítésre, ahelyett, hogy másnap találnánk meg. Az ezen az oldalon található szokásos gyanúsítottak (az EULA, a rossz Java, egy újabb verzióból származó világ, egy már foglalt port, a Java memóriahiánya) felismerésre kerülnek ebben a naplóban, és a történeti bejegyzésben megnevezésre kerülnek a teendőkkel együtt, az automatikus újraindítás pedig ezeket figyelmen kívül hagyja, mivel az újraindítás nem fogja őket javítani. Az összeomlási jelentések beérkezéskor feldolgozásra kerülnek: a kivétel kiemelésre kerül, a verem összecsukható, és a nyomvonalban szereplő modok gyanúsítottként vannak felsorolva.

Bármelyik jelentés megosztható a mclo.gs-re a kártyájáról, ha segítségre van szükséged (megerősítés után, mivel a beillesztés nyilvános), és a konzol **Letöltés** menüje az összes naplófájlt egy zip-ben tartalmazza, így a "tedd közzé a teljes naplót" egy letöltés, nem pedig egy régészeti projekt. A memóriahiány miatti leállítás memóriahiány miatti leállításként kerül rögzítésre, ami megspórolja a szokásos egy órát, amit egy mod hibáztatásával töltünk. Ha valami más valóban igényli a portot, a **Beállítások → Konfiguráció** alatt található **Játék Port** kártya áthelyezi a szervert egy szabad portra.

Egy túl régi betöltő a szerver **Verziók** fülén változtatható meg, amely ellenőrzi, hogy a build létezik-e, és biztonsági másolatot készít, mielőtt újraépítené a szervert ([a mod betöltő verziójának megváltoztatása](/docs/updates/#changing-the-mod-loader-version)).

Kapcsolódó: [mennyi RAM-ra van szüksége egy szervernek](/docs/guide-server-memory/), [betöltő kiválasztása](/docs/guide-choosing-a-loader/), [szerverek létrehozása és kezelése](/docs/servers/).
