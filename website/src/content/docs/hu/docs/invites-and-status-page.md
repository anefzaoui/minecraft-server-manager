---
title: 'Meghívók és állapotoldal'
description: 'Hívj meg barátokat egy szerverre a címmel, verzióval és egy kliens modpackkal, és ossz meg egy nyilvános állapotoldalt, amely csak azt mutatja, amit te választasz.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/invites-and-status-page.md'
---

[← Vissza az indexhez](/docs/)

Egy szerver **Beállítások** csoportján belüli két lap segíti a játékosokat annak megtalálásában és csatlakozásában: az **Meghívók** minden olyan információt kiír, amire egy barátnak szüksége van a csatlakozáshoz, a **Állapotoldal** pedig közzétesz egy kis nyilvános oldalt, amely megmutatja, hogy a szerver fut-e. Mindkettőhöz a szerver **Beállítások** engedélye szükséges ([felhasználók és szerepkörök](/docs/users-and-roles/#per-server-permissions)).

## Meghívók

A **Beállítások → Meghívók** lapon található egy **Barátok meghívása** kártya:

- **Megosztandó cím** felsorolja a gép hálózati címeit a szerver játékkikötőjével, a nyilvános címedet, ha a panel képes volt felismerni (a hálózaton kívüli játékosok csak porttovábbításon keresztül érhetik el), és a **Egyéni cím…** opciót egy általad beállított tartományhoz vagy címhez, például `play.example.com:25565`.
- **Meghívószöveg** egy készen másolható üzenet a szerver nevével, a kiválasztott címmel, valamint annak Minecraft verziójával és típusával. A **Meghívószöveg másolása** a vágólapra helyezi. Ha a fehérlista be van kapcsolva, a szöveg megkérdezi a barátokat a Minecraft felhasználónevükről, és a kártya emlékeztet, hogy minden barátot hozzá kell adnod a **Játékosok** lapon, mielőtt csatlakoznak.
- **Mire van szüksége a barátoknak** elmondja, mi történik a játékos oldalán: semmi más, csak a megfelelő Minecraft verzió egy vanilla vagy plugin szerverhez (Paper és hasonló), vagy a szerver modjai egy modolt szerverhez.

### Az ügyfél modpack

Egy modolt szerveren a kártya kínál egy **Ügyfél Modpack Letöltése (.mrpack)** opciót is. A barátok importálják ezt a Prism Launcherbe vagy a Modrinth Appba, amely telepíti a szerver Minecraft verzióját és mod betöltőjét, letölti a modokat, és hozzáadja a szervert a többjátékos listájukhoz a kiválasztott címmel.

A fájl a szerverhez általad hozzáadott modokból épül fel (az egyéni mod overlay), amelyek a Modrinthról származnak. Más forrásból származó modok ehelyett a kártyán jelennek meg, így a barátok kézzel adhatják hozzá ezeket a fájlokat a `mods` mappájukhoz. Egy modpackból létrehozott szerveren a barátoknak telepíteniük kell azt a csomagot a launcherükben, azon a verzión, amelyen a szerver fut; a **Áttekintés** lap mutatja a verziót.

### Játék az interneten keresztül

A kártya alján található **Játék az interneten keresztül (porttovábbítás)** magyarázza el az útválasztó oldalát: továbbítsa a szerver játékkikötőjét (TCP és UDP) ahhoz a géphez, amelyen a panel fut, majd ossza meg a nyilvános címét a porttal. Ha az internetszolgáltatója CGNAT-ot használ, a porttovábbítás nem fog működni, és egy alagút szolgáltatás (például playit.gg) a megoldás. A panel nem nyitja meg önmagában az útválasztó portjait. Csak a játékkikötők tartoznak az internetre; tartsa zárva a panel saját portját és az RCON portokat ([portok áttekintése](https://github.com/anefzaoui/minecraft-server-manager#ports-at-a-glance)).

## Állapotoldal

A **Beállítások → Állapotoldal** bekapcsol egy nyilvános oldalt egy szerverhez, alapértelmezetten kikapcsolva:

1. Kapcsolja be a kártyát.
2. Válassza ki az **Oldalcímet**: az oldal a panel `/status/<cím>` útvonalán lesz elérhető, és a cím 3-40 kisbetű, szám vagy kötőjel lehet, egyedi a szerverei között.
3. Nyomja meg a **Mentés** gombot. Az **Oldal megnyitása** és a **Hivatkozás másolása** ezután megadja a megosztható hivatkozást.

A hivatkozással bárki láthatja a szerver nevét, annak MOTD-jét, verzióját, hogy fut-e, a játékosok számát és a futási idejét, és semmi mást. Az oldalnak nincs hivatkozása a panelre, és nincs szüksége bejelentkezésre. A panel memóriában tárolt állapotát olvassa, így a látogatók soha nem terhelik a Docker demont.

Az oldal kikapcsolása megőrzi a címét, így ha újra bekapcsolja, ugyanaz a hivatkozás áll helyre. Egy saját oldalhoz vagy botokhoz a [nyilvános API](/docs/public-api/) ugyanazt az állapotot adja vissza JSON formátumban.

Kapcsolódó: [Discord értesítések](/docs/integrations/), [az élő térkép](/docs/live-map/), [szerverek létrehozása és kezelése](/docs/servers/).
