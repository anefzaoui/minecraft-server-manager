---
title: 'Élő térkép'
description: 'Egykattintásos BlueMap élő 3D térkép a szerver világáról, kizárólag a panel bejelentkezésén keresztül elérhetően.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/live-map.md'
---

[← Vissza a dokumentumokhoz](/docs/)

Egy szerver **Világ → Térkép** lapja a szerver világának élő, nagyítható 3D-s térképét jeleníti meg, amelyet a [BlueMap](https://bluemap.bluecolored.de/) (ingyenes és nyílt forráskódú) generál, játékospozíciókkal és minden dimenzióval. A panel telepíti, konfigurálja és kiszolgálja azt; soha nem kell portot nyitnia vagy konfigurációs fájlt szerkesztenie hozzá.

## Bekapcsolás

1. Nyissa meg a szervert, majd a **Világ → Térkép** lapot.
2. Nyomja meg a **Live Térkép engedélyezése** gombot. A panel telepíti a BlueMap verzióját, amely megegyezik a szerver betöltőjével és Minecraft verziójával a Modrinthről, elfogadja a BlueMap erőforrásletöltését az Ön nevében, és kiválaszt egy szabad portot hozzá.
3. Indítsa újra a szervert (a változás a következő indításkor lép életbe, és a szerver jelölve lesz, mint amelyik erre vár).

A BlueMap a háttérben renderel, így egy új térkép első csempéinek elkészítése néhány percet vesz igénybe. Addig a lap azt jelzi, hogy a térkép még nincs kész, és maga ellenőrzi újra. Ha elkészült, a **Teljes képernyő** megnyitja a térképet egy saját böngésző lapon.

Működik mod betöltővel (Fabric, Quilt, Forge, NeoForge) rendelkező szervereken és plugin szervereken (Paper, Purpur és a Paper család többi tagja, Spigot), beleértve a modpack szervereket is. A Vanilla szerverekhez nincs BlueMap verzió, és a lap ezt jelzi.

## Ki láthatja

A térképet csak a panelen keresztül lehet elérni, annak bejelentkezése mögött: bárki, aki látja a szervert a panelen, megnyithatja a térképét, és senki más. A BlueMap saját portját soha nem szabad az internetre nyitni ([portok áttekintése](https://github.com/anefzaoui/minecraft-server-manager#ports-at-a-glance)). A térkép be- vagy kikapcsolásához a szerver **Beállítások** engedélye szükséges ([felhasználók és szerepkörök](/docs/users-and-roles/#per-server-permissions)).

Amikor maga a panel Dockerben fut, a szerver konténerén belüli BlueMap-hoz fér hozzá; a [README](https://github.com/anefzaoui/minecraft-server-manager#installation) elmagyarázza a részleteket a fordított proxy beállításokhoz.

## Kikapcsolás

A **Térkép letiltása** eltávolítja a panel által telepített BlueMap jar fájlt, és felszabadítja a portját, ismét a következő újraindítástól kezdve. Maga a világ érintetlen marad; a renderelt térképcsempék a szerver mappájában maradnak, amíg Ön nem törli őket a **Fájlok** lapon.

Kapcsolódó: [világok és fájlok](/docs/worlds-and-files/), [meghívók és állapotoldal](/docs/invites-and-status-page/).
