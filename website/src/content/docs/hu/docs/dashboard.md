---
title: 'Az irányítópult'
description: 'Az irányítópult az otthona: minden szerver, annak élő állapota és egy folyamatosan frissülő napló arról, hogy mi történt.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/dashboard.md'
---

[← Vissza a dokumentumokhoz](/docs/)

A műszerfal az otthona: minden szerver, annak élő állapota és egy folyamatosan frissülő napló a történésekről.

![Műszerfal](/docs/images/dashboard.png)

## Összefoglaló csempék

Felül:

- **Online szerverek**: hány szervered fut jelenleg a teljesből.
- **Csatlakozott játékosok**: a futó szerverek teljes játékosainak száma.
- **Elérhető frissítések**: hány szerver, csomag vagy mod rendelkezik újabb verzióval ([lásd Frissítések](/docs/updates/)).
- **Docker**: hogy az irányítópult eléri-e a Docker demont, és annak verziója.

Egy második sorban látható a **Allokált memória** (és a felhasznált mennyiség), a **Felhasznált tárhely** az összes szerveradat-mappában, az **Állapot · 24 óra** (összeomlások, memóriahiány miatti leállások és automatikus újraindítások az elmúlt napban), valamint a **Frissítések**, amelyek mod- és szerver szintű frissítésekre vannak bontva. Ezek alatt a **Szerverek állapota szerint** megszámolja a szervereidet minden állapotban, a **Rendszererőforrás áttekintés** pedig minden szerver memóriai és CPU-megosztását ábrázolja.

## Szerverkártyák

Minden szerver kártyaként jelenik meg az állapotával (Fut, Indul, Leállt, Összeomlott, és köztes állapotok, mint például Egészségtelen vagy Akadozott), a típusával és Minecraft verziójával, a játékkapcsolatával és a címkéivel. Minden kártya mutatja a **játékosok** és a **lemez** használatát a kvótához képest; a futó szerverek folyamatosan frissülő **CPU** és **memória** használatot is mutatnak.

Kattints egy kártyára a szerver megnyitásához. Az üres **Szerver létrehozása** kártya és a felső sáv **Szerver létrehozása** gombja egyaránt elindítja a [létrehozási varázslót](/docs/servers/).

Kereshetsz a szervereid között (név, típus, verzió vagy címke alapján), rendezheted őket állapot, név, méret, utolsó indítás vagy létrehozás szerint, és válthatsz a rács és lista elrendezés között a jobb oldali kapcsolóval.

## Legutóbbi tevékenységek

Az alul található napló a panel ember által olvasható audit trailjának legfrissebb bejegyzéseit mutatja: bejelentkezések, biztonsági mentések, blueprint exportok, frissítésellenőrzések, csevegési parancsok módosításai, szerverindítások és -leállítások, és még sok más. Minden bejegyzés címkézve van a hozzá tartozó szerverrel (vagy magával a panellel) és azzal, hogy mennyi idővel ezelőtt történt. A **Összes megtekintése** megnyitja a teljes előzményt az [Aktivitás](/docs/activity/) oldalon.
