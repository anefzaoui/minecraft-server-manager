---
title: 'Szerverek létrehozása és kezelése'
description: 'Kattintson a "Szerver létrehozása" gombra (felső sáv) vagy a "Szerver létrehozása" kártyára a varázsló megnyitásához.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/servers.md'
---

[← Vissza a dokumentumokhoz](/docs/)

## Szerver létrehozása

Kattints a **Szerver létrehozása** gombra (felső sáv) vagy a **Szerver létrehozása** kártyára a varázsló megnyitásához.

![Szerver létrehozása](/docs/images/create-wizard.png)

A varázsló előre kitölti a memória, CPU és lemez kvóta mezőket a Beállítások oldal **Alapértékek új szerverekhez** részéből, amit egy rendszergazda bármikor módosíthat.

![Alapértékek új szerverekhez](/docs/images/settings-defaults.png)

Válaszd ki:

- A **nevet** (és opcionális ikont, színkombinációt és címkéket a szerverflotta rendszerezéséhez).
- A **szerver típusát** - vanilla, Paper, Fabric, Forge, NeoForge és még sok más, mindegyik a megfelelő itzg képhez van hozzárendelve a háttérben.
- A **Minecraft verzióját** - `LATEST`, egy snapshot, vagy egy konkrét verzió.
- Az **erőforrásokat** - RAM (heap), konténer memória limit, CPU és lemez kvóta.

Modpackot szeretnél? A **Modpackból** fül telepít egy CurseForge, Modrinth, FTB vagy GT New Horizons csomagot helyette (lásd: [Modpackok](/docs/modpacks/)), vagy elfogad egy **feltöltött egyéni zip fájlt**: egy CurseForge modpack export (`manifest.json`) vagy bármilyen mod jar fájlokat tartalmazó zip. A manifest (vagy a beazonosított jar fájlok többségi szavazata) határozza meg a betöltőt és a Minecraft verzióját, és minden mod egy feladatban települ. Elindulhatsz egy mentett [Blueprint](/docs/blueprints/) alapján is.

A panel automatikusan kiválaszt egy ésszerű Java futtatókörnyezetet a verziódhoz, lehúzza a képet, létrehozza a konténert, és (opcionálisan) elindítja azt, mindezt egyetlen űrlapon.

## A szerverek listája

A **Szerverek** oldal felsorolja a teljes szerverflottádat az állapotukkal és gyors statisztikákkal.

![Szerverek listája](/docs/images/servers-list.png)

## Egyetlen szerver

![Játékosok](/docs/images/players.png)

Egy szerver megnyitása egy tab-os munkaterületet ad:

- **Áttekintés** - állapot, élő statisztikák, üzemidő, és az elsődleges indítás / leállítás / újraindítás vezérlők.
- **Konzol** - az élő napló stream és parancsbevitel, valamint a játékon belüli csevegés ([részletek](/docs/console-and-chat/)).
- **Játékosok** - kik vannak online, valamint leltár, statisztikák és [csevegési parancsok](/docs/console-and-chat/).
- **Modok** - a telepített modok listája, a [mod böngésző](/docs/modpacks/), és a tartalomfrissítések.
- **Világ** - [világok, az élő térkép és a fájlkezelő](/docs/worlds-and-files/).
- **Biztonsági mentések** - [pillanatfelvételek és visszaállítás](/docs/backups/) ehhez a szerverhez.
- **Figyelés** - szerverenkénti előzmények és élő metrikák, beleértve a összeomlási jelentéseket (lásd alább).
- **Beállítások** - minden a szerver futtatásával kapcsolatban, valamint az [integrációk](/docs/integrations/) (Discord, állapotoldal, meghívók, chatbot).

![Szerver áttekintés](/docs/images/server-overview.png)

A **Világ vezérlők** sáv minden lapon végigfut: a játékon belüli óra, időjárás, a gyakori gamerules kapcsolókkal, és a "Minden világ szabály megjelenítése" a többihez.

![Világ vezérlők](/docs/images/world-controls.png)

A **Figyelés → Élő** mutatja a TPS-t és a milliszekundumokat tickenként, egy egészségügyi és stabilitási kártyát az elmúlt 24 óra / 7 nap összeomlásaival és újraindításaival, valamint világonkénti méreteket.

![Élő figyelés](/docs/images/monitoring-live.png)

## Szerver beállítások

A **Beállítások** fül a teljes konfigurációs felület: átnevezés, erőforrások, frissítési szabályzat, automatikus indítás / automatikus újraindítás, környezeti változók és speciális Docker felülbírálások. Azok a mezők, amelyek megváltoztatják a konténer futtatását, egyértelműen meg vannak jelölve, hogy újraindítást igényelnek.

![Szerver beállítások](/docs/images/server-settings.png)

**A memória mérőről.** A "RAM (Java heap)" a Java számára mind a kezdő, mind a maximális heapként kerül átadásra, és a Java az első percben feltölti a neki előre adott heapet, akár az Aikar / MeowIce zászló előbeállításokkal, akár anélkül. Tehát a memória mérő a heap méretéhez közelít és ott marad, még akkor is, ha senki sem játszik; a mérőn lévő jelzés azt mutatja, hol helyezkedik el a heap a konténer limit alatt, és az alatta lévő megjegyzés ezt mondja el. Ha inkább azt szeretnéd látni, hogy a memória követi a valós használatot, állíts be egy kisebb **Kezdő heap** (speciális) értéket: egy 2 GB-os heapen ez csökkentette az üresjárati használatot 2,6 GB-ról körülbelül 1,3 GB-ra a méréseink szerint. A Java-nak a heapen kívül is szüksége van memóriára (körülbelül 0,5 GB vanilla esetén, 1,5-2 GB egy nagy modpack esetén), amire a konténer limit fejrészét szánták. Lásd a README "Két memória limit" részét a számokért.

> A speciális Docker felülbíráló mezők (egyéni konténer név, extra port és bind mountok, valamint nyers felülbírálások) **csak rendszergazdák számára** érhetők el, mert egy bind mount a panel Docker hozzáférésével együtt lényegében root hozzáférést jelent a gazdagépen. Lásd: [Felhasználók és szerepkörök](/docs/users-and-roles/).

## Összeomlási jelentések és mclo.gs elemzés

Az összeomlási jelentéseket (`crash-reports/*.txt` és JVM `hs_err_pid*.log` fájlok) automatikusan összegyűjtjük, egy soros összefoglalóba elemezzük a kivétellel és a gyanított modokkal, és a **Figyelés → Előzmények** alatt listázzuk:

![Összeomlási jelentés kártya](/docs/images/crash-mclogs-card.png)

Minden jelentés kártya beépített nézőt (összecsukható szakaszokkal és kiemelt kivételekkel), másolható stack trace-t és letöltést kínál, valamint két [mclo.gs](https://mclo.gs) műveletet:

- **Megosztás a mclo.gs-re** közzéteszi a jelentést nyilvános pasztaként, és kimásolja a linket - pontosan azt, amit a mod szerzők és a támogatási Discordok kérnek. A link megmarad a jelentésen, így semmi sem kerül kétszer feltöltésre.
- **Elemzés** futtatja a mclo.gs automatizált betekintéseit a pasztán: ismert problémák javasolt javításokkal (hiányzó függőségek, verzió eltérések, gyakori mod ütközések), közvetlenül a panelen megjelenítve.

![mclo.gs betekintések](/docs/images/crash-insights.png)

Mindkét művelet egy explicit megerősítés mögött áll, mert egy paszta nyilvános: az összeomlási jelentések tartalmazhatnak játékosneveket és a teljes modlistádat. A panel soha nem tölt fel semmit önállóan.
