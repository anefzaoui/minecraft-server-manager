---
title: 'Minecraft szerver áthelyezése másik tárhelyre'
description: 'Egy világ áthelyezése egyszerű. Az a szerver áthelyezése, amelyre a játékosok továbbra is be tudnak jelentkezni, leltáraikkal, otthonaikkal és engedélyeikkel együtt, az, ami általában elromlik.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/guide-moving-a-server.md'
---

[← Vissza a dokumentumokhoz](/docs/)

Egy világ áthelyezése egyszerű. Egy szerver áthelyezése úgy, hogy a játékosok továbbra is be tudjanak jelentkezni, a leltáraikkal, otthonaikkal és engedélyeikkel együtt, az az a rész, ami elromlik. Az alábbi sorrend néhány percre csökkenti az állásidőt, és lehetőséget biztosít a visszatérésre, ha az új gép csalódást okozna.

## Először mérd fel a helyzetet

Jegyezd fel ezeket, mielőtt bármihez hozzáérsz. Mindegyik rosszul végződött már migráció során, amikor feltételezték, ahelyett, hogy ellenőrizték volna:

- **Minecraft verzió és betöltő**, pontosan. Az 1.20.1 NeoForge nem ugyanaz, mint az 1.20.1 Forge.
- **Modok vagy pluginok listája a verziókkal.** A világ nem fog betöltődni a készítő modok nélkül.
- **Java verzió**, ami követi a Minecraft verzióját.
- **`level-name`** a `server.properties` fájlból. A világmappa gyakran nem `world` nevű.
- **Online mód.** Ha a régi szerver `online-mode=false` beállítással futott, és az új pedig bekapcsolva, vagy fordítva, minden játékos más UUID-t kap, és ezért egy teljesen új, üres leltárt. Ez a legfájdalmasabb hiba ezen az oldalon.
- **Bármi, ami a szerver mappáján kívül él**, például egy plugin MySQL adatbázisa.

## Másold futás közben, majd másold le újra leállítva

A rövid állásidő trükkje az, hogy először a lassú másolást végezzük el.

1. **A szerver futása közben** másold át a teljes szerverkönyvtárat az új gépre. Egy nagy világ esetén ez egy órát is igénybe vehet; senki sem veszi észre, mert semmi sem állt meg.
2. **Jelents be egy újraindítást, majd állítsd le a szervert rendesen.** A szép leállítás miatt a játék kiírja a világot; a folyamat megölése nem teszi ezt meg.
3. **Másold le újra.** Ezúttal csak a megváltozott fájlok mozognak, így ez másodpercekig vagy percekig tart.
4. **Indítsd el az új gépen**, ha tudod, egy nem nyilvános porton, és csatlakozz hozzá magad. Ellenőrizz egy ismert bázist, a saját leltáradat, és hogy a pluginok vagy modok hiba nélkül betöltődtek-e.
5. **Aztán** irányítsd a játékosokat felé.

Az `rsync -a --delete` az 1. és 3. lépés szokásos eszköze. Tartsd meg az engedélyeket és az időbélyegeket: a rossz felhasználóként másolt világ egy olyan szerver, amely nem indul el, és a hiba nem fogja ezt egyértelműen jelezni.

## Ne töröld le még a régit

Tartsd meg a régi gépet, leállítva, de érintetlenül, legalább néhány napig. Ez az egyetlen igazi visszagörgetés. Tartsd kikapcsolva, ahelyett, hogy futtatnád, így senki sem csatlakozik véletlenül az elhagyott másolathoz, és nem épít ott egy hétig.

## Tedd tartóssá a címet az áthelyezés során

Ha a játékosok egy sima IP-címre csatlakoznak, minden áthelyezés arra kényszeríti a játékosokat, hogy szerkesszék a szerverlistájukat, és néhányan soha nem teszik meg.

Használj egy általad irányított hosztnevet, ami a szerverre mutat. Az áthelyezés ekkor egy DNS-módosítássá válik, és a mindenki kliensében lévő cím változatlan marad. Csökkentsd a rekord idő-élettartamát (TTL) egy nappal az áthelyezés előtt, hogy a változás gyorsan terjedjen.

Ha azt szeretnéd, hogy a játékosok egy sima domainnevet írjanak be, miközben a szerver egy nem szabványos porton fut, egy SRV rekord ezt lehetővé teszi. Ez ugyanaz a mechanizmus, amit a kereskedelmi hosztok használnak a `play.something.net` megadására.

## Ellenőrizd az új gépet, mielőtt megbízol benne

Három dolog, ami eltér a hosztok között, és az áthelyezés után gondot okoz:

- **A tűzfal.** A játék portodnak nyitva kell lennie, és csak a játék portodnak. Ne tedd elérhetővé a menedzsment panelt vagy egy térképet az interneten csak azért, mert helyileg működött.
- **Egyetlen mag sebessége.** A Minecraft sokkal jobban törődik azzal, hogy egy mag milyen gyors, mint azzal, hogy mennyi van belőle. Nyolc lassú mag rosszabbul fog teljesíteni, mint kettő gyors.
- **Lemez.** Egy forgó tárolón vagy egy erősen megosztott kötetön lévő világ akadozni fog a chunkok betöltése során.

## Elhagyva egy felügyelt panelt

Ha egy olyan hosztról érkezel, amely egy vezérlőpanelt adott neked egy gép helyett, keresd meg a letöltést vagy a fájlkezelőt, és vidd el a teljes szerverkönyvtárat a világ helyett. Szerezd meg magukat a plugin és mod jar fájlokat, nem egy listát: a verziók számítanak, és a "legújabb" jövő hónapban más fájl lesz.

Ellenőrizd, hogy a biztonsági mentéseid is a tieid-e. Egy biztonsági mentés, amely csak az általad elhagyott panelen létezik, nem egy olyan biztonsági mentés, amely a tiéd.

## A Minecraft Server Managerben

A teljes panel egy könyvtár. Ha ezt egy másik gépre másolod, és ott indítod el a panelt, az magával hozza az összes szervert, világot, biztonsági mentést és beállítást, ami magának a panelnek az áthelyezését másolássá, nem pedig migrációvá teszi.

Egy szerverhez, nem az összeshez, egy blueprint rögzíti a konfigurációját, a modkészletét és a rögzített csomag verzióját (és ha bejelölöd, az aktív világot) egyetlen `.mcserver.zip` fájlba, amelyet egy másik panelen importálhatsz az azonos szerver újjáépítéséhez. A világok külön letölthetők és telepíthetők, ha csak a világot kell áthelyezni.

Ha a szerver által használt játékkikötő már foglalt az új gépen, vagy először egy nem nyilvános porton szeretnél tesztelni, változtasd meg a **Beállítások → Konfiguráció** menüben: a **Játékkikötő** kártyán van a **Következő szabad kikötő használata**, egy futó szerver kérés előtt újraindul az új porton, és ha nem tud ott elindulni, visszatér a régihez. Váltsa át a nyilvános portra, amikor a játékosokat felé irányítod.

Kapcsolódó: [blueprintok](/docs/blueprints/), [biztonsági mentések, amelyek valóban visszaállíthatók](/docs/guide-backups/), [világok és fájlok](/docs/worlds-and-files/).
