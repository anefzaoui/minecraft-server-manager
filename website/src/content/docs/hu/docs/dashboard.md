---
title: 'Az irányítópult'
description: 'Az irányítópult az otthona: minden szerver, annak élő állapota és egy folyamatosan frissülő napló arról, hogy mi történt.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/dashboard.md'
---

[← Vissza a dokumentumokhoz](/docs/)

A vezérlőpult az otthona: minden szerver, annak élő állapota és egy folyamatosan frissülő napló arról, hogy mi történt.

![Vezérlőpult](/docs/images/dashboard.png)

## Összefoglaló csempék

Felül:

- **Szerverek online** - hány szervered fut jelenleg.
- **Csatlakozott játékosok** - a futó szervereken összesen csatlakozott játékosok száma.
- **Elérhető frissítések** - hány szerver, csomag vagy mod rendelkezik újabb verzióval ([lásd Frissítések](/docs/updates/)).
- **Docker** - hogy az irányítópult eléri-e a Docker demont, és annak verziója.

## Szerverkártyák

Minden szerver egy kártyaként jelenik meg az állapotával (Fut, Indul, Leállt, Összeomlott), a típusával és Minecraft verziójával, valamint a játékkikötőjével. A futó szerverekhez élő **játékos**, **CPU**, **memória** és **lemez** használati adatokat is kapsz, amelyek folyamatosan frissülnek.

Kattints egy kártyára a szerver megnyitásához. Az üres **Szerver létrehozása** kártya és a felső sáv **Szerver létrehozása** gombja egyaránt elindítja a [létrehozási varázslót](/docs/servers/).

Kereshetsz és rendezhetsz szervereket, valamint válthatsz a rács és lista elrendezés között a jobb oldali kapcsolóval.

## Legutóbbi tevékenységek

Az alul található napló egy élő, ember által olvasható audit trail: bejelentkezések, biztonsági mentések, blueprint exportálások, frissítés-ellenőrzések, csevegés-parancs változtatások, szerver indítások és leállítások, és még sok más. Minden bejegyzés címkézve van a hozzá tartozó szerverrel (vagy magával az irányítópulttal) és azzal, hogy mennyi idővel ezelőtt történt. A teljes előzmény az [Tevékenység](/docs/activity/) oldalon található.
