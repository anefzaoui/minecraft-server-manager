---
title: 'Szerverek létrehozása és kezelése'
description: 'Hozzon létre, indítson, állítson le, építsen újra és konfiguráljon Minecraft szervereket a panelen: a létrehozási varázsló, a beállítások, a memória és a játékkikötő segítségével.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/servers.md'
---

[← Vissza a dokumentumokhoz](/docs/)

## Szerver létrehozása

Kattints a **Szerver létrehozása** gombra (felső sáv) vagy a **Szerver létrehozása** kártyára a varázsló megnyitásához.

![Szerver létrehozása](/docs/images/create-wizard.png)

A varázsló előre kitölti a Java heap és a lemez kvóta értékeket a Beállítások oldal **Alapértékek új szerverekhez** részéből, amit egy rendszergazda bármikor módosíthat. Az új szerver innen veszi a CPU limitet is.

![Alapértékek új szerverekhez](/docs/images/settings-defaults.png)

Te választod ki:

- A **nevet** (és egy opcionális leírást, ikont és színárnyalatot). A flotta rendszerezéséhez szükséges címkék később, a szerver beállításaiban adhatók hozzá.
- A **szerver típusát**: Vanilla, Paper vagy Purpur a **Vanilla** fülön. Modded szerver esetén a **Modokból** fül kiválasztja a betöltőt (Fabric, Forge, NeoForge vagy Quilt), a Minecraft verziót és egy betöltő buildet (a legújabbat vagy egy specifikust), majd lehetővé teszi a modok keresését.
- A **Minecraft verzióját**: `LATEST`, egy snapshot vagy egy specifikus verzió (béta és alfa verziók is).
- A **játék portját**: egy szabad port kerül javaslatra. A távoli konzol (RCON) alapértelmezetten 1000-rel magasabb portot használ. Később módosíthatod (lásd [Játék port módosítása](#changing-the-game-port)).
- Az **erőforrásokat**: a Java heapet (a konténer memóriakorlátja 50%-kal magasabb lesz ennél) és egy lemez kvótát.

Az **Speciális beállítások** megnyitja az összes többi, a szerver kép által támogatott beállítást, plusz extra környezeti változókat és (rendszergazdák számára) a speciális Docker beállításokat.

Modpack-ot preferálsz? A **Modpackból** fül telepít egy CurseForge, Modrinth vagy GT New Horizons packot helyette (lásd [Modpackok](/docs/modpacks/)), vagy elfogad egy **feltöltött egyedi zip fájlt**: egy Modrinth `.mrpack` fájlt, egy CurseForge modpack exportot (`manifest.json`), vagy bármilyen mod jar fájlokat tartalmazó zipet. A manifest (vagy az azonosított jar fájlok többségi szavazata) kitölti a betöltőt és a Minecraft verziót, és minden mod egy feladatként települ. Elindulhatsz egy mentett [Blueprint](/docs/blueprints/) alapján is a **Blueprintből** fülön.

A panel automatikusan kiválaszt egy ésszerű Java futtatókörnyezetet a verziódhoz, letölti a képet, létrehozza a konténert, és elindítja azt, mindezt egyetlen űrlapon keresztül.

## Szerverek listája

A **Szerverek** oldal listázza a teljes flottádat az állapottal és gyors statisztikákkal.

![Szerverek listája](/docs/images/servers-list.png)

## Egyetlen szerver

![Játékosok](/docs/images/players.png)

Egy szerver megnyitása egy több fülből álló munkaterületet ad:

- **Áttekintés**: az a cím, amit megoszthatsz a játékosokkal, a leírás, az élő használat és a bejelentkezett felhasználók.
- **Konzol**: az élő napló stream és a parancsbevitel, a játékon belüli csevegés és a [csevegési parancsok](/docs/console-and-chat/).
- **Játékosok**: a lista, valamint a leltár és a statisztikák.
- **Modok**: a telepített modok listája, a [mod böngésző](/docs/modpacks/) és a tartalomfrissítések. Modded szerveren a **Verziók** al-füle ellenőrzi, hogy a modjaidnak mely jövőbeli Minecraft verziókhoz vannak buildjei ([frissítések](/docs/updates/#minecraft-version-compatibility)).
- **Világ**: [világok, az élő térkép és a fájlkezelő](/docs/worlds-and-files/).
- **Biztonsági mentések**: [pillanatfelvételek és visszaállítás](/docs/backups/) ehhez a szerverhez.
- **Figyelés**: szerverenkénti előzmények és élő metrikák, beleértve a összeomlási jelentéseket (lásd alább).
- **Beállítások**: **Konfiguráció** (minden a szerver futásával kapcsolatos), plusz az [integrációk](/docs/integrations/) (Discord, Állapotoldal, Meghívók és rendszergazdák számára Chatbot).

Az indítás, leállítás és újraindítás vezérlők minden fül felett a fejlécben találhatók. Amit minden fülön tehetsz, az a [szerverre vonatkozó engedélyeidtől](/docs/users-and-roles/#per-server-permissions) függ; például a **Fájlok** al-fülhöz a Fájlok engedély szükséges, és a konzolparancsok küldéséhez a Konzol engedély.

![Szerver áttekintés](/docs/images/server-overview.png)

A **Világ vezérlők** sáv minden fülön végigfut: a játékon belüli óra, az időjárás, a gyakori gamerules kapcsolókkal, és a "Minden világ szabály megjelenítése" a többihez.

![Világ vezérlők](/docs/images/world-controls.png)

A **Figyelés → Élő** mutatja a TPS-t és a milliszekundumokat per tick, egy egészségügyi és stabilitási kártyát összeomlásokkal (utolsó 24 óra és 7 nap), memóriahiány miatti leölésekkel és automatikus újraindításokkal, valamint világméretű méretekkel.

![Élő figyelés](/docs/images/monitoring-live.png)

## Szerver beállítások

A **Beállítások → Konfiguráció** a teljes konfigurációs felület: név, leírás, MOTD, ikon, szín és címkék, erőforrások, játék port, frissítési szabályzat, indítás panel indításakor és automatikus újraindítás összeomláskor, minden környezeti változó, amit a szerver kép támogat, a speciális Docker beállítások, valamint blueprint export, klónozás, újraépítés és törlés. Azok a változások, amelyek csak a szerver újraépítése után lépnek életbe, azonnal mentésre kerülnek és várnak: egy **Változások alkalmazása** gomb jelenik meg a szerver fejlécében, és a következő indításkor is alkalmazásra kerülnek.

Az **Összeomláskor automatikus újraindítás** újraindítja az összeomlott szervert, egyre hosszabb várakozási idővel minden próbálkozás között (5, 10, majd 20 másodperc), és 10 percen belül 3 próbálkozás után leáll. Kihagyja azokat az összeomlásokat, amelyeket a panel beállítási problémaként ismer fel (az EULA, a rossz Java, egy újabb verzióból származó világ, egy foglalt port, memóriahiány, hiányzó CurseForge kulcs), mert azoknak először javításra van szükségük. Ha egy másik művelet elfoglalt a szerverrel (biztonsági mentés, visszaállítás, port módosítás), legfeljebb 30 percig vár, és amint valaki leállítja vagy elindítja a szervert, feladja.

A közvetlen beállítási változások mindig megmaradnak az újraindítások során. A **Világ vezérlők** sávval végzett PvP vagy nehézségi változtatás, a **Játékosok** fülön végzett fehérlista kapcsoló, vagy a **Fájlok** szerkesztőben végzett `server.properties` szerkesztés eltávolítja a megfelelő környezeti változót (ha volt beállítva) és megjelöli a szervert újraépítésre, így a lemezen lévő érték érvényesül ahelyett, hogy a konténer kép újra érvényesítené azt a következő indításkor.

![Szerver beállítások](/docs/images/server-settings.png)

**A memóriaszámlálóról.** A "RAM (Java heap)" mind a kiinduló, mind a maximális heapként kerül átadásra a Java számára, és a Java egy percen belül feltölti a neki adott heapet, az Aikar / MeowIce flag előbeállításokkal vagy anélkül. Tehát a memóriaszámláló a heap méretéhez közel áll be, és ott is marad, még akkor is, ha senki sem játszik; a számlálón lévő jelzés azt mutatja, hol van a heap a konténer korlátja alatt, és az alatta lévő megjegyzés ezt mondja. Ha inkább azt szeretnéd látni, hogy a memória követi a valós használatot, adj a szervernek kisebb kiinduló heapet a **Kezdő heap** beállításnál az Erőforrások kártyán a **Beállítások → Konfiguráció** alatt (vagy a varázsló **Speciális beállítások** részében), például 512 MB: egy 2 GB-os heapen ez csökkentette az üresjárati használatot 2,6 GB-ról kb. 1,3 GB-ra a méréseink szerint. A Java-nak a heapen kívül is szüksége van memóriára (kb. 0,5 GB vanilla esetén, 1,5-2 GB egy nagy modpack esetén), amire a konténer korlátjának tartaléka szolgál. Lásd a README "Két memóriakorlát" részét a számokért.

> A **Speciális Docker beállítások** (konténer név, Docker hálózat, extra port hozzárendelések és extra kötet kötés) **csak rendszergazdák számára** érhetők el, mert egy kötés és a panel Docker hozzáférése lényegében root hozzáférést jelent a gazdagépen. Lásd [Felhasználók és szerepkörök](/docs/users-and-roles/).

### Játék port módosítása

A **Beállítások → Konfiguráció** **Játék port** kártyája bármikor áthelyez egy szervert egy másik portra, saját **Port mentése** gombjával. A **Következő szabad port használata** a legkisebb szabad portot választja ki, és a kártya ellenőrzi az általad megadott portot, mielőtt elmentenéd. Az RCON mindig 1000-rel a játék portja felett követi (az alapértelmezett eltolás). A rendszergazdák bármilyen 1024-től felfelé eső portot választhatnak; mindenki más az első játék porttól (alapértelmezetten 25565) felfelé választhat. A mentés azonnal alkalmazza a változást: egy leállított szerver csak áthelyeződik, egy futó pedig először kérdez, majd újraindul az új porton (a világ mentésre kerül, és a játékosok újracsatlakoznak az új porton). Ha a szerver nem tud elindulni az új porton, visszatér a régihez. A változás megtagadása, amíg más változások várnak az **Alkalmaz Változások** gombra, ezért először azokat kell alkalmazni. A port módosításához a szerverre vonatkozó Beállítások engedély szükséges.

![A Játék Port kártya](/docs/images/server-port.png)

![A prompt futó szerver újraindítása előtt az új portján](/docs/images/port-restart.png)

## Összeomlási jelentések és mclo.gs elemzés

Az összeomlási jelentéseket (`crash-reports/*.txt` és JVM `hs_err_pid*.log` fájlok) automatikusan összegyűjtjük, egy soros összefoglalóba elemezzük a kivétellel és a gyanított modokkal, és a **Figyelés → Előzmények** alatt listázzuk:

![Összeomlási jelentés kártya](/docs/images/crash-mclogs-card.png)

Minden jelentés kártya kínál egy beépített nézőt (összecsukható szakaszokkal és kiemelt kivételekkel), másolható stack trace-t és letöltést, valamint két [mclo.gs](https://mclo.gs) műveletet:

- **Megosztás a mclo.gs-re** közzéteszi a jelentést nyilvános pasztaként, és kimásolja a linket: pontosan azt, amit a mod szerzők és a támogatási Discordok kérnek. A link megmarad a jelentésen, így semmi sem kerül kétszer feltöltésre.
- Az **Elemzés** futtatja a mclo.gs automatizált betekintéseit a pasztán: ismert problémák javasolt javításokkal (hiányzó függőségek, verzió eltérések, gyakori mod konfliktusok), közvetlenül a panelen megjelenítve.

![mclo.gs betekintések](/docs/images/crash-insights.png)

Mindkét művelet explicit megerősítés mögött áll, mert egy paszta nyilvános: az összeomlási jelentések tartalmazhatnak játékosneveket és a teljes modlistádat. A panel soha nem tölt fel semmit önállóan.
